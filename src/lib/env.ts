/** Read an env var, treating empty/whitespace as unset. */
export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function envBool(name: string): boolean {
  const v = env(name)?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Base URL of the public Sportsxon API (override for staging/self-host). */
export function baseUrl(): string {
  return (env("SPORTSXON_BASE_URL") ?? "https://sportsxon.com").replace(/\/+$/, "");
}

export const SUPPORTED_LOCALES = ["en", "es", "fr", "pt", "ar", "ja"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(input?: string): Locale {
  const v = (input ?? env("SPORTSXON_LOCALE") ?? "en").toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(v) ? (v as Locale) : "en";
}
