# makefun-btc-dip-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/a25822457/makefun-btc-dip-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/a25822457/makefun-btc-dip-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A slow dip-and-hold cbBTC trading bot: it buys the whole cash balance when the 1-minute close is at least 0.8% below its 4-hour moving average, sells at +2% take-profit or −1.5% stop-loss, waits 60 bars after a sale, and buys into an uptrend after bar 480 if it never saw a dip. Long only, one position, at most one order per reply, fully deterministic (no clock, no network, no randomness).

## Strategy

- Universe: CBBTC (Coinbase Wrapped BTC) vs USDC, 1-minute bars, $1,000 paper capital.
- Signal: 240-bar (4-hour) simple moving average of closes. Buy when close < SMA × (1 − 0.008).
- Exit: sell everything when the position is worth ≥ 102% of its cost, or ≤ 98.5% of it.
- Cooldown: 60 bars after any sale before the next buy.
- Fallback: from bar 480, if still flat and the close is above the SMA, buy once.
- Orders cap slippage at 100 bps past the close they were decided on.

## Local dev-window score

Graded with the kit's own harness (`grade-local --driver process`, two executions, L1 regrade reproduced byte for byte):

- Net PnL: **+22.10 USDC** (return +2.21%)
- Trades: 3, win rate 1.00, max drawdown 1.70%, fees 1.62 USDC
- Guardrails met (≥ 1 trade, drawdown ≤ 25%); dev gate (net PnL > $0) passed.

For comparison on the same dev window the kit's house baselines scored: buy-and-hold +1.07, momentum +2.45, ema-cross −106.21, rsi-bollinger −24.25, adx-momentum −32.66 USDC. Frequent trading loses to fees and 1-minute noise here, which is why this bot trades rarely.

## Run it

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

The bot itself is `main.ts` (Node 22, standard library plus the vendored `vendor/makefun-bars.ts` shim, a byte-identical copy of the kit SDK). It speaks `agent-fun/bars-replay/v1` on stdin/stdout.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
