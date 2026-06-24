import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { SKILLS, getSkill, renderSkill, SKILL_NAME, SKILL_MD } from "../src/core/skill-content";
import { runSkillsInstall, runSkillsList } from "../src/core/commands/agent";
import type { RunContext } from "../src/context";

const ctx: RunContext = {
  json: false,
  plain: false,
  color: false,
  interactive: false,
  locale: "en",
  venue: "kalshi",
  baseUrl: "https://sportsxon.com",
  yes: false,
};

const tmpDirs: string[] = [];
function scratch(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sx-skills-"));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe("skill registry", () => {
  it("ships the full suite with valid, unique, well-formed entries", () => {
    const names = SKILLS.map((s) => s.name);
    expect(names).toEqual([
      "sportsxon-wc26",
      "sportsxon-kalshi",
      "sportsxon-polymarket",
      "sportsxon-prediction-markets",
      "sportsxon-paper-trading",
    ]);
    expect(new Set(names).size).toBe(names.length); // unique
    for (const s of SKILLS) {
      expect(s.description.length).toBeGreaterThan(40);
      expect(s.description).not.toContain("\n"); // frontmatter is single-line
      expect(s.body.trim().length).toBeGreaterThan(400);
      const md = renderSkill(s);
      expect(md.startsWith(`---\nname: ${s.name}\n`)).toBe(true);
      expect(md).toContain("sportsxon"); // grounded in the CLI
    }
  });

  it("keeps the back-compat overview export", () => {
    expect(SKILL_NAME).toBe("sportsxon-wc26");
    expect(SKILL_MD).toContain("World Cup 2026");
    expect(getSkill("sportsxon-kalshi")?.name).toBe("sportsxon-kalshi");
    expect(getSkill("nope")).toBeUndefined();
  });

  it("installs all skills into a target dir", () => {
    const dir = scratch();
    const out = runSkillsInstall(ctx, { target: dir });
    const data = out.data as { installed: string[] };
    expect(data.installed.length).toBe(SKILLS.length);
    for (const s of SKILLS) {
      const f = path.join(dir, s.name, "SKILL.md");
      expect(fs.existsSync(f)).toBe(true);
      expect(fs.readFileSync(f, "utf8")).toContain(`name: ${s.name}`);
    }
  });

  it("installs a single named skill and rejects unknown names", () => {
    const dir = scratch();
    const out = runSkillsInstall(ctx, { target: dir }, "sportsxon-polymarket");
    expect((out.data as { installed: string[] }).installed.length).toBe(1);
    expect(fs.existsSync(path.join(dir, "sportsxon-polymarket", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "sportsxon-kalshi", "SKILL.md"))).toBe(false);
    expect(() => runSkillsInstall(ctx, { target: dir }, "bogus")).toThrow(/Unknown skill/);
  });

  it("lists every skill", () => {
    const out = runSkillsList(ctx);
    expect((out.data as { skills: unknown[] }).skills.length).toBe(SKILLS.length);
  });
});
