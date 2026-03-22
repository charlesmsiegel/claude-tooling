import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SkillsSerializer } from "../../model/serializers/skills";
import { Scope } from "../../model/types";

describe("SkillsSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    fs.mkdirSync(path.join(tmpDir, "skills"), { recursive: true });
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("reads a skill markdown file", () => {
    const skillPath = path.join(tmpDir, "skills", "tdd.md");
    fs.writeFileSync(skillPath, [
      "---",
      "name: tdd",
      "description: Test-driven development workflow",
      "---",
      "",
      "# TDD Skill",
      "",
      "Write tests first.",
    ].join("\n"));

    const result = SkillsSerializer.read(skillPath, scope);
    expect(result.type).toBe("skill");
    expect(result.name).toBe("tdd");
    expect(result.description).toBe("Test-driven development workflow");
    expect(result.content).toContain("# TDD Skill");
  });

  it("reads standalone .md skills from skills directory", () => {
    fs.writeFileSync(path.join(tmpDir, "skills", "a.md"), "---\nname: a\n---\nContent A");
    fs.writeFileSync(path.join(tmpDir, "skills", "b.md"), "---\nname: b\n---\nContent B");

    const results = SkillsSerializer.readAll(tmpDir, scope);
    expect(results).toHaveLength(2);
  });

  it("writes a skill to markdown", () => {
    const skillPath = path.join(tmpDir, "skills", "new.md");
    SkillsSerializer.write({
      id: "global:Global:skill:new",
      name: "new",
      type: "skill",
      scope,
      filePath: skillPath,
      description: "A new skill",
      content: "# New\n\nDo things.",
    });

    const written = fs.readFileSync(skillPath, "utf-8");
    expect(written).toContain("name: new");
    expect(written).toContain("description: A new skill");
    expect(written).toContain("# New");
  });

  it("treats top-level directories as single skills via SKILL.md", () => {
    // Create a directory-based skill with SKILL.md and many module files
    const skillDir = path.join(tmpDir, "skills", "wod-toolkit");
    fs.mkdirSync(path.join(skillDir, "modules", "v20"), { recursive: true });
    fs.mkdirSync(path.join(skillDir, "modules", "shared"), { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: wod-toolkit\ndescription: World of Darkness toolkit\n---\n\n# WoD Toolkit"
    );
    fs.writeFileSync(
      path.join(skillDir, "modules", "v20", "vampire.md"),
      "# Vampire module"
    );
    fs.writeFileSync(
      path.join(skillDir, "modules", "v20", "werewolf.md"),
      "# Werewolf module"
    );
    fs.writeFileSync(
      path.join(skillDir, "modules", "shared", "spirit.md"),
      "# Spirit module"
    );

    const results = SkillsSerializer.readAll(tmpDir, scope);

    // Should find exactly 1 skill (the directory), NOT 4 individual .md files
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("wod-toolkit");
    expect(results[0].description).toBe("World of Darkness toolkit");
    expect(results[0].filePath).toBe(path.join(skillDir, "SKILL.md"));
  });

  it("mixes standalone skills and directory-based skills", () => {
    // Standalone skill
    fs.writeFileSync(
      path.join(tmpDir, "skills", "standalone.md"),
      "---\nname: standalone\n---\nStandalone content"
    );

    // Directory-based skill
    const skillDir = path.join(tmpDir, "skills", "complex-skill");
    fs.mkdirSync(path.join(skillDir, "modules"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: complex-skill\n---\n# Complex"
    );
    fs.writeFileSync(
      path.join(skillDir, "modules", "part1.md"),
      "# Part 1"
    );

    const results = SkillsSerializer.readAll(tmpDir, scope);
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["complex-skill", "standalone"]);
  });

  it("skips directories without SKILL.md", () => {
    // Directory without SKILL.md — should be skipped
    const noEntryDir = path.join(tmpDir, "skills", "no-entry");
    fs.mkdirSync(noEntryDir, { recursive: true });
    fs.writeFileSync(
      path.join(noEntryDir, "random.md"),
      "# Random file"
    );

    // Standalone skill
    fs.writeFileSync(
      path.join(tmpDir, "skills", "valid.md"),
      "---\nname: valid\n---\nValid content"
    );

    const results = SkillsSerializer.readAll(tmpDir, scope);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("valid");
  });

  it("handles skill without frontmatter", () => {
    const skillPath = path.join(tmpDir, "skills", "plain.md");
    fs.writeFileSync(skillPath, "Just content, no frontmatter.");

    const result = SkillsSerializer.read(skillPath, scope);
    expect(result.name).toBe("plain");
    expect(result.content).toBe("Just content, no frontmatter.");
  });

  it("handles missing skills directory gracefully", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-empty-"));
    const results = SkillsSerializer.readAll(emptyDir, scope);
    expect(results).toEqual([]);
    fs.rmSync(emptyDir, { recursive: true });
  });
});
