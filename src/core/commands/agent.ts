import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pc from "picocolors";
import type { RunContext } from "../../context";
import type { CommandOutput } from "../../render/headless";
import { CliError, ExitCode } from "../../lib/exit";
import { SKILLS, getSkill, renderSkill } from "../skill-content";

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
  const skills = SKILLS.map((s) => ({ name: s.name, description: s.description }));
  return {
    data: { skills },
    render: (color) =>
      skills
        .map((s) => `${color ? pc.cyan(s.name) : s.name}\n  ${color ? pc.dim(s.description) : s.description}`)
        .join("\n\n"),
  };
}

export function runSkillsInstall(
  ctx: RunContext,
  o: { target?: string; force?: boolean; all?: boolean },
  name?: string,
): CommandOutput {
  const baseDir = o.target
    ? o.target.startsWith("~")
      ? o.target.replace(/^~/, os.homedir())
      : o.target
    : defaultSkillsDir();

  // Resolve which skills to install: a named one, or all (the default).
  let toInstall = SKILLS;
  if (name) {
    const one = getSkill(name);
    if (!one) {
      throw new CliError(
        `Unknown skill '${name}'.`,
        ExitCode.USAGE,
        `Available: ${SKILLS.map((s) => s.name).join(", ")}`,
      );
    }
    toInstall = [one];
  } else if (!o.all) {
    // No name and no --all: still install all (there are several), but say so.
    toInstall = SKILLS;
  }

  const installed: string[] = [];
  const skipped: string[] = [];
  for (const skill of toInstall) {
    const skillDir = path.join(baseDir, skill.name);
    const file = path.join(skillDir, "SKILL.md");
    if (fs.existsSync(file) && !o.force) {
      skipped.push(file);
      continue;
    }
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(file, renderSkill(skill), "utf8");
    installed.push(file);
  }

  if (installed.length === 0 && skipped.length > 0) {
    throw new CliError(
      `All ${skipped.length} skill file(s) already exist.`,
      ExitCode.USAGE,
      "Pass --force to overwrite.",
    );
  }

  return {
    data: { installed, skipped, dir: baseDir },
    render: (color) => {
      const ok = color ? pc.green("✓ ") : "✓ ";
      const lines = installed.map((f) => `${ok}${f}`);
      if (skipped.length) {
        lines.push(
          (color ? pc.yellow("• ") : "• ") +
            `skipped ${skipped.length} existing (use --force to overwrite)`,
        );
      }
      lines.push(color ? pc.dim("Restart your agent to pick the skills up.") : "Restart your agent to pick the skills up.");
      return lines.join("\n");
    },
  };
}
