import * as fs from "fs";
import * as path from "path";
import { SkillConfig, Scope } from "../types";

export class SkillsSerializer {
  static read(filePath: string, scope: Scope): SkillConfig {
    const raw = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath, ".md");

    const frontmatter: Record<string, string> = {};
    let content = raw;

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fmMatch) {
      const fmLines = fmMatch[1].split("\n");
      for (const line of fmLines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          frontmatter[key] = value;
        }
      }
      content = fmMatch[2].trim();
    }

    return {
      id: `${scope.type}:${scope.label}:skill:${frontmatter.name || fileName}`,
      name: frontmatter.name || fileName,
      type: "skill",
      scope,
      filePath,
      description: frontmatter.description,
      triggerConditions: frontmatter.trigger,
      skillType: frontmatter.type as "rigid" | "flexible" | undefined,
      content,
    };
  }

  static readAll(claudeDir: string, scope: Scope): SkillConfig[] {
    const skillsDir = path.join(claudeDir, "skills");
    if (!fs.existsSync(skillsDir)) return [];

    const results: SkillConfig[] = [];

    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      const fullPath = path.join(skillsDir, entry.name);

      if (entry.isDirectory()) {
        // Directory-based skill: look for SKILL.md entry point
        const skillMd = path.join(fullPath, "SKILL.md");
        if (fs.existsSync(skillMd)) {
          results.push(SkillsSerializer.read(skillMd, scope));
        }
      } else if (entry.name.endsWith(".md")) {
        // Standalone .md file skill
        results.push(SkillsSerializer.read(fullPath, scope));
      }
    }

    return results;
  }

  static write(skill: SkillConfig): void {
    const lines: string[] = ["---"];
    lines.push(`name: ${skill.name}`);
    if (skill.description) lines.push(`description: ${skill.description}`);
    if (skill.triggerConditions) lines.push(`trigger: ${skill.triggerConditions}`);
    if (skill.skillType) lines.push(`type: ${skill.skillType}`);
    lines.push("---");
    lines.push("");
    lines.push(skill.content);

    const dir = path.dirname(skill.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(skill.filePath, lines.join("\n"));
  }

  static delete(skill: SkillConfig): void {
    if (fs.existsSync(skill.filePath)) fs.unlinkSync(skill.filePath);
  }
}
