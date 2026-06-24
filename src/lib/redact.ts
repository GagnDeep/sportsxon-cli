/**
 * Secret hygiene helpers. Never print a full API key, private key or signature.
 */

/** Mask a credential to `prefix…last4` form, e.g. `sxk_live…ab12`. */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return "****";
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /0x[a-fA-F0-9]{64}/g, // raw 32-byte hex private keys
  /\bsxk_[a-z]+_[A-Za-z0-9_-]{8,}/g,
];

/** Redact anything that looks like a secret from a free-text string. */
export function redact(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[redacted]");
  return out;
}
