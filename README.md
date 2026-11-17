# makefun-btc-dip-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/a25822457/makefun-btc-dip-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/a25822457/makefun-btc-dip-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A dip-and-trail cbBTC trading bot (optimised variant of the safe entry): it buys the whole cash balance when the 1-minute close is at least 0.8% below its 90-minute moving average, sells on a trailing stop (once +1.5% over cost, sell on a 0.25% fall from the peak) or at −2.5% stop-loss, waits 5 bars after a sale, and has no fallback buy. Long only, one position, at most one order per reply, fully deterministic (no clock, no network, no randomness).

## Strategy

- Universe: CBBTC (Coinbase Wrapped BTC) vs USDC, 1-minute bars, $1,000 paper capital.
- Signal: 90-bar (90-minute) simple moving average of closes. Buy when close < SMA × (1 − 0.008).
- Exit: trailing stop — once the position is worth ≥ 101.5% of its cost, sell everything when it falls 0.25% below its own peak value; hard stop-loss at ≤ 97.5% of cost.
- Cooldown: 5 bars after any sale before the next buy.
- No fallback buy.
- Orders cap slippage at 100 bps past the close they were decided on.

## Local dev-window score

Graded with the kit's own harness (`grade-local --driver process`, two executions, L1 regrade reproduced byte for byte):

- Net PnL: **+33.94 USDC** (return +3.39%)
- Trades: 5, win rate 1.00, max drawdown 0.72%, fees 2.45 USDC
- Split of the dev window (marked equity): first half +24.90 USDC, second half +10.84 USDC; as standalone $1,000 runs, first half +23.13 USDC (3 trades), second half +1.95 USDC (1 trade) — positive in both halves, unlike the safe bot, whose fallback loses about $20 on the second half alone.
- Guardrails met (≥ 1 trade, drawdown ≤ 25%); dev gate (net PnL > $0) passed.

For comparison on the same dev window the kit's house baselines scored: buy-and-hold +1.07, momentum +2.45, ema-cross −106.21, rsi-bollinger −24.25, adx-momentum −32.66 USDC. Frequent trading loses to fees and 1-minute noise here, which is why this bot trades rarely.

## Run it

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

The bot itself is `main.ts` (Node 22, standard library plus the vendored `vendor/makefun-bars.ts` shim, a byte-identical copy of the kit SDK). It speaks `agent-fun/bars-replay/v1` on stdin/stdout.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
