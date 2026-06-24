import os from "node:os";
import fs from "node:fs";
import pc from "picocolors";
import type { RunContext } from "../../context";
import type { CommandOutput } from "../../render/headless";
import { keyValues, table, type Column } from "../../render/tables";
import { CliError, ExitCode } from "../../lib/exit";
import { promptLine } from "../../lib/prompt";
import { env } from "../../lib/env";
import {
  clearCreds,
  credStatus,
  saveKalshiCreds,
  savePolymarketCreds,
  type CredStatus,
} from "../config/credentials";
import { loadPaper } from "../paper/store";

const expand = (p: string) => (p.startsWith("~") ? p.replace(/^~/, os.homedir()) : p);

function encNote(): string {
  return env("SPORTSXON_PASSPHRASE")
    ? " (encrypted at rest)"
    : " (stored 0600, unencrypted — set SPORTSXON_PASSPHRASE to encrypt)";
}

export interface LoginFlags {
  kalshiKeyId?: string;
  kalshiKey?: string;
  kalshiKeyFile?: string;
  polymarketKey?: string;
  polyApiKey?: string;
  polyApiSecret?: string;
  polyApiPassphrase?: string;
}

export async function runLogin(ctx: RunContext, o: LoginFlags): Promise<CommandOutput> {
  if (ctx.venue === "kalshi") {
    let id = o.kalshiKeyId;
    let pem = o.kalshiKey;
    if (!pem && o.kalshiKeyFile) pem = fs.readFileSync(expand(o.kalshiKeyFile), "utf8");
    if ((!id || !pem) && ctx.interactive) {
      id = id || (await promptLine("Kalshi API key id: "));
      if (!pem) {
        const f = await promptLine("Path to Kalshi private key (.key/.pem): ");
        pem = fs.readFileSync(expand(f), "utf8");
      }
    }
    if (!id || !pem) {
      throw new CliError(
        "Provide --kalshi-key-id and --kalshi-key-file (or run interactively).",
        ExitCode.USAGE,
      );
    }
    saveKalshiCreds({ apiKeyId: id, privateKeyPem: pem });
    return {
      data: { venue: "kalshi", ok: true },
      render: (color) => (color ? pc.green("✓ ") : "✓ ") + "Kalshi credentials saved" + encNote() + ".",
    };
  }

  // polymarket
  let pk = o.polymarketKey;
  if (!pk && ctx.interactive) pk = await promptLine("Polygon private key (0x…): ");
  if (!pk) throw new CliError("Provide --polymarket-key (a Polygon private key).", ExitCode.USAGE);
  savePolymarketCreds({
    privateKey: pk,
    apiKey: o.polyApiKey,
    apiSecret: o.polyApiSecret,
    apiPassphrase: o.polyApiPassphrase,
  });
  return {
    data: { venue: "polymarket", ok: true },
    render: (color) => (color ? pc.green("✓ ") : "✓ ") + "Polymarket credentials saved" + encNote() + ".",
  };
}

export function runLogout(ctx: RunContext): CommandOutput {
  const removed = clearCreds(ctx.venue);
  return {
    data: { venue: ctx.venue, removed },
    render: (color) =>
      removed
        ? (color ? pc.green("✓ ") : "✓ ") + `Removed ${ctx.venue} credentials.`
        : color
          ? pc.dim(`No stored ${ctx.venue} credentials.`)
          : `No stored ${ctx.venue} credentials.`,
  };
}

export function runWhoami(ctx: RunContext): CommandOutput {
  const status = credStatus();
  const paper = loadPaper();
  return {
    data: { credentials: status, paperCashUsd: paper.cashUsd, baseUrl: ctx.baseUrl },
    render: (color) => {
      const cols: Column<CredStatus>[] = [
        { header: "Venue", get: (s) => s.venue },
        {
          header: "Credentials",
          get: (s) => (s.configured ? `configured (${s.source})` : "not configured"),
          paint: (v, s) => (color ? (s.configured ? pc.green(v) : pc.dim(v)) : v),
        },
        { header: "Detail", get: (s) => s.detail ?? "—" },
      ];
      return (
        keyValues(
          [
            ["API base", ctx.baseUrl],
            ["Paper cash", `$${paper.cashUsd.toFixed(2)}`],
          ],
          color,
        ) +
        "\n\n" +
        table(status, cols, color)
      );
    },
  };
}
