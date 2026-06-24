/**
 * Generate the on-disk skill mirrors under skills/<name>/SKILL.md from the
 * single source of truth in src/core/skill-content.ts. These files ship in the
 * npm tarball so the skills are browsable in the repo and packaged offline.
 *
 *   npx tsx scripts/gen-skills.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SKILLS, renderSkill } from "../src/core/skill-content";

const root = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.join(root, "..", "skills");

// Start clean so renamed/removed skills don't linger.
if (fs.existsSync(skillsDir)) fs.rmSync(skillsDir, { recursive: true, force: true });

for (const skill of SKILLS) {
  const dir = path.join(skillsDir, skill.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), renderSkill(skill), "utf8");
  // eslint-disable-next-line no-console
  console.log(`wrote skills/${skill.name}/SKILL.md`);
}
