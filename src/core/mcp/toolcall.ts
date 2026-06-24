import { CliError, ExitCode } from "../../lib/exit";
import type { McpClient, ToolCallResult } from "./client";

export interface UnwrappedTool {
  data: unknown;
  text: string;
  isError: boolean;
  links: Array<{ uri: string; name?: string; description?: string }>;
}

/** Normalize a tools/call result into structured data + text + resource links. */
export function unwrap(result: ToolCallResult): UnwrappedTool {
  const content = result.content ?? [];
  const text = content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n");
  const links = content
    .filter((c) => c.type === "resource_link" && typeof c.uri === "string")
    .map((c) => ({ uri: c.uri as string, name: c.name as string | undefined, description: c.description as string | undefined }));

  let data: unknown = result.structuredContent;
  if (data === undefined) {
    // Older protocol / no structuredContent: the text is JSON for our tools.
    const trimmed = text.replace(/^\(note:[^)]*\)\s*/, "");
    try {
      data = JSON.parse(trimmed);
    } catch {
      data = text;
    }
  }
  return { data, text, isError: result.isError === true, links };
}

/**
 * Call a tool and return its structured data, turning a tool-level `isError`
 * into a CliError that carries the server's recovery hint (e.g. "use search").
 */
export async function callToolData(
  client: McpClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<UnwrappedTool> {
  const res = await client.callTool(name, args);
  const out = unwrap(res);
  if (out.isError) {
    throw new CliError(out.text || `Tool ${name} returned an error.`, ExitCode.GENERIC);
  }
  // Older server versions signal not-found as a normal result `{ error: "..." }`
  // rather than isError; surface it consistently.
  if (
    out.data &&
    typeof out.data === "object" &&
    !Array.isArray(out.data) &&
    typeof (out.data as Record<string, unknown>).error === "string" &&
    Object.keys(out.data as Record<string, unknown>).length === 1
  ) {
    throw new CliError(String((out.data as Record<string, unknown>).error), ExitCode.GENERIC, "Try `search` or `list`.");
  }
  return out;
}
