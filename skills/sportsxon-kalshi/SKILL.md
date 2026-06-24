---
name: sportsxon-kalshi
description: Use when trading, pricing, or reasoning about Kalshi event-contract markets via the sportsxon CLI — market/ticker structure, cents pricing, RSA-PSS API auth, the fee formula, order types, the demo sandbox, and the live-trading guardrails.
---

# Sportsxon — Kalshi trading

Kalshi is a **US, CFTC-regulated** event-contract exchange. Contracts are binary: each pays **$1** if the event resolves YES, **$0** if NO. Price is quoted in **cents 1–99**, which equals the market's implied probability (a 63¢ YES = ~63% implied). The sportsxon CLI normalises everything to a YES probability in [0,1] internally and converts at the edges.

## Mental model

- **YES vs NO:** buying NO at `p` is economically buying YES at `1−p`. The CLI lets you trade either with `--outcome yes|no`.
- **Orderbook:** bids (buyers) descending, asks (sellers) ascending, sizes in contracts.
- **Identifiers:** Kalshi is hierarchical — *series* → *event* → *market*, each with a ticker (e.g. a market ticker like `KXWORLDCUP-26-ARG`). Pass the market ticker/id as `<id>` to CLI trade commands. Use `sportsxon markets --venue kalshi --q "world cup"` to discover ids.
- **Settlement:** at resolution YES holders receive $1/contract; losers get $0.

## Fees (model the CLI uses)

Kalshi's trading fee is roughly quadratic in price:

```
fee = ceil( 0.07 × contracts × price × (1 − price) )   # rounded UP to the next cent
```

It is largest near 50¢ and shrinks toward the tails. The CLI applies this in paper P&L and in `quote`. **Verify the live schedule before trusting real P&L — Kalshi has changed fees before.** Override the rate with the fee config if needed.

## Auth (real trading)

Kalshi uses an **API key id + RSA private key**. The CLI signs each request with **RSA-PSS** (SHA-256, MGF1-SHA256, salt = 32) over `${timestampMs}${METHOD}${path}` and sends `KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-TIMESTAMP`, `KALSHI-ACCESS-SIGNATURE`. You never compute this yourself — just provide credentials:

```bash
# interactive (stored 0600 under ~/.config/sportsxon/credentials/)
sportsxon login --venue kalshi
# or via env (never written to disk — good for CI)
export KALSHI_API_KEY_ID=...
export KALSHI_PRIVATE_KEY_FILE=/path/to/kalshi.key   # or KALSHI_PRIVATE_KEY=<PEM>
# encrypt stored creds at rest:
export SPORTSXON_PASSPHRASE='a strong passphrase'
```

Hosts: **live** `api.elections.kalshi.com`, **demo** `demo-api.kalshi.co` (fake funds). Prefer demo first via `--demo`.

## CLI recipes

```bash
sportsxon markets --venue kalshi --q "world cup"      # discover markets + ids
sportsxon book <id> --venue kalshi                    # live orderbook
sportsxon quote <id> --venue kalshi --qty 200         # VWAP, slippage, est. fee, cost
sportsxon buy  <id> --venue kalshi --qty 200          # PAPER buy (default, no money)
sportsxon sell <id> --venue kalshi --qty 200          # PAPER sell / close
sportsxon buy  <id> --venue kalshi --qty 50 --limit 47   # paper LIMIT @ 47¢
sportsxon positions ; sportsxon portfolio             # marks + P&L
```

## Going live (guarded, irreversible)

A real Kalshi order requires **all** of:
1. `sportsxon accept-risk` (one-time),
2. the `--live` flag (or `--demo` for the sandbox),
3. a typed confirmation in a TTY (or `--yes` when non-interactive),
4. staying under the order-size cap (`maxOrderUsd`, default $500; raise with `--max-usd`/`--force`).

Use `--dry-run` to build and price an order without sending it:

```bash
sportsxon accept-risk
sportsxon buy <id> --venue kalshi --qty 100 --limit 45 --demo --dry-run
sportsxon buy <id> --venue kalshi --qty 100 --limit 45 --live --yes   # real money
```

## Pitfalls & compliance

- Prices are **cents (1–99)**, not dollars; `--limit 45` means 45¢.
- Thin books: a market order can walk several levels — always `quote` first.
- Kalshi is **US-only / CFTC-regulated**; obey its API terms and your jurisdiction's law and taxes. This tool is not financial advice. **Never place a live order on a user's behalf without explicit instruction.**
- Pair with **sportsxon-prediction-markets** to decide *whether* an order has edge before sizing it.
