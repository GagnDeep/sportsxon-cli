import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { kalshiSignature, kalshiAuthHeaders } from "../src/core/exchanges/kalshi-sign";

// Generate an RSA keypair once; verify our signatures with the matching public
// key + identical PSS params. This proves the signing is correct RSA-PSS(SHA-256)
// without needing Kalshi's secret reference vector.
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

function verify(message: string, signatureB64: string): boolean {
  return crypto.verify(
    "sha256",
    Buffer.from(message),
    { key: publicPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST },
    Buffer.from(signatureB64, "base64"),
  );
}

describe("kalshiSignature", () => {
  it("produces a verifiable RSA-PSS signature over `${ts}${METHOD}${path}`", () => {
    const ts = "1700000000000";
    const method = "GET";
    const path = "/trade-api/v2/portfolio/balance";
    const sig = kalshiSignature(privatePem, ts, method, path);
    expect(verify(`${ts}${method}${path}`, sig)).toBe(true);
    // wrong message must not verify
    expect(verify(`${ts}POST${path}`, sig)).toBe(false);
  });

  it("uppercases the method in auth headers and sets all three", () => {
    const headers = kalshiAuthHeaders("key-123", privatePem, "post", "/trade-api/v2/portfolio/orders", 1700000000001);
    expect(headers["KALSHI-ACCESS-KEY"]).toBe("key-123");
    expect(headers["KALSHI-ACCESS-TIMESTAMP"]).toBe("1700000000001");
    expect(verify(`1700000000001POST/trade-api/v2/portfolio/orders`, headers["KALSHI-ACCESS-SIGNATURE"]!)).toBe(true);
  });
});
