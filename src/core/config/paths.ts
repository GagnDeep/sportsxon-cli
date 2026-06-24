import os from "node:os";
import path from "node:path";

/** Resolve the per-user config directory (XDG on Linux/mac, APPDATA on Windows). */
export function configDir(): string {
  const override = process.env.SPORTSXON_CONFIG_DIR;
  if (override) return override;
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return path.join(xdg, "sportsxon");
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "sportsxon");
  }
  return path.join(os.homedir(), ".config", "sportsxon");
}

export const paperPath = () => path.join(configDir(), "paper.json");
export const configPath = () => path.join(configDir(), "config.json");
export const credentialsDir = () => path.join(configDir(), "credentials");
