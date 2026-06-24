import pc from "picocolors";
import type { RunContext } from "../../context";
import type { CommandOutput } from "../../render/headless";
import { table, keyValues, type Column } from "../../render/tables";
import { McpClient } from "../mcp/client";
import { callToolData } from "../mcp/toolcall";
import { McpError } from "../mcp/errors";

export function mcp(ctx: RunContext): McpClient {
  return new McpClient(ctx.baseUrl);
}

// ---------------------------------------------------------------------------
// Shapes (the match VM is identical across server versions)
// ---------------------------------------------------------------------------

export interface Match {
  slug: string;
  stage: string;
  matchday: number | null;
  kickoffUtc: string | null;
  status: string;
  groupLetter: string | null;
  venueCode?: string | null;
  venueCity?: string | null;
  venueStadium?: string | null;
  homeTeamCode: string;
  homeTeamName: string;
  homeFlag?: string | null;
  awayTeamCode: string;
  awayTeamName: string;
  awayFlag?: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
}

const PLAYED = new Set(["ft", "aet", "pen", "live", "ht"]);
const LIVE = new Set(["live", "ht"]);

function asArray<T = unknown>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>)[key])) {
    return (data as Record<string, T[]>)[key]!;
  }
  return [];
}

function fmtKickoff(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return (
    d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) + "Z"
  );
}

function fmtScore(m: Match): string {
  if (m.homeGoals != null && m.awayGoals != null) return `${m.homeGoals}-${m.awayGoals}`;
  return "v";
}

function team(flag: string | null | undefined, name: string): string {
  return `${flag ? flag + " " : ""}${name}`;
}

function statusPaint(value: string, m: Match, color: boolean): string {
  if (!color) return value;
  if (LIVE.has(m.status)) return pc.green(pc.bold(value));
  if (m.status === "ft" || m.status === "aet" || m.status === "pen") return pc.dim(value);
  return value;
}

export function matchTable(matches: Match[], color: boolean): string {
  const cols: Column<Match>[] = [
    { header: "Kickoff", get: (m) => fmtKickoff(m.kickoffUtc) },
    { header: "St", get: (m) => m.status.toUpperCase(), paint: (v, m) => statusPaint(v, m, color) },
    { header: "Home", get: (m) => team(m.homeFlag, m.homeTeamName), align: "right" },
    { header: "Score", get: (m) => fmtScore(m), paint: (v, m) => (color && PLAYED.has(m.status) ? pc.bold(v) : v) },
    { header: "Away", get: (m) => team(m.awayFlag, m.awayTeamName) },
    { header: "Venue", get: (m) => m.venueCity ?? m.venueCode ?? "" },
    { header: "Slug", get: (m) => m.slug, paint: (v) => (color ? pc.dim(v) : v) },
  ];
  return table(matches, cols, color);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** Fetch the live board as a plain Match[] (used by the CLI and the TUI). */
export async function fetchLive(ctx: RunContext): Promise<Match[]> {
  const client = mcp(ctx);
  try {
    const r = await callToolData(client, "list_live_matches", { locale: ctx.locale });
    return asArray<Match>(r.data, "matches");
  } catch (e) {
    if (e instanceof McpError && e.rpcCode === -32602) {
      const r = await callToolData(client, "list_matches", { status: "live", limit: 64, locale: ctx.locale });
      return asArray<Match>(r.data, "matches");
    }
    throw e;
  }
}

/** Fetch a fixtures/results list as a plain Match[] (used by the TUI Live tab). */
export async function fetchMatches(
  ctx: RunContext,
  params: { status?: string; group?: string; team?: string; stage?: string; limit?: number } = {},
): Promise<Match[]> {
  const client = mcp(ctx);
  const r = await callToolData(client, "list_matches", { limit: 48, locale: ctx.locale, ...params });
  return asArray<Match>(r.data, "matches");
}

export async function runLive(ctx: RunContext, slug?: string): Promise<CommandOutput> {
  const client = mcp(ctx);
  if (slug) {
    const { data } = await callToolData(client, "live_score", { slug, locale: ctx.locale });
    const m = ((data as Record<string, unknown>)?.match ?? data) as Match;
    return {
      data,
      render: (color) =>
        `${team(m.homeFlag, m.homeTeamName)}  ${color ? pc.bold(fmtScore(m)) : fmtScore(m)}  ${team(m.awayFlag, m.awayTeamName)}` +
        `   ${color ? pc.dim(`(${m.status.toUpperCase()})`) : `(${m.status.toUpperCase()})`}`,
    };
  }
  const matches = await fetchLive(ctx);
  return {
    data: { matches },
    render: (color) =>
      matches.length === 0
        ? color
          ? pc.dim("No matches are live right now.")
          : "No matches are live right now."
        : matchTable(matches, color),
  };
}

export async function runMatchesList(
  ctx: RunContext,
  opts: { stage?: string; status?: string; group?: string; team?: string; limit?: number; cursor?: string },
): Promise<CommandOutput> {
  const args: Record<string, unknown> = { locale: ctx.locale };
  if (opts.stage) args.stage = opts.stage;
  if (opts.status) args.status = opts.status;
  if (opts.group) args.groupLetter = opts.group.toUpperCase();
  if (opts.team) args.teamCode = opts.team.toUpperCase();
  if (opts.limit) args.limit = opts.limit;
  if (opts.cursor) args.cursor = opts.cursor;

  const { data } = await callToolData(mcp(ctx), "list_matches", args);
  const matches = asArray<Match>(data, "matches");
  const nextCursor = (data as Record<string, unknown>)?.nextCursor ?? null;
  return {
    data,
    render: (color) => {
      const body = matchTable(matches, color);
      if (nextCursor != null) {
        const more = `more: --cursor ${nextCursor}`;
        return body + "\n" + (color ? pc.dim(more) : more);
      }
      return body;
    },
  };
}

export async function runMatchGet(ctx: RunContext, slug: string): Promise<CommandOutput> {
  const { data } = await callToolData(mcp(ctx), "get_match", { slug, locale: ctx.locale });
  const d = data as Record<string, unknown>;
  const m = (d.match ?? data) as Match;
  const events = asArray<Record<string, unknown>>(d.events, "events");
  return {
    data,
    render: (color) => {
      const head = keyValues(
        [
          ["Match", `${team(m.homeFlag, m.homeTeamName)} ${fmtScore(m)} ${team(m.awayFlag, m.awayTeamName)}`],
          ["Status", m.status.toUpperCase()],
          ["Kickoff", fmtKickoff(m.kickoffUtc)],
          ["Stage", `${m.stage}${m.groupLetter ? ` (Group ${m.groupLetter})` : ""}`],
          ["Venue", [m.venueStadium, m.venueCity].filter(Boolean).join(", ") || (m.venueCode ?? "—")],
          ["Slug", m.slug],
        ],
        color,
      );
      if (events.length === 0) return head;
      const evLines = events.slice(0, 30).map((e) => {
        const min = e.minute ?? e.min ?? "";
        const kind = (e.type ?? e.kind ?? "event") as string;
        const who = (e.playerName ?? e.player ?? e.teamCode ?? "") as string;
        return `  ${String(min).padStart(3)}'  ${kind}${who ? ` — ${who}` : ""}`;
      });
      const title = color ? pc.bold("\nEvents") : "\nEvents";
      return `${head}\n${title}\n${evLines.join("\n")}`;
    },
  };
}

export async function runStandings(ctx: RunContext, group?: string): Promise<CommandOutput> {
  const args: Record<string, unknown> = { locale: ctx.locale };
  if (group) args.group = group.toUpperCase();
  const { data } = await callToolData(mcp(ctx), "standings", args);
  const d = data as Record<string, unknown>;

  type Row = {
    pos: number;
    teamCode: string;
    teamName: string;
    flagEmoji?: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    points: number;
    qualifiedForKo?: boolean;
  };
  const groups: { group: string; standings: Row[] }[] = group
    ? [{ group: (d.group as string) ?? group.toUpperCase(), standings: (d.standings as Row[]) ?? [] }]
    : ((d.groups as { group: string; standings: Row[] }[]) ?? (Array.isArray(data) ? (data as never) : []));

  const cols: Column<Row>[] = [
    { header: "#", get: (r) => String(r.pos), align: "right" },
    { header: "Team", get: (r) => `${r.flagEmoji ? r.flagEmoji + " " : ""}${r.teamName}` },
    { header: "P", get: (r) => String(r.played), align: "right" },
    { header: "W", get: (r) => String(r.won), align: "right" },
    { header: "D", get: (r) => String(r.drawn), align: "right" },
    { header: "L", get: (r) => String(r.lost), align: "right" },
    { header: "GF", get: (r) => String(r.gf), align: "right" },
    { header: "GA", get: (r) => String(r.ga), align: "right" },
    { header: "GD", get: (r) => (r.gd > 0 ? `+${r.gd}` : String(r.gd)), align: "right" },
    { header: "Pts", get: (r) => String(r.points), align: "right", paint: (v) => (ctx.color ? pc.bold(v) : v) },
  ];
  return {
    data,
    render: (color) =>
      groups
        .map((g) => {
          const title = color ? pc.bold(pc.cyan(`Group ${g.group}`)) : `Group ${g.group}`;
          return `${title}\n${table(g.standings, cols, color)}`;
        })
        .join("\n\n"),
  };
}

export async function runTeam(ctx: RunContext, code: string, squad: boolean): Promise<CommandOutput> {
  const client = mcp(ctx);
  const { data } = await callToolData(client, "get_team", { code: code.toUpperCase(), locale: ctx.locale });
  const d = data as Record<string, unknown>;
  const t = d.team as Record<string, unknown>;
  const fixtures = asArray<Record<string, unknown>>(d.fixtures, "fixtures");

  let squadData: unknown = undefined;
  if (squad) {
    const r = await callToolData(client, "get_team_squad", { code: code.toUpperCase(), locale: ctx.locale });
    squadData = (r.data as Record<string, unknown>)?.squad ?? r.data;
  }

  return {
    data: squad ? { ...d, squad: squadData } : data,
    render: (color) => {
      const head = keyValues(
        [
          ["Team", `${(t.flagEmoji as string) ?? ""} ${(t.name as string) ?? code}`.trim()],
          ["Code", String(t.code ?? code)],
          ["Confederation", String(t.confederation ?? "—")],
          ["FIFA rank", String(t.fifaRank ?? "—")],
          ["Titles", String(t.worldCupTitles ?? 0)],
          ["Group", String(t.groupLetter ?? "—")],
          ["Host", t.isHost ? "yes" : "no"],
        ],
        color,
      );
      if (squad && Array.isArray(squadData)) {
        const cols: Column<Record<string, unknown>>[] = [
          { header: "#", get: (p) => String(p.shirtNumber ?? ""), align: "right" },
          { header: "Pos", get: (p) => String(p.position ?? "") },
          { header: "Player", get: (p) => String(p.displayName ?? p.familyName ?? "") },
        ];
        return `${head}\n\n${color ? pc.bold("Squad") : "Squad"}\n${table(squadData as Record<string, unknown>[], cols, color)}`;
      }
      const fcols: Column<Record<string, unknown>>[] = [
        { header: "MD", get: (f) => String(f.matchday ?? ""), align: "right" },
        { header: "H/A", get: (f) => (f.isHome ? "H" : "A") },
        { header: "Opponent", get: (f) => String(f.opponentName ?? f.opponentCode ?? "") },
        { header: "Kickoff", get: (f) => fmtKickoff((f.kickoffUtc as string) ?? null) },
        { header: "Slug", get: (f) => String(f.slug ?? ""), paint: (v) => (color ? pc.dim(v) : v) },
      ];
      return `${head}\n\n${color ? pc.bold("Fixtures") : "Fixtures"}\n${table(fixtures, fcols, color)}`;
    },
  };
}

export async function runPlayer(ctx: RunContext, slug: string): Promise<CommandOutput> {
  const { data } = await callToolData(mcp(ctx), "get_player", { slug, locale: ctx.locale });
  const d = data as Record<string, unknown>;
  const p = (d.player ?? data) as Record<string, unknown>;
  const stats = d.stats as Record<string, unknown> | null | undefined;
  return {
    data,
    render: (color) =>
      keyValues(
        [
          ["Player", `${(p.flagEmoji as string) ?? ""} ${(p.displayName as string) ?? slug}`.trim()],
          ["Team", String(p.teamName ?? p.teamCode ?? "—")],
          ["Position", String(p.position ?? "—")],
          ["Shirt", String(p.shirtNumber ?? "—")],
          ...(stats ? Object.entries(stats).map(([k, v]) => [k, String(v)] as [string, string]) : []),
        ],
        color,
      ),
  };
}

export async function runScorers(ctx: RunContext, assists: boolean, limit: number): Promise<CommandOutput> {
  const tool = assists ? "top_assists" : "top_scorers";
  const key = assists ? "assists" : "scorers";
  const { data } = await callToolData(mcp(ctx), tool, { limit, locale: ctx.locale });
  const rows = asArray<{ player: Record<string, unknown>; value: number }>(data, key).map((r, i) => ({
    rank: i + 1,
    ...r,
  }));
  const label = assists ? "Assists" : "Goals";
  return {
    data,
    render: (color) => {
      type R = { rank: number; player: Record<string, unknown>; value: number };
      const cols: Column<R>[] = [
        { header: "#", get: (r) => String(r.rank), align: "right" },
        { header: "Player", get: (r) => `${(r.player.flagEmoji as string) ?? ""} ${String(r.player.displayName ?? "")}`.trim() },
        { header: "Team", get: (r) => String(r.player.teamCode ?? "") },
        { header: "Pos", get: (r) => String(r.player.position ?? "") },
        { header: label, get: (r) => String(r.value), align: "right", paint: (v) => (color ? pc.bold(v) : v) },
      ];
      return table(rows, cols, color);
    },
  };
}

export async function runSearch(ctx: RunContext, q: string): Promise<CommandOutput> {
  const { data } = await callToolData(mcp(ctx), "search", { q, locale: ctx.locale });
  const d = data as { teams?: any[]; players?: any[]; matches?: any[] };
  return {
    data,
    render: (color) => {
      const section = (title: string, items: any[] | undefined, fmt: (x: any) => string) => {
        if (!items || items.length === 0) return "";
        const head = color ? pc.bold(pc.cyan(title)) : title;
        return `${head}\n` + items.map((x) => "  " + fmt(x)).join("\n");
      };
      const parts = [
        section("Teams", d.teams, (t) => `${t.name} (${t.code})`),
        section("Players", d.players, (p) => `${p.name}${p.slug ? `  ${color ? pc.dim(p.slug) : p.slug}` : ""}`),
        section("Matches", d.matches, (m) => `${m.name}${m.slug ? `  ${color ? pc.dim(m.slug) : m.slug}` : ""}`),
      ].filter(Boolean);
      return parts.length ? parts.join("\n\n") : color ? pc.dim("No results.") : "No results.";
    },
  };
}

export async function runTools(ctx: RunContext): Promise<CommandOutput> {
  const tools = await mcp(ctx).listTools();
  return {
    data: { tools },
    render: (color) => {
      const cols: Column<{ name: string; title?: string; description?: string }>[] = [
        { header: "Tool", get: (t) => t.name, paint: (v) => (color ? pc.cyan(v) : v) },
        { header: "Description", get: (t) => (t.description ?? t.title ?? "").split(". ")[0]! },
      ];
      return table(tools, cols, color);
    },
  };
}

export async function runMcpCall(ctx: RunContext, name: string, args: Record<string, unknown>): Promise<CommandOutput> {
  if (args.locale === undefined) args.locale = ctx.locale;
  const { data, links } = await callToolData(mcp(ctx), name, args);
  return {
    data: { data, links },
    render: (color) => {
      const json = JSON.stringify(data, null, 2);
      const body = color ? pc.dim(json) : json;
      if (links.length === 0) return body;
      const linkLines = links.map((l) => `  → ${l.uri}`).join("\n");
      return `${body}\n${color ? pc.cyan("links:") : "links:"}\n${linkLines}`;
    },
  };
}
