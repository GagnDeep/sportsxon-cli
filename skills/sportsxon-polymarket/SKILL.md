---
name: sportsxon-polymarket
description: Use when trading, pricing, or reasoning about Polymarket prediction markets via the sportsxon CLI — the on-chain CLOB on Polygon, USDC collateral, outcome-token ids, negRisk markets, wallet + allowance setup, L2 API credentials, and order flow.
---

# Sportsxon — Polymarket trading

Polymarket is an **on-chain Central Limit Order Book (CLOB)** on **Polygon** (chainId 137). Each market has two **outcome tokens** (YES / NO) under the Conditional Tokens Framework; one pays **$1** at resolution. Prices are decimals in **(0,1)** = implied probability. Collateral is **USDC**. The sportsxon CLI normalises prices to a YES probability internally.

> ⚠ **Polymarket blocks US persons.** Respect geofencing and each venue's terms. No geofence-evasion guidance will be given.

## Two APIs

- **Gamma** (`gamma-api.polymarket.com`) — discovery: markets, questions, metadata, `clobTokenIds`. The CLI uses it for `markets`/`market`.
- **CLOB** (`clob.polymarket.com`) — orderbook + order placement/cancel + trades.

The trading **id** you pass to CLI commands is the **CLOB token id** (a long decimal string) of the outcome you want. `sportsxon markets --venue polymarket --q "world cup"` surfaces them.

## negRisk markets

Multi-outcome events (e.g. "who wins the World Cup") are often **negRisk** markets, settled through the NegRiskAdapter rather than the plain CTF Exchange. The CLI carries a `negRisk` flag on the market ref and routes orders/allowances accordingly. You don't hand-pick the contract, but be aware fills and allowances differ.

## Wallet, collateral & allowances (real trading)

Real trading is **on-chain** and needs one-time setup:
1. A funded **Polygon EOA private key** with **USDC** for collateral (and a little MATIC is not needed — Polymarket relays gas, but approvals are on-chain).
2. **Token allowances**: approve USDC and the CTF (ERC-1155) to the Exchange and, for negRisk markets, the NegRiskAdapter. The CLI reads the contract addresses from the SDK's exported constants — **never hardcode them**.
3. **L2 API credentials**: derived from your wallet (the CLI calls the SDK's `createOrDeriveApiKey`). Orders are signed with EIP-712 by the SDK.

```bash
# provide the wallet (stored 0600; encrypt with SPORTSXON_PASSPHRASE)
sportsxon login --venue polymarket
# or via env (CI):
export POLYMARKET_PRIVATE_KEY=0x...
# optional pre-derived L2 creds:
export POLYMARKET_API_KEY=... POLYMARKET_API_SECRET=... POLYMARKET_API_PASSPHRASE=...
```

Real Polymarket trading needs the optional peer deps `@polymarket/clob-client` and `viem` (installed automatically unless your environment skips optional deps). Paper trading needs neither.

## CLI recipes

```bash
sportsxon markets --venue polymarket --q "world cup"   # discover token ids
sportsxon book <token-id> --venue polymarket           # live CLOB book
sportsxon quote <token-id> --venue polymarket --qty 100
sportsxon buy  <token-id> --venue polymarket --qty 100         # PAPER (default)
sportsxon buy  <token-id> --venue polymarket --qty 100 --limit 52   # paper LIMIT @ 0.52
sportsxon positions ; sportsxon portfolio
```

## Going live (guarded, irreversible)

Same gate as every venue: `accept-risk` → `--live` → typed confirmation (or `--yes`) → under the size cap. Always `--dry-run` first to inspect the built order:

```bash
sportsxon accept-risk
sportsxon buy <token-id> --venue polymarket --qty 100 --limit 52 --dry-run
sportsxon buy <token-id> --venue polymarket --qty 100 --limit 52 --live --yes
```

## Pitfalls & compliance

- `--limit` is in **cents** in the CLI (52 → 0.52 probability) for consistency with Kalshi.
- First-ever live order may require on-chain approvals to confirm — surface this to the user; it costs gas/time, it is not instant.
- **Polymarket is unavailable to US persons**; you are responsible for compliance, terms, and taxes. Not financial advice. **Never place a live order without explicit user instruction.**
- Cross-venue note: a Polymarket YES and a Kalshi NO on the same event can form an arbitrage — see **sportsxon-prediction-markets**.
