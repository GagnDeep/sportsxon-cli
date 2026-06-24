# Changelog

All notable changes to `@sportsxon/cli` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses semver.

## [0.1.0] - 2026-06-24

Initial release.

### Added
- Dual-mode CLI: interactive React-Ink TUI for people, headless `--json` mode for agents (stable envelope + exit codes).
- World Cup 2026 data via the public Sportsxon MCP server: `live`, `matches`, `standings`, `team`, `player`, `scorers`, `search`, `tools`, and an `mcp call` escape hatch (tolerant of older and newer server contracts).
- Prediction markets: `markets`, `market`, `book`, `quote` for Kalshi and Polymarket (public data).
- Paper trading engine: realistic fills against the live orderbook, fee modelling, a persisted portfolio (`buy`/`sell`/`positions`/`portfolio`/`fills`/`orders`/`paper reset`).
- Real trading: Kalshi (RSA-PSS request signing) and Polymarket (CLOB SDK + viem, optional deps), behind `accept-risk` + `--live` + typed confirmation + size caps + `--dry-run`.
- Quant tools: `kelly`, `ev`, `arb`, `devig`, `payout`, `convert`.
- Credentials with optional AES-256-GCM encryption at rest and env-var overrides; `login`/`logout`/`whoami`.
- Agent integration: `mcp add` and a bundled, installable skill (`skills install` / `skills list`).
