---
name: sportsxon-paper-trading
description: Use when practicing, backtesting, or simulating prediction-market trades with no real money via the sportsxon CLI paper engine — how simulated fills work against the real book, tracking a paper portfolio and P&L, resetting, isolating runs, and the safe path to live trading.
---

# Sportsxon — paper trading

Paper mode is the **default** for every `buy`/`sell`: no credentials, no money, no risk — but **realistic**. It is the right place to practice, demo, and validate a strategy before risking a cent.

## How the paper engine works

- **Fills walk the REAL public orderbook.** A market order consumes live levels for true VWAP + slippage; a LIMIT order only takes levels at/through your limit and otherwise "rests" (paper: unfilled). So paper fills behave like real ones.
- **Fees are modelled per venue** (Kalshi's quadratic fee; Polymarket's operator bps) so paper P&L ≈ real P&L.
- **Positions** use weighted-average entry; SELL realises P&L against that average.
- **State** lives in `~/.config/sportsxon/paper.json` (atomic writes, default starting cash $10,000). It holds cash, positions, orders and fills.

## Core workflow

```bash
sportsxon paper reset --cash 10000          # start fresh
sportsxon markets --q "world cup"           # find something to trade
sportsxon quote <id> --qty 200              # preview fill, fee, cost
sportsxon buy   <id> --qty 200              # simulated buy
sportsxon positions                         # open positions + live mark + uPnL
sportsxon sell  <id> --qty 200              # close, realise P&L
sportsxon portfolio                         # cash, equity, realized/unrealized/total P&L
sportsxon fills ; sportsxon orders          # blotter
```

Or do it all visually: run `sportsxon` (no args) for the TUI, open **Markets**, press `o` for the order ticket (live preview), then watch **Portfolio**.

## Backtesting / strategy validation

1. `paper reset` to a known bankroll.
2. For each candidate trade, decide with the **sportsxon-prediction-markets** loop (EV + Kelly).
3. Place the paper order at the Kelly-sized quantity.
4. Let markets resolve / mark over time; review `portfolio` and `fills`.
5. Iterate — only a process that's green on paper *and* shows positive CLV is worth real money.

## Isolating runs (agents & experiments)

Point the whole config (paper state + settings + creds) at a scratch dir so parallel experiments don't collide and nothing touches your real account:

```bash
export SPORTSXON_CONFIG_DIR=/tmp/sx-experiment-1
sportsxon paper reset --cash 5000
sportsxon buy <id> --qty 100 --json
```

## Agent-driven loops

Everything is scriptable: pass `--json`, branch on the `{ok,data}` envelope and exit codes, and run a strategy headlessly:

```bash
price=$(sportsxon market <id> --json | jq '.data.yesPrice')
ev=$(sportsxon ev --fair 58 --price $(printf '%.0f' "$(echo "$price*100" | bc)") --json | jq '.data.positive')
[ "$ev" = "true" ] && sportsxon buy <id> --qty 100 --json
```

## Graduating to live

When paper results justify it, going live is **deliberate**: `sportsxon accept-risk`, then `--live` + a typed confirmation (or `--yes`) + size caps, with `--dry-run` to preview. See **sportsxon-kalshi** / **sportsxon-polymarket** for venue setup. Paper remains the default — `--live` is never implied. Not financial advice.
