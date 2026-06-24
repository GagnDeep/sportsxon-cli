---
name: sportsxon-wc26
description: Use when answering questions about the FIFA World Cup 2026 (live scores, fixtures, results, standings, squads, players, stats, search) or for an overview of the sportsxon CLI and its prediction-market tooling. Backed by the read-only Sportsxon MCP server and the `sportsxon` CLI.
---

# Sportsxon — World Cup 2026 data + CLI overview

Two interfaces, one dataset:

1. **MCP server (read-only data):** `https://sportsxon.com/api/mcp` — Streamable HTTP, JSON-RPC 2.0. Read-only World Cup 2026 tools. **Betting is never exposed by the server.**
2. **CLI (`@sportsxon/cli`):** `npm i -g @sportsxon/cli` → `sportsxon` (alias `sx`). Wraps the data API **and** adds Kalshi/Polymarket trading (paper by default). Every command takes `--json` and returns stable exit codes. Run `sportsxon` with no args in a terminal for an interactive TUI.

## Connect the MCP server

```bash
claude mcp add --transport http sportsxon https://sportsxon.com/api/mcp
# or just print the config:  sportsxon mcp add --print
```

```json
{ "mcpServers": { "sportsxon": { "type": "streamable-http", "url": "https://sportsxon.com/api/mcp" } } }
```

## Identifier conventions

- **Match** → slug, e.g. `a1-mex-kor` (case-insensitive)
- **Team** → 3-letter code, e.g. `MEX`
- **Player** → slug, e.g. `arg-10`
- **Group** → letter A–L · **Locale** → en (default), es, fr, pt, ar, ja
- **Prediction market** → venue id/ticker (Kalshi) or CLOB token id (Polymarket)

When you don't know an identifier, run `search` first.

## Data: which tool / command

| You want… | MCP tool | CLI |
| --- | --- | --- |
| Live scores | `list_live_matches`, `live_score` | `sportsxon live [slug]` |
| Fixtures / results | `list_matches` | `sportsxon matches list` |
| Match detail | `get_match` | `sportsxon matches get <slug>` |
| Group table | `standings` | `sportsxon standings [group]` |
| Team / squad | `get_team`, `get_team_squad` | `sportsxon team <code> [--squad]` |
| Player / leaders | `get_player`, `top_scorers` | `sportsxon player <slug>`, `sportsxon scorers` |
| Anything | `search` | `sportsxon search <q>` |
| Any tool | — | `sportsxon mcp call <tool> --args '{...}'` |

## Companion skills

For trading, pull in the dedicated skills:
- **sportsxon-kalshi** — Kalshi mechanics, auth, fees, order flow.
- **sportsxon-polymarket** — Polymarket CLOB, on-chain setup, order flow.
- **sportsxon-prediction-markets** — edge-finding, Kelly/EV/arb/de-vig, bankroll.
- **sportsxon-paper-trading** — risk-free practice + the path to going live.

## Agent tips

- Always pass `--json`: `{ "ok": true, "data": ... }` or `{ "ok": false, "error": {...} }`.
- Exit codes: 0 ok · 1 error · 2 usage · 3 auth · 4 rate-limited · 5 refused-by-guardrail.
- Not-found returns an error with a recovery hint (use `search`).
- Trading defaults to **paper**. Never use `--live` without explicit user instruction.
