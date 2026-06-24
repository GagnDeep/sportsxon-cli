import crypto from "node:crypto";

/**
 * Kalshi API request signing. Each authenticated request sends:
 *   KALSHI-ACCESS-KEY        the API key id
 *   KALSHI-ACCESS-TIMESTAMP  current time in ms
 *   KALSHI-ACCESS-SIGNATURE  base64 RSA-PSS(SHA-256) of `${ts}${METHOD}${path}`
 *
 * The signed path includes the `/trade-api/v2` prefix and excludes the query
 * string. Padding is PSS with MGF1-SHA256 and a salt length equal to the digest
 * (32 bytes), matching Kalshi's reference implementation.
 */
export function kalshiSignature(privateKeyPem: string, timestampMs: string, method: string, path: string): string {
  const message = `${timestampMs}${method.toUpperCase()}${path}`;
  return crypto
    .sign("sha256", Buffer.from(message), {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    })
    .toString("base64");
}

/** Build the auth headers for a Kalshi request. `path` must include /trade-api/v2 and exclude the query. */
export function kalshiAuthHeaders(
  apiKeyId: string,
  privateKeyPem: string,
  method: string,
  path: string,
  now: number = Date.now(),
): Record<string, string> {
  const ts = String(now);
  return {
    "KALSHI-ACCESS-KEY": apiKeyId,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "KALSHI-ACCESS-SIGNATURE": kalshiSignature(privateKeyPem, ts, method, path),
  };
}
