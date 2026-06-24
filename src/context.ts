import { baseUrl as resolveBaseUrl, normalizeLocale, type Locale } from "./lib/env";
import type { Venue } from "./core/exchanges/types";

/**
 * RunContext is resolved once from the global flags + environment and threaded
 * into every command. It decides the single most important thing about a run:
 * whether we are talking to a human (rich Ink TUI) or to a machine (stable,
 * scriptable headless output).
 */
export interface GlobalFlags {
  json?: boolean;
  plain?: boolean;
  color?: boolean;
  locale?: string;
  venue?: string;
  baseUrl?: string;
  yes?: boolean;
}

export interface RunContext {
  /** Emit a stable JSON envelope on stdout. */
  json: boolean;
  /** Force plain text (no Ink, no ANSI) even on a TTY. */
  plain: boolean;
  /** Whether ANSI color is allowed. */
  color: boolean;
  /** True only when we may mount the interactive Ink UI. */
  interactive: boolean;
  locale: Locale;
  venue: Venue;
  baseUrl: string;
  /** Skip interactive confirmations (required for live trading when non-TTY). */
  yes: boolean;
}

function parseVenue(input?: string): Venue {
  return input?.toLowerCase() === "polymarket" ? "polymarket" : "kalshi";
}

export function resolveContext(flags: GlobalFlags): RunContext {
  const json = flags.json === true;
  const plain = flags.plain === true;
  const isTTY = Boolean(process.stdout.isTTY);
  const noColor = Boolean(process.env.NO_COLOR);
  const isCI = Boolean(process.env.CI);

  // Interactive only when attached to a real terminal and not explicitly asked
  // for machine output. Agents/pipes/CI always get headless output.
  const interactive = isTTY && !json && !plain && !isCI;
  const color = flags.color !== false && !noColor && !json && isTTY;

  return {
    json,
    plain,
    color,
    interactive,
    locale: normalizeLocale(flags.locale),
    venue: parseVenue(flags.venue),
    baseUrl: flags.baseUrl ? flags.baseUrl.replace(/\/+$/, "") : resolveBaseUrl(),
    yes: flags.yes === true,
  };
}
