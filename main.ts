// Dip-and-trail BTC bot for make.fun btc-race-24h-20261117-0603.
//
// Optimised variant of the safe entry (Dip-and-hold cbBTC bot). Same entry
// idea, different exit: the safe bot sold at a fixed +2% take-profit, which
// caps a rally, and had a fallback buy after bar 480 that, on its own in
// the second half of the dev window, loses about $20. This variant:
//
//   - Track the 90-minute simple moving average (90 one-minute closes).
//   - Buy the whole cash balance when the close is at least 0.8% below
//     that average: a deep dip against the medium-term trend. In the dev
//     window this fires only three times (bars ~371, ~574, ~1101), which
//     is the point: shallower thresholds (70 bps) also buy near the top
//     of a pullback (bar ~1060) and lose on it.
//   - Sell the whole position on a trailing stop: once the position is
//     worth at least 1.5% over its cost, sell when it has fallen 0.25%
//     below its own peak value. That rides a rally instead of capping
//     it at +2%, and gets out soon after the turn.
//   - Hard stop loss at 2.5% under cost. After a sale, wait 5 bars
//     before the next buy so one dip is not re-bought bar after bar.
//   - No fallback buy: if no deep dip ever comes, the bot stays in cash
//     rather than chasing an uptrend.
//   - Long only, one position, at most one order per reply, full size.
//   - Deterministic: integer (BigInt) ratios for the exit, float64 SMA
//     over closes only, no clock, no network, no randomness, no
//     environment. The same bars give the same orders.
//
// Local dev-window result (grade-local, --driver process): see README.md.

import { BPS, runBars, type BarsState, type Batch, type BuyInput, type OrderInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** 90 minutes of 1-minute closes. */
const SMA_BARS = 90;
/** Buy when close is this far below the SMA, in bps (80 bps = 0.8%). */
const DIP_BPS = 80;
/** Trailing stop starts once the position is this far over its cost, in bps. */
const TRAIL_START_BPS = 150n;
/** Sell when the position has fallen this far below its peak, in bps. */
const TRAIL_DROP_BPS = 25n;
/** Stop loss: position worth 97.5% of its cost. */
const STOP_LOSS_NUM = 975n;
const STOP_LOSS_DEN = 1000n;
/** Bars to wait after a sale before buying again. */
const COOLDOWN_BARS = 5;
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
/** Best value/cost of the current position, in bps over cost (10000 = at cost). */
let peakBps = 10000n;

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
      // value/cost in bps, exact integer math.
      const ratioBps = (value * 10000n) / held.cost;
      if (ratioBps > peakBps) peakBps = ratioBps;
      const stopLoss = value * STOP_LOSS_DEN <= held.cost * STOP_LOSS_NUM;
      const trailing = peakBps >= 10000n + TRAIL_START_BPS && ratioBps <= peakBps - TRAIL_DROP_BPS;
      if (stopLoss || trailing) {
        lastSellSeq = state.seq;
        peakBps = 10000n;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    if (lastSellSeq !== null && state.seq - lastSellSeq < COOLDOWN_BARS) return [];
    const closePrice = Number(close);
    const dipped = closePrice * 10000 < average * (10000 - DIP_BPS);
    if (!dipped) return [];

    const { caps, fees } = state.hello;
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    const slice = state.cash < byWeight ? state.cash : byWeight;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    peakBps = 10000n;
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
