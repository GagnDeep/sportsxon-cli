import { configPath } from "./paths";
import { readJson, writeJson } from "./store";

/** Top-level CLI settings (non-secret). Credentials live separately, encrypted. */
export interface Settings {
  riskAcceptedAt?: number;
  maxOrderUsd?: number;
  maxPositionUsd?: number;
  kalshiEnv?: "live" | "demo";
}

export const DEFAULTS = {
  maxOrderUsd: 500,
  maxPositionUsd: 2000,
} as const;

export function loadSettings(): Settings {
  return readJson<Settings>(configPath(), {});
}

export function saveSettings(s: Settings): void {
  writeJson(configPath(), s, 0o600);
}

export function isRiskAccepted(): boolean {
  return typeof loadSettings().riskAcceptedAt === "number";
}
