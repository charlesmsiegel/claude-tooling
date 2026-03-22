import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { CommandsSerializer } from "../../model/serializers/commands";
import { Scope } from "../../model/types";

describe("CommandsSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    fs.mkdirSync(path.join(tmpDir, "commands"), { recursive: true });
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("reads a command markdown file with frontmatter", () => {
    const cmdPath = path.join(tmpDir, "commands", "deploy.md");
    fs.writeFileSync(cmdPath, [
      "---",
      "name: deploy",
      "description: Deploy the application",
      "arguments: environment",
      "---",
      "",
      "Deploy to {{ environment }}.",
    ].join("\n"));

    const result = CommandsSerializer.read(cmdPath, scope);
    expect(result.type).toBe("command");
    expect(result.name).toBe("deploy");
    expect(result.id).toBe("global:Global:command:deploy");
    expect(result.description).toBe("Deploy the application");
    expect(result.arguments).toBe("environment");
    expect(result.template).toContain("Deploy to {{ environment }}.");
  });

  it("reads all commands from a directory", () => {
    fs.writeFileSync(
      path.join(tmpDir, "commands", "a.md"),
      "---\nname: a\n---\nTemplate A"
    );
    fs.writeFileSync(
      path.join(tmpDir, "commands", "b.md"),
      "---\nname: b\n---\nTemplate B"
    );

    const results = CommandsSerializer.readAll(tmpDir, scope);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.name).sort()).toEqual(["a", "b"]);
  });

  it("writes a command to markdown", () => {
    const cmdPath = path.join(tmpDir, "commands", "test-cmd.md");
    CommandsSerializer.write({
      id: "global:Global:command:test-cmd",
      name: "test-cmd",
      type: "command",
      scope,
      filePath: cmdPath,
      description: "Run tests",
      arguments: "pattern",
      template: "Run tests matching {{ pattern }}.",
    });

    const written = fs.readFileSync(cmdPath, "utf-8");
    expect(written).toContain("name: test-cmd");
    expect(written).toContain("description: Run tests");
    expect(written).toContain("arguments: pattern");
    expect(written).toContain("Run tests matching {{ pattern }}.");
  });

  it("reads commands recursively from subdirectories", () => {
    fs.mkdirSync(path.join(tmpDir, "commands", "sub"), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, "commands", "top.md"),
      "---\nname: top\n---\nTop template",
    );
    fs.writeFileSync(
      path.join(tmpDir, "commands", "sub", "nested.md"),
      "---\nname: nested\n---\nNested template",
    );

    const results = CommandsSerializer.readAll(tmpDir, scope);
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["nested", "top"]);
  });

  it("handles command without frontmatter", () => {
    const cmdPath = path.join(tmpDir, "commands", "simple.md");
    fs.writeFileSync(cmdPath, "Just a template, no frontmatter.");

    const result = CommandsSerializer.read(cmdPath, scope);
    expect(result.name).toBe("simple");
    expect(result.template).toBe("Just a template, no frontmatter.");
    expect(result.description).toBeUndefined();
    expect(result.arguments).toBeUndefined();
  });
});
