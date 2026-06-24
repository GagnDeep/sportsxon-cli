import pc from "picocolors";
import type { RunContext } from "../context";

/**
 * Every command produces a CommandOutput. In `--json` mode we emit a stable
 * envelope `{ ok, data }`; otherwise we print the human renderer (or pretty
 * JSON if a command supplies none). This is the seam that makes one core serve
 * both agents and people.
 */
export interface CommandOutput {
  /** Machine payload — emitted verbatim under `data` in JSON mode. */
  data: unknown;
  /** Human-facing text for the terminal; receives whether color is enabled. */
  render?: (color: boolean) => string;
}

export function emit(ctx: RunContext, out: CommandOutput): void {
  if (ctx.json) {
    process.stdout.write(JSON.stringify({ ok: true, data: out.data }) + "\n");
    return;
  }
  const text = out.render ? out.render(ctx.color) : prettyJson(out.data, ctx.color);
  process.stdout.write(text + "\n");
}

export function emitError(ctx: RunContext, message: string, hint?: string): void {
  if (ctx.json) {
    process.stdout.write(JSON.stringify({ ok: false, error: { message, hint } }) + "\n");
    return;
  }
  process.stderr.write((ctx.color ? pc.red(pc.bold("error: ")) : "error: ") + message + "\n");
  if (hint) process.stderr.write((ctx.color ? pc.dim("hint:  ") : "hint:  ") + hint + "\n");
}

export function prettyJson(value: unknown, color: boolean): string {
  const s = JSON.stringify(value, null, 2);
  return color ? pc.dim(s) : s;
}
