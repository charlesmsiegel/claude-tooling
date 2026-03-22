import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { AgentsSerializer } from "../../model/serializers/agents";
import { AgentConfig, Scope } from "../../model/types";

describe("AgentsSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    fs.mkdirSync(path.join(tmpDir, "agents"), { recursive: true });
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("reads an agent markdown file with frontmatter", () => {
    const agentPath = path.join(tmpDir, "agents", "lore-writer.md");
    fs.writeFileSync(
      agentPath,
      [
        "---",
        "name: lore-writer",
        "description: Narrative and world-building content creation",
        "model: sonnet",
        "color: green",
        "---",
        "",
        "# Lore Writer Agent",
        "",
        "You are the Lore Writer Agent.",
      ].join("\n")
    );

    const result = AgentsSerializer.read(agentPath, scope);

    expect(result.type).toBe("agent");
    expect(result.id).toBe("global:Global:agent:lore-writer");
    expect(result.name).toBe("lore-writer");
    expect(result.model).toBe("sonnet");
    expect(result.description).toBe("Narrative and world-building content creation");
    expect(result.color).toBe("green");
    expect(result.instructions).toContain("# Lore Writer Agent");
    expect(result.instructions).toContain("You are the Lore Writer Agent.");
    expect(result.scope).toBe(scope);
    expect(result.filePath).toBe(agentPath);
  });

  it("reads a minimal agent file (name only)", () => {
    const agentPath = path.join(tmpDir, "agents", "minimal.md");
    fs.writeFileSync(agentPath, "---\nname: minimal\n---\n");

    const result = AgentsSerializer.read(agentPath, scope);

    expect(result.type).toBe("agent");
    expect(result.id).toBe("global:Global:agent:minimal");
    expect(result.name).toBe("minimal");
    expect(result.model).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.color).toBeUndefined();
    expect(result.instructions).toBeUndefined();
  });

  it("writes an agent to markdown with frontmatter", () => {
    const agentPath = path.join(tmpDir, "agents", "written.md");
    const agent: AgentConfig = {
      id: "global:Global:agent:written",
      name: "written",
      type: "agent",
      scope,
      filePath: agentPath,
      model: "sonnet",
      description: "A test agent",
      color: "blue",
      instructions: "# Written Agent\n\nBe helpful.",
    };

    AgentsSerializer.write(agent);

    const written = fs.readFileSync(agentPath, "utf-8");
    expect(written).toContain("name: written");
    expect(written).toContain("model: sonnet");
    expect(written).toContain("description: A test agent");
    expect(written).toContain("color: blue");
    expect(written).toContain("# Written Agent");
    expect(written).toContain("Be helpful.");
  });

  it("round-trips preserving all fields", () => {
    const agentPath = path.join(tmpDir, "agents", "roundtrip.md");
    const original: AgentConfig = {
      id: "global:Global:agent:roundtrip",
      name: "roundtrip",
      type: "agent",
      scope,
      filePath: agentPath,
      model: "opus",
      description: "Round-trip test",
      color: "red",
      instructions: "# Roundtrip Agent\n\nTest round-trip.",
    };

    AgentsSerializer.write(original);
    const restored = AgentsSerializer.read(agentPath, scope);

    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.type).toBe(original.type);
    expect(restored.model).toBe(original.model);
    expect(restored.description).toBe(original.description);
    expect(restored.color).toBe(original.color);
    expect(restored.instructions).toBe(original.instructions);
  });

  it("reads all agents from directory including subdirectories", () => {
    fs.mkdirSync(path.join(tmpDir, "agents", "book-creation"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "agents", "knowledge-base"), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, "agents", "book-creation", "lore-writer.md"),
      "---\nname: lore-writer\nmodel: sonnet\n---\n\n# Lore Writer"
    );
    fs.writeFileSync(
      path.join(tmpDir, "agents", "book-creation", "copy-editor.md"),
      "---\nname: copy-editor\nmodel: sonnet\n---\n\n# Copy Editor"
    );
    fs.writeFileSync(
      path.join(tmpDir, "agents", "knowledge-base", "kb-retriever.md"),
      "---\nname: kb-retriever\nmodel: sonnet\n---\n\n# KB Retriever"
    );
    // Non-md file should be ignored
    fs.writeFileSync(
      path.join(tmpDir, "agents", "ignore.txt"),
      "not an agent"
    );

    const results = AgentsSerializer.readAll(tmpDir, scope);

    expect(results).toHaveLength(3);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["copy-editor", "kb-retriever", "lore-writer"]);
  });

  it("handles missing agents directory gracefully", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-empty-"));

    const results = AgentsSerializer.readAll(emptyDir, scope);

    expect(results).toEqual([]);
    fs.rmSync(emptyDir, { recursive: true });
  });

  it("handles missing file gracefully", () => {
    const nonexistent = path.join(tmpDir, "agents", "nonexistent.md");
    expect(() => AgentsSerializer.read(nonexistent, scope)).toThrow();
  });

  it("deletes an agent file", () => {
    const agentPath = path.join(tmpDir, "agents", "to-delete.md");
    fs.writeFileSync(agentPath, "---\nname: to-delete\n---\n");
    expect(fs.existsSync(agentPath)).toBe(true);

    AgentsSerializer.delete({
      id: "global:Global:agent:to-delete",
      name: "to-delete",
      type: "agent",
      scope,
      filePath: agentPath,
    });

    expect(fs.existsSync(agentPath)).toBe(false);
  });

  it("delete handles already-removed file gracefully", () => {
    const agentPath = path.join(tmpDir, "agents", "already-gone.md");

    expect(() =>
      AgentsSerializer.delete({
        id: "global:Global:agent:already-gone",
        name: "already-gone",
        type: "agent",
        scope,
        filePath: agentPath,
      })
    ).not.toThrow();
  });

  it("creates parent directories when writing", () => {
    const deepPath = path.join(tmpDir, "new-dir", "agents", "deep.md");
    const agent: AgentConfig = {
      id: "global:Global:agent:deep",
      name: "deep",
      type: "agent",
      scope,
      filePath: deepPath,
    };

    AgentsSerializer.write(agent);

    expect(fs.existsSync(deepPath)).toBe(true);
    const restored = AgentsSerializer.read(deepPath, scope);
    expect(restored.name).toBe("deep");
  });

  it("uses filename as name when name field is missing", () => {
    const agentPath = path.join(tmpDir, "agents", "from-filename.md");
    fs.writeFileSync(agentPath, "---\nmodel: sonnet\n---\n\nSome instructions.");

    const result = AgentsSerializer.read(agentPath, scope);

    expect(result.name).toBe("from-filename");
    expect(result.id).toBe("global:Global:agent:from-filename");
  });

  it("generates correct ID for project scope", () => {
    const projectScope: Scope = {
      type: "project",
      label: "myproject",
      path: tmpDir,
    };
    const agentPath = path.join(tmpDir, "agents", "proj-agent.md");
    fs.writeFileSync(agentPath, "---\nname: proj-agent\n---\n");

    const result = AgentsSerializer.read(agentPath, projectScope);

    expect(result.id).toBe("project:myproject:agent:proj-agent");
  });

  it("reads agent without frontmatter (plain markdown)", () => {
    const agentPath = path.join(tmpDir, "agents", "plain.md");
    fs.writeFileSync(agentPath, "# Plain Agent\n\nJust instructions, no frontmatter.");

    const result = AgentsSerializer.read(agentPath, scope);

    expect(result.name).toBe("plain");
    expect(result.instructions).toBe("# Plain Agent\n\nJust instructions, no frontmatter.");
    expect(result.model).toBeUndefined();
  });
});
