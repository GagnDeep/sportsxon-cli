---
name: sportsxon-wc26
description: Use when answering questions about the FIFA World Cup 2026 (live scores, fixtures, results, standings, squads, players, stats, search) or about Kalshi/Polymarket prediction markets and trading. Works via the read-only Sportsxon MCP server and the `sportsxon` CLI (which also does paper + real trading).
---

# Sportsxon — World Cup 2026 data + prediction-market trading

Two ways to use this:

1. **MCP server (read-only data):** `https://sportsxon.com/api/mcp` (Streamable HTTP, JSON-RPC 2.0). 26 read-only tools for World Cup 2026 data. Betting is never exposed by the server.
2. **CLI (`@sportsxon/cli`):** `npm i -g @sportsxon/cli` → `sportsxon`. Wraps the data API **and** adds Kalshi/Polymarket trading (paper by default, real behind explicit flags). Every command supports `--json` for machine output and returns stable exit codes.

## Connect the MCP server

```bash
claude mcp add --transport http sportsxon https://sportsxon.com/api/mcp
# or:  sportsxon mcp add --print
```

```json
{ "mcpServers": { "sportsxon": { "type": "streamable-http", "url": "https://sportsxon.com/api/mcp" } } }
```

## Identifier conventions

- **Match** → slug, e.g. `a1-mex-kor` (case-insensitive)
- **Team** → 3-letter code, e.g. `MEX`
- **Player / news** → slug, e.g. `arg-10`
- **Venue** → code; **Group** → letter A–L; **Locale** → en (default), es, fr, pt, ar, ja
- **Prediction market** → venue id/ticker (Kalshi) or CLOB token id (Polymarket)

When you don't know an identifier, use `search` first.

## Data: which tool / command

| You want… | MCP tool | CLI |
| --- | --- | --- |
| Live scores | `live_score`, `list_live_matches` | `sportsxon live [slug]` |
| Fixtures / results | `list_matches` | `sportsxon matches list` |
| Match detail | `get_match` (+events/lineups/stats) | `sportsxon matches get <slug>` |
| Group table | `standings` | `sportsxon standings [group]` |
| Team / squad / H2H | `get_team`, `get_team_squad`, `head_to_head` | `sportsxon team <code> [--squad]` |
| Player / leaderboards | `get_player`, `top_scorers`, `top_assists` | `sportsxon player <slug>`, `sportsxon scorers` |
| Anything / search | `search` | `sportsxon search <q>` |
| Any tool (escape hatch) | — | `sportsxon mcp call <tool> --args '{...}'` |

## Prediction markets & trading (CLI)

- **Browse:** `sportsxon markets --venue kalshi|polymarket [--q "world cup"]`, `sportsxon book <id>`, `sportsxon quote <id> --qty 100`
- **Paper trade (default, no money):** `sportsxon buy <id> --qty 100`, `sportsxon sell <id> --qty 40`, `sportsxon positions`, `sportsxon portfolio`
- **Quant tools:** `sportsxon kelly --fair 58 --price 50`, `ev`, `arb`, `devig`, `payout`, `convert`
- **Real money (opt-in, irreversible):** requires `sportsxon accept-risk`, then `--live` + typed confirmation (or `--yes` non-interactively), within size caps. Use `--dry-run` to preview an order without sending. **Do not place live orders unless the user has explicitly asked and accepted the risk.**

## Agent tips

- Always pass `--json` for parseable output: `{ "ok": true, "data": ... }` or `{ "ok": false, "error": {...} }`.
- Exit codes: 0 ok · 1 error · 2 usage · 3 auth · 4 rate-limited · 5 refused-by-guardrail.
- Not-found data returns an error with a recovery hint (use `search`).
- Trading defaults to **paper**. Never use `--live` on the user's behalf without explicit instruction.
