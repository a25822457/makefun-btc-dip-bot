// Dip-and-hold BTC bot for make.fun btc-race-24h-20261117-0603.
//
// Idea (deliberately simple and slow, because 1-minute cbBTC is mostly noise
// and every round trip costs ~30 bps in fees, slippage and pool impact):
//   - Track the 4-hour simple moving average (240 one-minute closes) of CBBTC.
//   - Buy the whole cash balance when the close is at least 0.8% below that
//     average: a dip against the medium-term trend, not a chase of a tick.
//   - Sell the whole position when it is worth 2% over its cost (take profit)
//     or 1.5% under it (stop loss). After a sale, wait 60 bars before the
//     next buy so one dip is not re-bought bar after bar.
//   - Fallback: if still flat after bar 480 and the close is above the
//     4-hour average (an uptrend with no dip to buy), buy once so the bot
//     still participates instead of sitting in cash for the whole window.
//   - Long only, one position, at most one order per reply, full size.
//   - Deterministic: float64 SMA over closes only, no clock, no network,
//     no randomness, no environment. The same bars give the same orders.
//
// Local dev-window result (grade-local, --driver process): see README.md.

import { BPS, runBars, type BarsState, type Batch, type BuyInput, type OrderInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** 4 hours of 1-minute closes. */
const SMA_BARS = 240;
/** Buy when close is this far below the SMA, in bps (80 bps = 0.8%). */
const DIP_BPS = 80;
/** Take profit: position worth 102% of its cost. */
const TAKE_PROFIT_NUM = 102n;
const TAKE_PROFIT_DEN = 100n;
/** Stop loss: position worth 98.5% of its cost. */
const STOP_LOSS_NUM = 985n;
const STOP_LOSS_DEN = 1000n;
/** Bars to wait after a sale before buying again. */
const COOLDOWN_BARS = 60;
/** Fallback entry: first flat bar at or after this seq with close above SMA. */
const FALLBACK_BAR = 480;
/** 1% past the close it was decided on, like the kit baselines. */
const MAX_SLIPPAGE_BPS = 100;

/** The last SMA_BARS closes, oldest first, and their running sum. */
const closes: number[] = [];
let closesSum = 0;

function pushClose(close: number): void {
  closes.push(close);
  closesSum += close;
  if (closes.length > SMA_BARS) closesSum -= closes.shift()!;
}

function sma(): number | null {
  if (closes.length < SMA_BARS) return null;
  return closesSum / SMA_BARS;
}

/** Seq of the batch on which the last sale was decided, or null. */
let lastSellSeq: number | null = null;

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) pushClose(Number(bar.c));
    }
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    const average = sma();
    if (average === null) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      const takeProfit = value * TAKE_PROFIT_DEN >= held.cost * TAKE_PROFIT_NUM;
      const stopLoss = value * STOP_LOSS_DEN <= held.cost * STOP_LOSS_NUM;
      if (takeProfit || stopLoss) {
        lastSellSeq = state.seq;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    if (lastSellSeq !== null && state.seq - lastSellSeq < COOLDOWN_BARS) return [];
    const closePrice = Number(close);
    const dipped = closePrice * 10000 < average * (10000 - DIP_BPS);
    const fallback = state.seq >= FALLBACK_BAR && closePrice > average;
    if (!dipped && !fallback) return [];

    const { caps, fees } = state.hello;
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    const slice = state.cash < byWeight ? state.cash : byWeight;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
