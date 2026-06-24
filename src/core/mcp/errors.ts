import { CliError, ExitCode } from "../../lib/exit";

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number; // unix seconds
  retryAfter?: number; // seconds
}

export class McpError extends CliError {
  readonly rpcCode?: number;
  constructor(message: string, rpcCode?: number, hint?: string) {
    super(message, ExitCode.GENERIC, hint);
    this.name = "McpError";
    this.rpcCode = rpcCode;
  }
}

export class McpAuthError extends CliError {
  constructor(message = "The API rejected the request (401/403).") {
    super(message, ExitCode.AUTH, "The Sportsxon data API is public; check SPORTSXON_BASE_URL.");
    this.name = "McpAuthError";
  }
}

export class McpRateLimitError extends CliError {
  readonly info: RateLimitInfo;
  constructor(info: RateLimitInfo) {
    const wait = info.retryAfter ?? (info.reset ? Math.max(0, info.reset - Math.floor(Date.now() / 1000)) : undefined);
    super(
      `Rate limited by the API${wait != null ? ` — retry in ${wait}s` : ""}.`,
      ExitCode.RATE_LIMIT,
      "Slow down requests or pass --json and retry with backoff.",
    );
    this.name = "McpRateLimitError";
    this.info = info;
  }
}

export function parseRateLimit(headers: Headers): RateLimitInfo {
  const num = (h: string) => {
    const v = headers.get(h);
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    limit: num("x-ratelimit-limit"),
    remaining: num("x-ratelimit-remaining"),
    reset: num("x-ratelimit-reset"),
    retryAfter: num("retry-after"),
  };
}
