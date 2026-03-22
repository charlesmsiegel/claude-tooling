import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PluginsSerializer } from "../../model/serializers/plugins";

describe("PluginsSerializer", () => {
  let tmpDir: string;
  let globalClaudeDir: string;
  let cacheDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    globalClaudeDir = path.join(tmpDir, ".claude");
    cacheDir = path.join(globalClaudeDir, "plugins", "cache");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns empty arrays when cache directory does not exist", () => {
    const skills = PluginsSerializer.readAllSkills(globalClaudeDir, [
      "org/plugin",
    ]);
    const commands = PluginsSerializer.readAllCommands(globalClaudeDir, [
      "org/plugin",
    ]);
    expect(skills).toEqual([]);
    expect(commands).toEqual([]);
  });

  it("returns empty arrays when no plugins are enabled", () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const skills = PluginsSerializer.readAllSkills(globalClaudeDir, []);
    const commands = PluginsSerializer.readAllCommands(globalClaudeDir, []);
    expect(skills).toEqual([]);
    expect(commands).toEqual([]);
  });

  it("scans skills from a plugin versioned directory", () => {
    // Create plugin structure: cache/org/plugin-name/1.0.0/skills/my-skill/SKILL.md
    const skillDir = path.join(
      cacheDir,
      "my-org",
      "my-plugin",
      "1.0.0",
      "skills",
      "my-skill",
    );
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: my-skill\ndescription: A plugin skill\n---\n\nSkill content",
    );

    const skills = PluginsSerializer.readAllSkills(globalClaudeDir, [
      "my-org/my-plugin",
    ]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("my-skill");
    expect(skills[0].description).toBe("A plugin skill");
    expect(skills[0].scope.label).toBe("plugin:my-org/my-plugin");
  });

  it("scans commands from a plugin versioned directory", () => {
    // Create plugin structure: cache/org/plugin-name/1.0.0/commands/deploy.md
    const commandsDir = path.join(
      cacheDir,
      "my-org",
      "my-plugin",
      "1.0.0",
      "commands",
    );
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(
      path.join(commandsDir, "deploy.md"),
      "---\nname: deploy\ndescription: Deploy command\n---\n\nDeploy template",
    );

    const commands = PluginsSerializer.readAllCommands(globalClaudeDir, [
      "my-org/my-plugin",
    ]);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("deploy");
    expect(commands[0].scope.label).toBe("plugin:my-org/my-plugin");
  });

  it("scans multiple skills in nested subdirectories", () => {
    const versionDir = path.join(
      cacheDir,
      "anthropic",
      "document-skills",
      "2.0.0",
      "skills",
    );
    fs.mkdirSync(path.join(versionDir, "pdf"), { recursive: true });
    fs.mkdirSync(path.join(versionDir, "frontend-design"), { recursive: true });

    fs.writeFileSync(
      path.join(versionDir, "pdf", "SKILL.md"),
      "---\nname: pdf\n---\nPDF skill",
    );
    fs.writeFileSync(
      path.join(versionDir, "frontend-design", "SKILL.md"),
      "---\nname: frontend-design\n---\nFrontend design skill",
    );

    const skills = PluginsSerializer.readAllSkills(globalClaudeDir, [
      "anthropic/document-skills",
    ]);
    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(["frontend-design", "pdf"]);
  });

  it("skips plugins whose directory does not exist in cache", () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const skills = PluginsSerializer.readAllSkills(globalClaudeDir, [
      "nonexistent/plugin",
    ]);
    expect(skills).toEqual([]);
  });

  it("handles multiple enabled plugins", () => {
    // Plugin A
    const pluginASkills = path.join(
      cacheDir,
      "orgA",
      "pluginA",
      "1.0.0",
      "skills",
    );
    fs.mkdirSync(pluginASkills, { recursive: true });
    fs.writeFileSync(
      path.join(pluginASkills, "skill-a.md"),
      "---\nname: skill-a\n---\nA",
    );

    // Plugin B
    const pluginBSkills = path.join(
      cacheDir,
      "orgB",
      "pluginB",
      "2.0.0",
      "skills",
    );
    fs.mkdirSync(pluginBSkills, { recursive: true });
    fs.writeFileSync(
      path.join(pluginBSkills, "skill-b.md"),
      "---\nname: skill-b\n---\nB",
    );

    const skills = PluginsSerializer.readAllSkills(globalClaudeDir, [
      "orgA/pluginA",
      "orgB/pluginB",
    ]);
    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(["skill-a", "skill-b"]);
  });

  describe("findPluginDirs", () => {
    it("returns versioned subdirectories for a plugin", () => {
      const pluginBase = path.join(cacheDir, "org", "myplugin");
      fs.mkdirSync(path.join(pluginBase, "1.0.0"), { recursive: true });
      fs.mkdirSync(path.join(pluginBase, "2.0.0"), { recursive: true });

      const dirs = PluginsSerializer.findPluginDirs(cacheDir, "org/myplugin");
      expect(dirs).toHaveLength(2);
    });

    it("returns empty array when plugin base does not exist", () => {
      fs.mkdirSync(cacheDir, { recursive: true });
      const dirs = PluginsSerializer.findPluginDirs(cacheDir, "org/missing");
      expect(dirs).toEqual([]);
    });
  });
});
