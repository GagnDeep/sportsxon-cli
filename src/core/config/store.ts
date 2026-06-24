import fs from "node:fs";
import path from "node:path";

/** Create a directory tree with private (0700) permissions. */
export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Atomic JSON write: write a temp file in the same dir then rename, so a crash
 * never leaves a half-written (or world-readable partial) file. Secrets are
 * written 0600.
 */
export function writeJson(file: string, data: unknown, mode = 0o600): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, mode);
  } catch {
    /* best-effort on platforms without chmod */
  }
}

export function fileExists(file: string): boolean {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

/** Warn if a secret file is readable by group/other (looser than 0600). */
export function permsTooOpen(file: string): boolean {
  try {
    const mode = fs.statSync(file).mode & 0o777;
    return (mode & 0o077) !== 0;
  } catch {
    return false;
  }
}
