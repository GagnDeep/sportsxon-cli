import { CLIENT_PROTOCOL } from "./protocol";
import { McpAuthError, McpError, McpRateLimitError, parseRateLimit, type RateLimitInfo } from "./errors";

interface RpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ToolDescriptor {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  annotations?: Record<string, unknown>;
}

export interface ToolCallResult {
  content?: Array<{ type: string; text?: string; uri?: string; name?: string; [k: string]: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
}

/**
 * Minimal JSON-RPC client for the public Sportsxon MCP endpoint. The server is
 * stateless (one POST = one complete request), so there is no session to set up:
 * we simply advertise the protocol version via the header and call methods.
 */
export class McpClient {
  readonly endpoint: string;
  lastRateLimit: RateLimitInfo = {};
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, opts?: { timeoutMs?: number; fetchImpl?: typeof fetch }) {
    this.endpoint = `${baseUrl.replace(/\/+$/, "")}/api/mcp`;
    this.timeoutMs = opts?.timeoutMs ?? 20_000;
    this.fetchImpl = opts?.fetchImpl ?? fetch;
  }

  async rpc<T = unknown>(method: string, params?: unknown): Promise<T> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "MCP-Protocol-Version": CLIENT_PROTOCOL,
          "user-agent": "sportsxon-cli",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: ac.signal,
      });
    } catch (e) {
      throw new McpError(
        `Could not reach the API at ${this.endpoint}: ${(e as Error).message}`,
        undefined,
        "Check your connection or override the host with SPORTSXON_BASE_URL.",
      );
    } finally {
      clearTimeout(timer);
    }

    this.lastRateLimit = parseRateLimit(res.headers);
    if (res.status === 429) throw new McpRateLimitError(this.lastRateLimit);
    if (res.status === 401 || res.status === 403) throw new McpAuthError();

    let body: RpcResponse;
    try {
      body = (await res.json()) as RpcResponse;
    } catch {
      throw new McpError(`API returned a non-JSON response (HTTP ${res.status}).`);
    }
    if (!res.ok && !body.error) {
      throw new McpError(`API error (HTTP ${res.status}).`);
    }
    if (body.error) throw new McpError(body.error.message, body.error.code);
    return body.result as T;
  }

  async listTools(): Promise<ToolDescriptor[]> {
    const r = await this.rpc<{ tools: ToolDescriptor[] }>("tools/list");
    return r.tools ?? [];
  }

  callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    return this.rpc<ToolCallResult>("tools/call", { name, arguments: args });
  }

  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; text?: string }> }> {
    return this.rpc("resources/read", { uri });
  }
}
