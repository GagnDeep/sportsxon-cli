import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pc from "picocolors";
import type { RunContext } from "../../context";
import type { CommandOutput } from "../../render/headless";
import { CliError, ExitCode } from "../../lib/exit";
import { SKILL_MD, SKILL_NAME } from "../skill-content";

const MCP_PATH = "/api/mcp";

export function runMcpAdd(ctx: RunContext, o: { target?: string; print?: boolean }): CommandOutput {
  const url = `${ctx.baseUrl}${MCP_PATH}`;
  const target = (o.target ?? "claude-code").toLowerCase();

  if (target === "claude-code") {
    const cmd = `claude mcp add --transport http sportsxon ${url}`;
    return {
      data: { target, command: cmd, url },
      render: (color) =>
        `Run this to register the server with Claude Code:\n\n  ${color ? pc.cyan(cmd) : cmd}\n`,
    };
  }

  const json = {
    mcpServers: { sportsxon: { type: "streamable-http", url } },
  };
  const file =
    target === "cursor"
      ? "~/.cursor/mcp.json (or .cursor/mcp.json in your project)"
      : "your Claude Desktop config (claude_desktop_config.json)";
  const snippet = JSON.stringify(json, null, 2);
  return {
    data: { target, config: json, url },
    render: (color) =>
      `Add to ${file}:\n\n${color ? pc.dim(snippet) : snippet}\n`,
  };
}

function defaultSkillsDir(): string {
  const projectDir = path.join(process.cwd(), ".claude", "skills");
  if (fs.existsSync(path.join(process.cwd(), ".claude"))) return projectDir;
  return path.join(os.homedir(), ".claude", "skills");
}

export function runSkillsList(_ctx: RunContext): CommandOutput {
  const skills = [{ name: SKILL_NAME, description: "World Cup 2026 data + Kalshi/Polymarket trading via the sportsxon CLI/MCP." }];
  return {
    data: { skills },
    render: (color) =>
      skills.map((s) => `${color ? pc.cyan(s.name) : s.name}\n  ${color ? pc.dim(s.description) : s.description}`).join("\n"),
  };
}

export function runSkillsInstall(ctx: RunContext, o: { target?: string; force?: boolean }): CommandOutput {
  const baseDir = o.target ? (o.target.startsWith("~") ? o.target.replace(/^~/, os.homedir()) : o.target) : defaultSkillsDir();
  const skillDir = path.join(baseDir, SKILL_NAME);
  const file = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(file) && !o.force) {
    throw new CliError(`${file} already exists.`, ExitCode.USAGE, "Pass --force to overwrite.");
  }
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(file, SKILL_MD, "utf8");
  return {
    data: { installed: file },
    render: (color) =>
      (color ? pc.green("✓ ") : "✓ ") + `Installed skill '${SKILL_NAME}' to ${file}\n` +
      (color ? pc.dim("Restart your agent to pick it up.") : "Restart your agent to pick it up."),
  };
}
