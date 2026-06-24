import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { credentialsDir } from "./paths";
import { ensureDir, fileExists, permsTooOpen, readJson, writeJson } from "./store";
import { env } from "../../lib/env";
import { CliError, ExitCode } from "../../lib/exit";
import type { Venue } from "../exchanges/types";

export interface KalshiCreds {
  apiKeyId: string;
  privateKeyPem: string;
}

export interface PolymarketCreds {
  privateKey: string; // 0x… Polygon EOA key
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string; // Polymarket L2 passphrase
}

// --- encryption at rest (optional, AES-256-GCM, scrypt-derived key) ---------

interface EncBlob {
  enc: true;
  kdf: "scrypt";
  salt: string;
  iv: string;
  tag: string;
  data: string;
}

function passphrase(): string | undefined {
  return env("SPORTSXON_PASSPHRASE");
}

function encrypt(obj: unknown, pass: string): EncBlob {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pass, salt, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return {
    enc: true,
    kdf: "scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

function decrypt<T>(blob: EncBlob, pass: string): T {
  const key = crypto.scryptSync(pass, Buffer.from(blob.salt, "base64"), 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}

function credFile(venue: Venue): string {
  return path.join(credentialsDir(), `${venue}.json`);
}

function readCreds<T>(venue: Venue): T | null {
  const file = credFile(venue);
  if (!fileExists(file)) return null;
  if (permsTooOpen(file)) {
    process.stderr.write(`warning: ${file} is readable by others; run: chmod 600 ${file}\n`);
  }
  const raw = readJson<EncBlob | T>(file, null as unknown as T);
  if (raw && typeof raw === "object" && (raw as EncBlob).enc === true) {
    const pass = passphrase();
    if (!pass) {
      throw new CliError(
        `${venue} credentials are encrypted.`,
        ExitCode.AUTH,
        "Set SPORTSXON_PASSPHRASE to decrypt them.",
      );
    }
    try {
      return decrypt<T>(raw as EncBlob, pass);
    } catch {
      throw new CliError(`Could not decrypt ${venue} credentials (wrong passphrase?).`, ExitCode.AUTH);
    }
  }
  return raw as T;
}

function saveCreds(venue: Venue, creds: unknown): void {
  ensureDir(credentialsDir());
  const pass = passphrase();
  const payload = pass ? encrypt(creds, pass) : creds;
  writeJson(credFile(venue), payload, 0o600);
}

// --- public API -------------------------------------------------------------

/** Resolve Kalshi credentials: env overrides win, else the stored file. */
export function getKalshiCreds(): KalshiCreds | null {
  const id = env("KALSHI_API_KEY_ID");
  const pem = env("KALSHI_PRIVATE_KEY");
  const pemFile = env("KALSHI_PRIVATE_KEY_FILE");
  if (id && (pem || pemFile)) {
    const privateKeyPem = pem ?? fs.readFileSync(pemFile!, "utf8");
    return { apiKeyId: id, privateKeyPem };
  }
  return readCreds<KalshiCreds>("kalshi");
}

export function saveKalshiCreds(creds: KalshiCreds): void {
  if (!/BEGIN[\s\S]*PRIVATE KEY/.test(creds.privateKeyPem)) {
    throw new CliError("The Kalshi private key does not look like a PEM file.", ExitCode.USAGE);
  }
  saveCreds("kalshi", creds);
}

export function getPolymarketCreds(): PolymarketCreds | null {
  const pk = env("POLYMARKET_PRIVATE_KEY");
  if (pk) {
    return {
      privateKey: pk,
      apiKey: env("POLYMARKET_API_KEY"),
      apiSecret: env("POLYMARKET_API_SECRET"),
      apiPassphrase: env("POLYMARKET_API_PASSPHRASE"),
    };
  }
  return readCreds<PolymarketCreds>("polymarket");
}

export function savePolymarketCreds(creds: PolymarketCreds): void {
  saveCreds("polymarket", creds);
}

export function clearCreds(venue: Venue): boolean {
  const file = credFile(venue);
  if (!fileExists(file)) return false;
  fs.rmSync(file);
  return true;
}

export interface CredStatus {
  venue: Venue;
  configured: boolean;
  source: "env" | "file" | "none";
  detail?: string;
}

export function credStatus(): CredStatus[] {
  const k = getKalshiCreds();
  const p = getPolymarketCreds();
  return [
    {
      venue: "kalshi",
      configured: !!k,
      source: env("KALSHI_API_KEY_ID") ? "env" : k ? "file" : "none",
      detail: k ? `key ${k.apiKeyId.slice(0, 8)}…` : undefined,
    },
    {
      venue: "polymarket",
      configured: !!p,
      source: env("POLYMARKET_PRIVATE_KEY") ? "env" : p ? "file" : "none",
      detail: p?.apiKey ? `api ${p.apiKey.slice(0, 8)}…` : p ? "wallet only" : undefined,
    },
  ];
}
