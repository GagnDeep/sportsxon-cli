/**
 * The bundled agent-skill registry. Each entry is the single source of truth for
 * one skill: `skills install` writes it verbatim and the on-disk mirrors under
 * `skills/<name>/SKILL.md` are generated from it (so the npm tarball ships them).
 *
 * Bodies are markdown WITHOUT frontmatter; `renderSkill` prepends the YAML
 * frontmatter from `name` + `description`.
 */

export interface SkillDef {
  name: string;
  description: string;
  body: string;
}

export function skillFrontmatter(s: SkillDef): string {
  return `---\nname: ${s.name}\ndescription: ${s.description}\n---\n`;
}

export function renderSkill(s: SkillDef): string {
  return `${skillFrontmatter(s)}\n${s.body.trim()}\n`;
}

// --------------------------------------------------------------------------
// 1) World Cup 2026 data + overview
// --------------------------------------------------------------------------

const WC26: SkillDef = {
  name: "sportsxon-wc26",
  description:
    "Use when answering questions about the FIFA World Cup 2026 (live scores, fixtures, results, standings, squads, players, stats, search) or for an overview of the sportsxon CLI and its prediction-market tooling. Backed by the read-only Sportsxon MCP server and the `sportsxon` CLI.",
  body: `# Sportsxon — World Cup 2026 data + CLI overview

Two interfaces, one dataset:

1. **MCP server (read-only data):** \`https://sportsxon.com/api/mcp\` — Streamable HTTP, JSON-RPC 2.0. Read-only World Cup 2026 tools. **Betting is never exposed by the server.**
2. **CLI (\`@sportsxon/cli\`):** \`npm i -g @sportsxon/cli\` → \`sportsxon\` (alias \`sx\`). Wraps the data API **and** adds Kalshi/Polymarket trading (paper by default). Every command takes \`--json\` and returns stable exit codes. Run \`sportsxon\` with no args in a terminal for an interactive TUI.

## Connect the MCP server

\`\`\`bash
claude mcp add --transport http sportsxon https://sportsxon.com/api/mcp
# or just print the config:  sportsxon mcp add --print
\`\`\`

\`\`\`json
{ "mcpServers": { "sportsxon": { "type": "streamable-http", "url": "https://sportsxon.com/api/mcp" } } }
\`\`\`

## Identifier conventions

- **Match** → slug, e.g. \`a1-mex-kor\` (case-insensitive)
- **Team** → 3-letter code, e.g. \`MEX\`
- **Player** → slug, e.g. \`arg-10\`
- **Group** → letter A–L · **Locale** → en (default), es, fr, pt, ar, ja
- **Prediction market** → venue id/ticker (Kalshi) or CLOB token id (Polymarket)

When you don't know an identifier, run \`search\` first.

## Data: which tool / command

| You want… | MCP tool | CLI |
| --- | --- | --- |
| Live scores | \`list_live_matches\`, \`live_score\` | \`sportsxon live [slug]\` |
| Fixtures / results | \`list_matches\` | \`sportsxon matches list\` |
| Match detail | \`get_match\` | \`sportsxon matches get <slug>\` |
| Group table | \`standings\` | \`sportsxon standings [group]\` |
| Team / squad | \`get_team\`, \`get_team_squad\` | \`sportsxon team <code> [--squad]\` |
| Player / leaders | \`get_player\`, \`top_scorers\` | \`sportsxon player <slug>\`, \`sportsxon scorers\` |
| Anything | \`search\` | \`sportsxon search <q>\` |
| Any tool | — | \`sportsxon mcp call <tool> --args '{...}'\` |

## Companion skills

For trading, pull in the dedicated skills:
- **sportsxon-kalshi** — Kalshi mechanics, auth, fees, order flow.
- **sportsxon-polymarket** — Polymarket CLOB, on-chain setup, order flow.
- **sportsxon-prediction-markets** — edge-finding, Kelly/EV/arb/de-vig, bankroll.
- **sportsxon-paper-trading** — risk-free practice + the path to going live.

## Agent tips

- Always pass \`--json\`: \`{ "ok": true, "data": ... }\` or \`{ "ok": false, "error": {...} }\`.
- Exit codes: 0 ok · 1 error · 2 usage · 3 auth · 4 rate-limited · 5 refused-by-guardrail.
- Not-found returns an error with a recovery hint (use \`search\`).
- Trading defaults to **paper**. Never use \`--live\` without explicit user instruction.`,
};

// --------------------------------------------------------------------------
// 2) Kalshi trading
// --------------------------------------------------------------------------

const KALSHI: SkillDef = {
  name: "sportsxon-kalshi",
  description:
    "Use when trading, pricing, or reasoning about Kalshi event-contract markets via the sportsxon CLI — market/ticker structure, cents pricing, RSA-PSS API auth, the fee formula, order types, the demo sandbox, and the live-trading guardrails.",
  body: `# Sportsxon — Kalshi trading

Kalshi is a **US, CFTC-regulated** event-contract exchange. Contracts are binary: each pays **$1** if the event resolves YES, **$0** if NO. Price is quoted in **cents 1–99**, which equals the market's implied probability (a 63¢ YES = ~63% implied). The sportsxon CLI normalises everything to a YES probability in [0,1] internally and converts at the edges.

## Mental model

- **YES vs NO:** buying NO at \`p\` is economically buying YES at \`1−p\`. The CLI lets you trade either with \`--outcome yes|no\`.
- **Orderbook:** bids (buyers) descending, asks (sellers) ascending, sizes in contracts.
- **Identifiers:** Kalshi is hierarchical — *series* → *event* → *market*, each with a ticker (e.g. a market ticker like \`KXWORLDCUP-26-ARG\`). Pass the market ticker/id as \`<id>\` to CLI trade commands. Use \`sportsxon markets --venue kalshi --q "world cup"\` to discover ids.
- **Settlement:** at resolution YES holders receive $1/contract; losers get $0.

## Fees (model the CLI uses)

Kalshi's trading fee is roughly quadratic in price:

\`\`\`
fee = ceil( 0.07 × contracts × price × (1 − price) )   # rounded UP to the next cent
\`\`\`

It is largest near 50¢ and shrinks toward the tails. The CLI applies this in paper P&L and in \`quote\`. **Verify the live schedule before trusting real P&L — Kalshi has changed fees before.** Override the rate with the fee config if needed.

## Auth (real trading)

Kalshi uses an **API key id + RSA private key**. The CLI signs each request with **RSA-PSS** (SHA-256, MGF1-SHA256, salt = 32) over \`\${timestampMs}\${METHOD}\${path}\` and sends \`KALSHI-ACCESS-KEY\`, \`KALSHI-ACCESS-TIMESTAMP\`, \`KALSHI-ACCESS-SIGNATURE\`. You never compute this yourself — just provide credentials:

\`\`\`bash
# interactive (stored 0600 under ~/.config/sportsxon/credentials/)
sportsxon login --venue kalshi
# or via env (never written to disk — good for CI)
export KALSHI_API_KEY_ID=...
export KALSHI_PRIVATE_KEY_FILE=/path/to/kalshi.key   # or KALSHI_PRIVATE_KEY=<PEM>
# encrypt stored creds at rest:
export SPORTSXON_PASSPHRASE='a strong passphrase'
\`\`\`

Hosts: **live** \`api.elections.kalshi.com\`, **demo** \`demo-api.kalshi.co\` (fake funds). Prefer demo first via \`--demo\`.

## CLI recipes

\`\`\`bash
sportsxon markets --venue kalshi --q "world cup"      # discover markets + ids
sportsxon book <id> --venue kalshi                    # live orderbook
sportsxon quote <id> --venue kalshi --qty 200         # VWAP, slippage, est. fee, cost
sportsxon buy  <id> --venue kalshi --qty 200          # PAPER buy (default, no money)
sportsxon sell <id> --venue kalshi --qty 200          # PAPER sell / close
sportsxon buy  <id> --venue kalshi --qty 50 --limit 47   # paper LIMIT @ 47¢
sportsxon positions ; sportsxon portfolio             # marks + P&L
\`\`\`

## Going live (guarded, irreversible)

A real Kalshi order requires **all** of:
1. \`sportsxon accept-risk\` (one-time),
2. the \`--live\` flag (or \`--demo\` for the sandbox),
3. a typed confirmation in a TTY (or \`--yes\` when non-interactive),
4. staying under the order-size cap (\`maxOrderUsd\`, default $500; raise with \`--max-usd\`/\`--force\`).

Use \`--dry-run\` to build and price an order without sending it:

\`\`\`bash
sportsxon accept-risk
sportsxon buy <id> --venue kalshi --qty 100 --limit 45 --demo --dry-run
sportsxon buy <id> --venue kalshi --qty 100 --limit 45 --live --yes   # real money
\`\`\`

## Pitfalls & compliance

- Prices are **cents (1–99)**, not dollars; \`--limit 45\` means 45¢.
- Thin books: a market order can walk several levels — always \`quote\` first.
- Kalshi is **US-only / CFTC-regulated**; obey its API terms and your jurisdiction's law and taxes. This tool is not financial advice. **Never place a live order on a user's behalf without explicit instruction.**
- Pair with **sportsxon-prediction-markets** to decide *whether* an order has edge before sizing it.`,
};

// --------------------------------------------------------------------------
// 3) Polymarket trading
// --------------------------------------------------------------------------

const POLYMARKET: SkillDef = {
  name: "sportsxon-polymarket",
  description:
    "Use when trading, pricing, or reasoning about Polymarket prediction markets via the sportsxon CLI — the on-chain CLOB on Polygon, USDC collateral, outcome-token ids, negRisk markets, wallet + allowance setup, L2 API credentials, and order flow.",
  body: `# Sportsxon — Polymarket trading

Polymarket is an **on-chain Central Limit Order Book (CLOB)** on **Polygon** (chainId 137). Each market has two **outcome tokens** (YES / NO) under the Conditional Tokens Framework; one pays **$1** at resolution. Prices are decimals in **(0,1)** = implied probability. Collateral is **USDC**. The sportsxon CLI normalises prices to a YES probability internally.

> ⚠ **Polymarket blocks US persons.** Respect geofencing and each venue's terms. No geofence-evasion guidance will be given.

## Two APIs

- **Gamma** (\`gamma-api.polymarket.com\`) — discovery: markets, questions, metadata, \`clobTokenIds\`. The CLI uses it for \`markets\`/\`market\`.
- **CLOB** (\`clob.polymarket.com\`) — orderbook + order placement/cancel + trades.

The trading **id** you pass to CLI commands is the **CLOB token id** (a long decimal string) of the outcome you want. \`sportsxon markets --venue polymarket --q "world cup"\` surfaces them.

## negRisk markets

Multi-outcome events (e.g. "who wins the World Cup") are often **negRisk** markets, settled through the NegRiskAdapter rather than the plain CTF Exchange. The CLI carries a \`negRisk\` flag on the market ref and routes orders/allowances accordingly. You don't hand-pick the contract, but be aware fills and allowances differ.

## Wallet, collateral & allowances (real trading)

Real trading is **on-chain** and needs one-time setup:
1. A funded **Polygon EOA private key** with **USDC** for collateral (and a little MATIC is not needed — Polymarket relays gas, but approvals are on-chain).
2. **Token allowances**: approve USDC and the CTF (ERC-1155) to the Exchange and, for negRisk markets, the NegRiskAdapter. The CLI reads the contract addresses from the SDK's exported constants — **never hardcode them**.
3. **L2 API credentials**: derived from your wallet (the CLI calls the SDK's \`createOrDeriveApiKey\`). Orders are signed with EIP-712 by the SDK.

\`\`\`bash
# provide the wallet (stored 0600; encrypt with SPORTSXON_PASSPHRASE)
sportsxon login --venue polymarket
# or via env (CI):
export POLYMARKET_PRIVATE_KEY=0x...
# optional pre-derived L2 creds:
export POLYMARKET_API_KEY=... POLYMARKET_API_SECRET=... POLYMARKET_API_PASSPHRASE=...
\`\`\`

Real Polymarket trading needs the optional peer deps \`@polymarket/clob-client\` and \`viem\` (installed automatically unless your environment skips optional deps). Paper trading needs neither.

## CLI recipes

\`\`\`bash
sportsxon markets --venue polymarket --q "world cup"   # discover token ids
sportsxon book <token-id> --venue polymarket           # live CLOB book
sportsxon quote <token-id> --venue polymarket --qty 100
sportsxon buy  <token-id> --venue polymarket --qty 100         # PAPER (default)
sportsxon buy  <token-id> --venue polymarket --qty 100 --limit 52   # paper LIMIT @ 0.52
sportsxon positions ; sportsxon portfolio
\`\`\`

## Going live (guarded, irreversible)

Same gate as every venue: \`accept-risk\` → \`--live\` → typed confirmation (or \`--yes\`) → under the size cap. Always \`--dry-run\` first to inspect the built order:

\`\`\`bash
sportsxon accept-risk
sportsxon buy <token-id> --venue polymarket --qty 100 --limit 52 --dry-run
sportsxon buy <token-id> --venue polymarket --qty 100 --limit 52 --live --yes
\`\`\`

## Pitfalls & compliance

- \`--limit\` is in **cents** in the CLI (52 → 0.52 probability) for consistency with Kalshi.
- First-ever live order may require on-chain approvals to confirm — surface this to the user; it costs gas/time, it is not instant.
- **Polymarket is unavailable to US persons**; you are responsible for compliance, terms, and taxes. Not financial advice. **Never place a live order without explicit user instruction.**
- Cross-venue note: a Polymarket YES and a Kalshi NO on the same event can form an arbitrage — see **sportsxon-prediction-markets**.`,
};

// --------------------------------------------------------------------------
// 4) Prediction-market quant & strategy
// --------------------------------------------------------------------------

const QUANT: SkillDef = {
  name: "sportsxon-prediction-markets",
  description:
    "Use when finding edge, sizing bets, or evaluating prediction-market trades — turning a fair probability into expected value and a Kelly stake, de-vigging sportsbook odds, spotting cross-venue arbitrage, tracking closing-line value, and managing a bankroll. Uses the sportsxon CLI quant tools.",
  body: `# Sportsxon — prediction-market quant & strategy

The whole game is: **estimate a fair probability, compare it to the market price, and only bet when the edge survives fees — then size with discipline.** The sportsxon CLI ships the math; this skill is the workflow.

## The edge-finding loop

1. **Form a fair probability** for an outcome. Use World Cup 2026 data (form, squad, H2H, standings via the *sportsxon-wc26* skill) and/or de-vigged sportsbook odds.
2. **Read the market price** (\`sportsxon market <id>\` / \`book <id>\`) — the implied probability.
3. **Compute edge & EV.** Edge = fair − price. Positive expected value means fair > price (for YES).
4. **Size with Kelly** (fractional), within your bankroll and the per-order cap.
5. **Execute** (paper first — see *sportsxon-paper-trading*), then **track CLV** to see if you beat the closing line.

## CLI quant tools (all support \`--json\`)

\`\`\`bash
sportsxon ev     --fair 58 --price 50            # edge, EV/contract, EV per $100
sportsxon kelly  --fair 58 --price 50 --bankroll 1000   # full/½/¼ Kelly stakes
sportsxon arb    --cost-yes 48 --cost-no 49      # two-leg risk-free check + sizing
sportsxon devig  --probs 55,50                   # strip the vig → fair probabilities
sportsxon payout --price 40 --stake 100          # contracts, max payout, ROI, break-even
sportsxon convert --cents 63                     # ¢ ↔ prob ↔ decimal ↔ American
\`\`\`

Inputs: \`--fair\`/\`--probs\` are **percent**, \`--price\`/\`--cost-*\` are **cents**, stakes/bankroll are **dollars**.

## Kelly, sanely

\`\`\`
edge b = (1/price) − 1          # net decimal odds
f* = (b·p − (1−p)) / b          # full-Kelly fraction of bankroll (0 if no edge)
\`\`\`

Full Kelly maximises long-run growth but is brutally volatile and unforgiving of a mis-estimated \`p\`. **Default to ¼–½ Kelly.** If \`sportsxon kelly\` returns 0, there is no edge — don't bet.

## De-vigging

Sportsbook implied probabilities sum to > 1 (the overround/vig). \`sportsxon devig --probs 55,50\` normalises them to sum to 1, giving the book's *fair* estimate — a strong prior for your \`--fair\`.

## Cross-venue arbitrage

Because Kalshi and Polymarket are separate books, the **same event** can be mispriced across them. Buying YES on one and NO on the other for a combined cost < $1 locks a risk-free profit:

\`\`\`bash
# YES @ 48¢ on venue A, NO @ 49¢ on venue B → sum 97¢ < $1 → arb
sportsxon arb --cost-yes 48 --cost-no 49 --stake 100
\`\`\`

Always net **fees and slippage** (run \`quote\` on each leg) — thin arbs evaporate after costs.

## Closing-line value (CLV)

The price at close is the market's best estimate. Consistently buying **below** the closing price (for YES) is the strongest evidence your process has edge, independent of any single result. Record entry price vs closing price over many bets.

## Worked example (paper)

\`\`\`bash
sportsxon search "argentina"                       # find the team/market
sportsxon markets --venue kalshi --q "argentina"   # get the market id + price
sportsxon devig --probs 60,44                       # book-implied → fair ≈ 0.577
sportsxon ev    --fair 58 --price 50 --json         # confirm +EV
sportsxon kelly --fair 58 --price 50 --bankroll 1000  # → size at ¼ Kelly
sportsxon buy <id> --venue kalshi --qty <¼-kelly contracts>   # PAPER
\`\`\`

## Risk management

- Bet a **fraction** of edge (¼–½ Kelly); never full Kelly on an estimate.
- Respect the per-order and position caps; diversify across uncorrelated events.
- Fees turn small edges negative — model them every time.
- Track results honestly (CLV + realized P&L via \`sportsxon portfolio\`). Not financial advice.`,
};

// --------------------------------------------------------------------------
// 5) Paper trading workflow
// --------------------------------------------------------------------------

const PAPER: SkillDef = {
  name: "sportsxon-paper-trading",
  description:
    "Use when practicing, backtesting, or simulating prediction-market trades with no real money via the sportsxon CLI paper engine — how simulated fills work against the real book, tracking a paper portfolio and P&L, resetting, isolating runs, and the safe path to live trading.",
  body: `# Sportsxon — paper trading

Paper mode is the **default** for every \`buy\`/\`sell\`: no credentials, no money, no risk — but **realistic**. It is the right place to practice, demo, and validate a strategy before risking a cent.

## How the paper engine works

- **Fills walk the REAL public orderbook.** A market order consumes live levels for true VWAP + slippage; a LIMIT order only takes levels at/through your limit and otherwise "rests" (paper: unfilled). So paper fills behave like real ones.
- **Fees are modelled per venue** (Kalshi's quadratic fee; Polymarket's operator bps) so paper P&L ≈ real P&L.
- **Positions** use weighted-average entry; SELL realises P&L against that average.
- **State** lives in \`~/.config/sportsxon/paper.json\` (atomic writes, default starting cash $10,000). It holds cash, positions, orders and fills.

## Core workflow

\`\`\`bash
sportsxon paper reset --cash 10000          # start fresh
sportsxon markets --q "world cup"           # find something to trade
sportsxon quote <id> --qty 200              # preview fill, fee, cost
sportsxon buy   <id> --qty 200              # simulated buy
sportsxon positions                         # open positions + live mark + uPnL
sportsxon sell  <id> --qty 200              # close, realise P&L
sportsxon portfolio                         # cash, equity, realized/unrealized/total P&L
sportsxon fills ; sportsxon orders          # blotter
\`\`\`

Or do it all visually: run \`sportsxon\` (no args) for the TUI, open **Markets**, press \`o\` for the order ticket (live preview), then watch **Portfolio**.

## Backtesting / strategy validation

1. \`paper reset\` to a known bankroll.
2. For each candidate trade, decide with the **sportsxon-prediction-markets** loop (EV + Kelly).
3. Place the paper order at the Kelly-sized quantity.
4. Let markets resolve / mark over time; review \`portfolio\` and \`fills\`.
5. Iterate — only a process that's green on paper *and* shows positive CLV is worth real money.

## Isolating runs (agents & experiments)

Point the whole config (paper state + settings + creds) at a scratch dir so parallel experiments don't collide and nothing touches your real account:

\`\`\`bash
export SPORTSXON_CONFIG_DIR=/tmp/sx-experiment-1
sportsxon paper reset --cash 5000
sportsxon buy <id> --qty 100 --json
\`\`\`

## Agent-driven loops

Everything is scriptable: pass \`--json\`, branch on the \`{ok,data}\` envelope and exit codes, and run a strategy headlessly:

\`\`\`bash
price=$(sportsxon market <id> --json | jq '.data.yesPrice')
ev=$(sportsxon ev --fair 58 --price $(printf '%.0f' "$(echo "$price*100" | bc)") --json | jq '.data.positive')
[ "$ev" = "true" ] && sportsxon buy <id> --qty 100 --json
\`\`\`

## Graduating to live

When paper results justify it, going live is **deliberate**: \`sportsxon accept-risk\`, then \`--live\` + a typed confirmation (or \`--yes\`) + size caps, with \`--dry-run\` to preview. See **sportsxon-kalshi** / **sportsxon-polymarket** for venue setup. Paper remains the default — \`--live\` is never implied. Not financial advice.`,
};

export const SKILLS: SkillDef[] = [WC26, KALSHI, POLYMARKET, QUANT, PAPER];

export function getSkill(name: string): SkillDef | undefined {
  return SKILLS.find((s) => s.name === name);
}

// Back-compat for existing imports (the primary/overview skill).
export const SKILL_NAME = WC26.name;
export const SKILL_MD = renderSkill(WC26);
