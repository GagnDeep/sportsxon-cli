# @sportsxon/cli

A dual-mode command-line tool for the **FIFA World Cup 2026** and **prediction-market trading** on **Kalshi** and **Polymarket**.

- 🧑‍💻 **Interactive for people** — a rich [React Ink](https://github.com/vadimdemedes/ink) terminal UI: live scoreboard, market browser, live orderbooks, a paper-trading portfolio.
- 🤖 **Scriptable for agents** — every command supports `--json` with a stable envelope and deterministic exit codes, so Claude Code and other agents can drive it. Ships an installable agent skill and one-command MCP registration.
- 📈 **Trading** — paper trading by default (no money), with real Kalshi/Polymarket trading behind explicit, guarded opt-in.

World Cup data comes from the public, read-only [Sportsxon MCP server](https://sportsxon.com/en/mcp). Trading talks directly to each venue's API.

> ⚠️ **Real trading risks real money and is irreversible.** Paper mode is the default. See [Trading safety](#trading-safety). This tool is provided as-is, is not financial advice, and you are responsible for compliance in your jurisdiction.

## Install

```bash
npm i -g @sportsxon/cli
sportsxon --help
# short alias: sx
```

Requires Node.js ≥ 20.

## Quickstart

```bash
sportsxon                       # launch the interactive TUI (in a terminal)
sportsxon live                  # live scoreboard
sportsxon matches list --group C
sportsxon standings A
sportsxon search messi
sportsxon markets --venue polymarket --q "world cup"
sportsxon buy <market-id> --qty 100        # PAPER trade (default)
sportsxon portfolio
```

Append `--json` to any command for machine-readable output.

## Two modes, one core

`sportsxon` with no arguments **in a terminal** launches the interactive Ink TUI. When output is piped, `--json`/`--plain` is passed, or `CI` is set, it stays headless — so agents and scripts get clean, parseable output and never a TUI.

```bash
sportsxon live --json | jq '.data.matches[0]'
```

JSON envelope: `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "message", "hint" } }`.

Exit codes: `0` ok · `1` error · `2` usage · `3` auth/creds · `4` rate-limited · `5` refused by a safety guardrail.

## Commands

### World Cup data
| Command | Description |
| --- | --- |
| `live [slug]` | Live scoreboard, or one match's score |
| `matches list [--stage --status --group --team --limit --cursor]` | Fixtures & results |
| `matches get <slug>` | Match detail (header + events) |
| `standings [group]` | Group tables |
| `team <code> [--squad]` | Team metadata + fixtures or squad |
| `player <slug>` | Player profile + stats |
| `scorers [--assists] [--limit]` | Golden Boot / assists leaderboard |
| `search <query>` | Search teams, players, matches |
| `tools` | List MCP tools the server exposes |
| `mcp call <tool> --args '{...}'` | Call any MCP tool (escape hatch) |

### Markets & trading
| Command | Description |
| --- | --- |
| `markets [--venue kalshi\|polymarket] [--q] [--limit]` | List prediction markets |
| `market <id>` · `book <id>` | Market detail · live orderbook |
| `quote <id> --qty N [--outcome yes\|no]` | Price a trade vs the live book (VWAP, slippage, fee) |
| `buy <id> --qty N [--outcome --limit --venue --live --dry-run]` | Buy (paper by default) |
| `sell <id> --qty N [...]` | Sell / close |
| `positions` · `portfolio` · `fills` · `orders` | Account views |
| `paper reset [--cash]` | Reset the paper account |

### Quant tools
| Command | Description |
| --- | --- |
| `kelly --fair <pct> --price <cents> [--bankroll]` | Kelly stake sizing |
| `ev --fair <pct> --price <cents>` | Expected value |
| `arb --cost-yes <cents> --cost-no <cents>` | Two-leg arbitrage |
| `devig --probs 55,50` | Remove vig → fair probabilities |
| `payout --price <cents> --stake <usd>` | Payout / ROI / break-even |
| `convert [--prob\|--cents\|--decimal\|--american]` | Odds conversions |

### Credentials & agent integration
| Command | Description |
| --- | --- |
| `login --venue kalshi\|polymarket [...]` | Store trading credentials |
| `logout --venue ...` · `whoami` | Remove / show credentials |
| `accept-risk` | One-time live-trading risk acknowledgement |
| `config` | Show settings |
| `mcp add [--target claude-code\|claude-desktop\|cursor]` | Print MCP server config |
| `skills install [--target] [--force]` · `skills list` | Install the bundled agent skill |

## Trading safety

- **Paper is the default.** No flag = simulated fills against the *real* live orderbook, tracked in `~/.config/sportsxon/paper.json`.
- **Real trading is opt-in and guarded.** A live order requires all of:
  1. `sportsxon accept-risk` (one-time acknowledgement),
  2. the `--live` flag,
  3. a typed confirmation in an interactive terminal (or `--yes` when non-interactive),
  4. staying under the order-size cap (`maxOrderUsd`, default $500; raise with `--max-usd` or `--force`).
- **`--dry-run`** builds and prices an order without sending it.
- **Compliance:** Polymarket blocks US persons; Kalshi is a US-only CFTC-regulated exchange. You are responsible for your jurisdiction's laws, each venue's API terms, and taxes.

## Credentials & environment

Credentials are stored under `~/.config/sportsxon/credentials/` with `0600` permissions. Set `SPORTSXON_PASSPHRASE` to encrypt them at rest (AES-256-GCM, scrypt-derived key).

Environment overrides (never written to disk — ideal for CI):

| Variable | Purpose |
| --- | --- |
| `SPORTSXON_BASE_URL` | Override the data API base URL |
| `SPORTSXON_LOCALE` | Default locale |
| `SPORTSXON_PASSPHRASE` | Encrypt/decrypt stored credentials |
| `KALSHI_API_KEY_ID`, `KALSHI_PRIVATE_KEY` or `KALSHI_PRIVATE_KEY_FILE` | Kalshi auth |
| `POLYMARKET_PRIVATE_KEY`, `POLYMARKET_API_KEY/SECRET/PASSPHRASE` | Polymarket auth |

Real Polymarket trading needs the optional peer deps `@polymarket/clob-client` and `viem` (installed automatically unless your environment skips optional deps).

## Agent / Claude Code usage

```bash
sportsxon mcp add                 # register the read-only data server
sportsxon skills install          # drop the skill into .claude/skills
sportsxon live --json             # parseable output, stable exit codes
```

The bundled skill (`skills/sportsxon-wc26/SKILL.md`) tells an agent which command/tool to use for each question. The data MCP server is also usable directly at `https://sportsxon.com/api/mcp`.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build      # bundles src -> dist (deps stay external)
node dist/index.js live
```

## License

MIT © GagnDeep. Not affiliated with FIFA, Kalshi or Polymarket.
