/** Stable process exit codes — part of the agent-facing contract. */
export const ExitCode = {
  OK: 0,
  GENERIC: 1,
  USAGE: 2,
  AUTH: 3,
  RATE_LIMIT: 4,
  REFUSED: 5,
} as const;
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/** An error carrying an intended exit code and an optional recovery hint. */
export class CliError extends Error {
  readonly code: ExitCode;
  readonly hint?: string;
  constructor(message: string, code: ExitCode = ExitCode.GENERIC, hint?: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.hint = hint;
  }
}

export function isCliError(e: unknown): e is CliError {
  return e instanceof CliError;
}
