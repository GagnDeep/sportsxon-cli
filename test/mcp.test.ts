import { describe, it, expect } from "vitest";
import { McpClient } from "../src/core/mcp/client";
import { unwrap, callToolData } from "../src/core/mcp/toolcall";
import { McpRateLimitError } from "../src/core/mcp/errors";
import { CliError } from "../src/lib/exit";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function clientReturning(response: Response): McpClient {
  return new McpClient("https://example.test", { fetchImpl: async () => response });
}

describe("McpClient.rpc", () => {
  it("returns the result on success", async () => {
    const c = clientReturning(jsonResponse({ jsonrpc: "2.0", id: 1, result: { tools: [{ name: "x" }] } }));
    const tools = await c.listTools();
    expect(tools).toEqual([{ name: "x" }]);
  });

  it("throws a rate-limit error on 429", async () => {
    const c = clientReturning(
      jsonResponse({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "rl" } }, { status: 429, headers: { "retry-after": "5" } }),
    );
    await expect(c.rpc("tools/list")).rejects.toBeInstanceOf(McpRateLimitError);
  });
});

describe("unwrap", () => {
  it("prefers structuredContent", () => {
    const out = unwrap({ structuredContent: { a: 1 }, content: [{ type: "text", text: "ignored" }] });
    expect(out.data).toEqual({ a: 1 });
    expect(out.isError).toBe(false);
  });

  it("parses JSON text when no structuredContent (older server)", () => {
    const out = unwrap({ content: [{ type: "text", text: '[{"slug":"a1"}]' }] });
    expect(out.data).toEqual([{ slug: "a1" }]);
  });

  it("collects resource links", () => {
    const out = unwrap({
      structuredContent: { ok: true },
      content: [{ type: "resource_link", uri: "https://x/replays/a1", name: "Replay" }],
    });
    expect(out.links[0]?.uri).toContain("/replays/");
  });
});

describe("callToolData", () => {
  it("turns isError into a CliError carrying the hint text", async () => {
    const c = new McpClient("https://example.test", {
      fetchImpl: async () =>
        jsonResponse({
          jsonrpc: "2.0",
          id: 1,
          result: { isError: true, content: [{ type: "text", text: "not found — use search" }] },
        }),
    });
    await expect(callToolData(c, "get_match", { slug: "z" })).rejects.toBeInstanceOf(CliError);
  });

  it("treats a lone {error} result as an error (older server)", async () => {
    const c = new McpClient("https://example.test", {
      fetchImpl: async () =>
        jsonResponse({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: '{"error":"match not found"}' }] } }),
    });
    await expect(callToolData(c, "get_match", { slug: "z" })).rejects.toBeInstanceOf(CliError);
  });
});
