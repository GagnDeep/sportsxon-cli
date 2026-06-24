# Changelog

All notable changes to `@sportsxon/cli` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses semver.

## [Unreleased]

### Added
- **Reimagined interactive TUI.** A persistent tabbed shell (Home / Live / Markets / Portfolio / Quant) with keyboard navigation (`1`–`5`, `Tab`/`⇧Tab`), a `?` help overlay, a status bar (venue/mode/clock), and a responsive, themed design system (panels, depth bars, badges, data tables).
  - **Home** dashboard: live ticker, paper-account snapshot, connection/risk status, quick actions.
  - **Live**: auto-refreshing scoreboard + upcoming fixtures with flags and status pills.
  - **Markets**: in-app search (`/`), venue switch (`v`), a depth-chart orderbook (spread/mid), and an **order ticket** (`o`) with a live fill/fee/cost preview that places paper orders.
  - **Portfolio**: positions marked to the live market with unrealized P&L, an equity/P&L summary, and a fills blotter.
  - **Quant lab**: six interactive calculators (Kelly, EV, arbitrage, de-vig, payout, odds convert) that compute live as you type.
- **Five bundled agent skills** (was one): `sportsxon-wc26`, `sportsxon-kalshi`, `sportsxon-polymarket`, `sportsxon-prediction-markets`, `sportsxon-paper-trading`. `skills install` now installs all by default (or one by name); `skills list` shows the suite. Skills are generated to `skills/<name>/SKILL.md` from a single source of truth.
- `fetchMatches` helper powering the TUI fixtures view.

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
