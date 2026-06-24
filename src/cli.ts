import { Command } from "commander";
import { resolveContext, type GlobalFlags, type RunContext } from "./context";
import { emit, emitError, type CommandOutput } from "./render/headless";
import { ExitCode, isCliError, CliError } from "./lib/exit";
import * as wc26 from "./core/commands/wc26";
import * as quant from "./core/commands/quant";
import * as trade from "./core/commands/trade";
import * as account from "./core/commands/account";
import * as agent from "./core/commands/agent";

const VERSION = "0.1.0";

const num = (v: string) => parseFloat(v);

function ctxOf(cmd: Command): RunContext {
  return resolveContext(cmd.optsWithGlobals() as GlobalFlags);
}

/**
 * Attach the shared global flags to a command. We add them to every leaf command
 * (not just the root) so `--json`, `--plain`, `--locale`, … work whether the
 * user puts them before or after the subcommand — important for agents that
 * append `--json` at the end.
 */
function withGlobals(cmd: Command): Command {
  return cmd
    .option("--json", "emit a stable JSON envelope on stdout (machine mode)")
    .option("--plain", "force plain text output (no interactive UI)")
    .option("--no-color", "disable ANSI color")
    .option("--locale <code>", "content locale (en|es|fr|pt|ar|ja)")
    .option("--venue <venue>", "trading venue (kalshi|polymarket)")
    .option("--base-url <url>", "override the API base URL")
    .option("--yes", "assume yes / skip confirmations (required for --live when non-interactive)");
}

async function execute(ctx: RunContext, work: () => CommandOutput | Promise<CommandOutput>): Promise<void> {
  try {
    emit(ctx, await work());
    process.exitCode = ExitCode.OK;
  } catch (e) {
    if (isCliError(e)) {
      emitError(ctx, e.message, e.hint);
      process.exitCode = e.code;
    } else {
      emitError(ctx, (e as Error)?.message ?? String(e));
      process.exitCode = ExitCode.GENERIC;
    }
  }
}

function parseArgsJson(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    throw new Error("must be a JSON object");
  } catch (e) {
    throw new CliError(`--args must be a JSON object: ${(e as Error).message}`, ExitCode.USAGE);
  }
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("sportsxon")
    .description(
      "World Cup 2026 data (via MCP) + Kalshi/Polymarket prediction-market trading. Rich Ink TUI for people, scriptable --json for agents.",
    )
    .version(VERSION, "-v, --version");
  withGlobals(program);

  // Root: no subcommand -> interactive TUI (humans) or help (agents/pipes).
  program.action(async (_opts, cmd: Command) => {
    const ctx = ctxOf(cmd);
    if (ctx.interactive) {
      const { launchTui } = await import("./ui/launch");
      await launchTui(ctx);
    } else {
      cmd.help();
    }
  });

  // -- WC26 data ------------------------------------------------------------
  withGlobals(
    program.command("live").description("Live scoreboard, or the score of one match").argument("[slug]", "match slug"),
  ).action((slug, _o, cmd) => execute(ctxOf(cmd), () => wc26.runLive(ctxOf(cmd), slug)));

  const matches = program.command("matches").description("Fixtures and results");
  withGlobals(
    matches
      .command("list")
      .description("List matches (filterable, paginated)")
      .option("--stage <stage>", "group|r32|r16|qf|sf|third|final")
      .option("--status <status>", "scheduled|live|ht|ft|aet|pen|postponed|cancelled")
      .option("--group <letter>", "group letter A–L")
      .option("--team <code>", "3-letter team code")
      .option("--limit <n>", "max results", (v) => parseInt(v, 10))
      .option("--cursor <c>", "pagination cursor"),
  ).action((o, cmd) =>
    execute(ctxOf(cmd), () =>
      wc26.runMatchesList(ctxOf(cmd), {
        stage: o.stage,
        status: o.status,
        group: o.group,
        team: o.team,
        limit: o.limit,
        cursor: o.cursor,
      }),
    ),
  );
  withGlobals(
    matches.command("get").description("Match detail (header + events)").argument("<slug>", "match slug, e.g. a1-mex-kor"),
  ).action((slug, _o, cmd) => execute(ctxOf(cmd), () => wc26.runMatchGet(ctxOf(cmd), slug)));

  withGlobals(
    program.command("standings").description("Group tables (one group or all)").argument("[group]", "group letter A–L"),
  ).action((group, _o, cmd) => execute(ctxOf(cmd), () => wc26.runStandings(ctxOf(cmd), group)));

  withGlobals(
    program
      .command("team")
      .description("Team metadata + fixtures (or squad)")
      .argument("<code>", "3-letter team code, e.g. MEX")
      .option("--squad", "show the squad instead of fixtures"),
  ).action((code, o, cmd) => execute(ctxOf(cmd), () => wc26.runTeam(ctxOf(cmd), code, Boolean(o.squad))));

  withGlobals(
    program.command("player").description("Player profile + tournament stats").argument("<slug>", "player slug, e.g. arg-10"),
  ).action((slug, _o, cmd) => execute(ctxOf(cmd), () => wc26.runPlayer(ctxOf(cmd), slug)));

  withGlobals(
    program
      .command("scorers")
      .description("Golden Boot / assists leaderboard")
      .option("--assists", "assists race instead of goals")
      .option("--limit <n>", "max results", (v) => parseInt(v, 10), 10),
  ).action((o, cmd) => execute(ctxOf(cmd), () => wc26.runScorers(ctxOf(cmd), Boolean(o.assists), o.limit)));

  withGlobals(
    program.command("search").description("Search teams, players and matches").argument("<query>", "free-text query"),
  ).action((q, _o, cmd) => execute(ctxOf(cmd), () => wc26.runSearch(ctxOf(cmd), q)));

  withGlobals(program.command("tools").description("List the MCP tools the server exposes")).action((_o, cmd) =>
    execute(ctxOf(cmd), () => wc26.runTools(ctxOf(cmd))),
  );

  // -- Quant tools ----------------------------------------------------------
  withGlobals(
    program
      .command("kelly")
      .description("Kelly stake sizing (full / half / quarter)")
      .requiredOption("--fair <pct>", "your fair probability, percent", num)
      .requiredOption("--price <cents>", "contract price in cents", num)
      .option("--bankroll <usd>", "bankroll in dollars", num, 1000),
  ).action((o, cmd) => execute(ctxOf(cmd), () => quant.runKelly(ctxOf(cmd), o)));

  withGlobals(
    program
      .command("ev")
      .description("Expected value of a contract at a price")
      .requiredOption("--fair <pct>", "your fair probability, percent", num)
      .requiredOption("--price <cents>", "contract price in cents", num),
  ).action((o, cmd) => execute(ctxOf(cmd), () => quant.runEv(ctxOf(cmd), o)));

  withGlobals(
    program
      .command("arb")
      .description("Two-leg binary arbitrage check")
      .requiredOption("--cost-yes <cents>", "YES cost in cents (venue A)", num)
      .requiredOption("--cost-no <cents>", "NO cost in cents (venue B)", num)
      .option("--stake <usd>", "total stake", num, 100),
  ).action((o, cmd) =>
    execute(ctxOf(cmd), () => quant.runArb(ctxOf(cmd), { yes: o.costYes, no: o.costNo, stake: o.stake })),
  );

  withGlobals(
    program
      .command("devig")
      .description("Remove vig from implied prices to fair probabilities")
      .requiredOption("--probs <list>", "comma-separated implied prices in cents, e.g. 55,50"),
  ).action((o, cmd) => execute(ctxOf(cmd), () => quant.runDevig(ctxOf(cmd), o)));

  withGlobals(
    program
      .command("payout")
      .description("Contract payout / ROI / break-even")
      .requiredOption("--price <cents>", "entry price in cents", num)
      .requiredOption("--stake <usd>", "stake in dollars", num),
  ).action((o, cmd) => execute(ctxOf(cmd), () => quant.runPayout(ctxOf(cmd), o)));

  withGlobals(
    program
      .command("convert")
      .description("Convert between probability, cents, decimal and American odds")
      .option("--prob <pct>", "probability percent", num)
      .option("--cents <c>", "price in cents", num)
      .option("--decimal <d>", "decimal odds", num)
      .option("--american <a>", "American odds", num),
  ).action((o, cmd) => execute(ctxOf(cmd), () => quant.runConvert(ctxOf(cmd), o)));

  // -- Trading (paper by default) -------------------------------------------
  withGlobals(
    program
      .command("markets")
      .description("List prediction markets on a venue (--venue kalshi|polymarket)")
      .option("--q <query>", "filter markets by text")
      .option("--limit <n>", "max results", num, 25),
  ).action((o, cmd) => execute(ctxOf(cmd), () => trade.runMarkets(ctxOf(cmd), o)));

  withGlobals(
    program.command("market").description("Show one market").argument("<id>", "market id / ticker / token id"),
  ).action((id, _o, cmd) => execute(ctxOf(cmd), () => trade.runMarket(ctxOf(cmd), id)));

  withGlobals(
    program.command("book").description("Live orderbook for a market").argument("<id>", "market id / ticker / token id"),
  ).action((id, _o, cmd) => execute(ctxOf(cmd), () => trade.runBook(ctxOf(cmd), id)));

  withGlobals(
    program
      .command("quote")
      .description("Price a trade against the live book (VWAP, slippage, fee)")
      .argument("<id>", "market id")
      .option("--outcome <yes|no>", "outcome", "yes")
      .option("--qty <n>", "contracts", num, 100),
  ).action((id, o, cmd) => execute(ctxOf(cmd), () => trade.runQuote(ctxOf(cmd), id, o)));

  const tradeFlags = (c: Command) =>
    c
      .argument("<id>", "market id / ticker / token id")
      .requiredOption("--qty <n>", "contracts", num)
      .option("--outcome <yes|no>", "outcome", "yes")
      .option("--limit <cents>", "limit price in cents (omit for market order)", num)
      .option("--live", "place a REAL order (default is paper)")
      .option("--demo", "use the venue demo/sandbox environment")
      .option("--dry-run", "build the order and show it without sending")
      .option("--force", "bypass the order-size cap")
      .option("--max-usd <usd>", "max order notional", num);

  withGlobals(tradeFlags(program.command("buy").description("Buy contracts (paper by default)"))).action((id, o, cmd) =>
    execute(ctxOf(cmd), () => trade.runBuy(ctxOf(cmd), id, o)),
  );
  withGlobals(tradeFlags(program.command("sell").description("Sell/close contracts (paper by default)"))).action((id, o, cmd) =>
    execute(ctxOf(cmd), () => trade.runSell(ctxOf(cmd), id, o)),
  );

  withGlobals(program.command("positions").description("Open positions with mark + unrealized P&L")).action((_o, cmd) =>
    execute(ctxOf(cmd), () => trade.runPositions(ctxOf(cmd))),
  );
  withGlobals(program.command("portfolio").description("Cash, equity and P&L summary")).action((_o, cmd) =>
    execute(ctxOf(cmd), () => trade.runPortfolio(ctxOf(cmd))),
  );
  withGlobals(
    program.command("fills").description("Recent fills").option("--limit <n>", "max", num, 20),
  ).action((o, cmd) => execute(ctxOf(cmd), () => trade.runFills(ctxOf(cmd), o.limit)));
  withGlobals(
    program.command("orders").description("Recent orders").option("--limit <n>", "max", num, 20),
  ).action((o, cmd) => execute(ctxOf(cmd), () => trade.runOrders(ctxOf(cmd), o.limit)));

  const paper = program.command("paper").description("Paper account management");
  withGlobals(
    paper.command("reset").description("Reset the paper account").option("--cash <usd>", "starting cash", num, 10000),
  ).action((o, cmd) => execute(ctxOf(cmd), () => trade.runPaperReset(ctxOf(cmd), o.cash)));

  withGlobals(program.command("accept-risk").description("Acknowledge live-trading risk (one-time gate)")).action((_o, cmd) =>
    execute(ctxOf(cmd), () => trade.runAcceptRisk(ctxOf(cmd))),
  );
  withGlobals(program.command("config").description("Show CLI settings")).action((_o, cmd) =>
    execute(ctxOf(cmd), () => trade.runConfig(ctxOf(cmd))),
  );

  // -- Trading credentials --------------------------------------------------
  withGlobals(
    program
      .command("login")
      .description("Store trading credentials for a venue (--venue kalshi|polymarket)")
      .option("--kalshi-key-id <id>", "Kalshi API key id")
      .option("--kalshi-key-file <path>", "path to the Kalshi RSA private key")
      .option("--kalshi-key <pem>", "Kalshi RSA private key PEM (inline)")
      .option("--polymarket-key <hex>", "Polygon private key (0x…)")
      .option("--poly-api-key <k>", "Polymarket L2 API key")
      .option("--poly-api-secret <s>", "Polymarket L2 API secret")
      .option("--poly-api-passphrase <p>", "Polymarket L2 API passphrase"),
  ).action((o, cmd) => execute(ctxOf(cmd), () => account.runLogin(ctxOf(cmd), o)));

  withGlobals(program.command("logout").description("Remove stored credentials for a venue")).action((_o, cmd) =>
    execute(ctxOf(cmd), () => account.runLogout(ctxOf(cmd))),
  );

  withGlobals(program.command("whoami").description("Show configured credentials + paper balance")).action((_o, cmd) =>
    execute(ctxOf(cmd), () => account.runWhoami(ctxOf(cmd))),
  );

  // -- MCP bridge -----------------------------------------------------------
  const mcp = program.command("mcp").description("MCP utilities");
  withGlobals(
    mcp
      .command("call")
      .description("Call any MCP tool (escape hatch to all tools)")
      .argument("<tool>", "tool name")
      .option("--args <json>", "tool arguments as a JSON object"),
  ).action((tool, o, cmd) => execute(ctxOf(cmd), () => wc26.runMcpCall(ctxOf(cmd), tool, parseArgsJson(o.args))));
  withGlobals(
    mcp
      .command("add")
      .description("Print MCP server config for an agent")
      .option("--target <agent>", "claude-code|claude-desktop|cursor", "claude-code")
      .option("--print", "just print (no side effects)"),
  ).action((o, cmd) => execute(ctxOf(cmd), () => agent.runMcpAdd(ctxOf(cmd), o)));

  // -- Agent skills ---------------------------------------------------------
  const skills = program.command("skills").description("Bundled agent skills");
  withGlobals(skills.command("list").description("List bundled skills")).action((_o, cmd) =>
    execute(ctxOf(cmd), () => agent.runSkillsList(ctxOf(cmd))),
  );
  withGlobals(
    skills
      .command("install")
      .description("Install the bundled skill into an agent's skills directory")
      .option("--target <dir>", "destination skills directory")
      .option("--force", "overwrite if present"),
  ).action((o, cmd) => execute(ctxOf(cmd), () => agent.runSkillsInstall(ctxOf(cmd), o)));

  return program;
}
