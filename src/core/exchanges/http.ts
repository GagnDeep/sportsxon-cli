import { CliError, ExitCode } from "../../lib/exit";

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

/** Fetch JSON with a timeout and uniform error mapping. */
export async function httpJson<T>(url: string, opts: HttpOptions = {}): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 15_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { accept: "application/json", "user-agent": "sportsxon-cli", ...(opts.headers ?? {}) },
      body: opts.body,
      signal: ac.signal,
    });
  } catch (e) {
    throw new CliError(`Network error calling ${url}: ${(e as Error).message}`, ExitCode.GENERIC);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (res.status === 429) {
    throw new CliError(`Rate limited by ${new URL(url).host}.`, ExitCode.RATE_LIMIT, "Wait and retry.");
  }
  if (!res.ok) {
    throw new CliError(`HTTP ${res.status} from ${new URL(url).host}: ${text.slice(0, 160)}`, ExitCode.GENERIC);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new CliError(`Non-JSON response from ${url}.`, ExitCode.GENERIC);
  }
}

export function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Parse a value that may be a JSON-encoded array string (Polymarket Gamma). */
export function maybeJsonArray(v: unknown): unknown[] | null {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
