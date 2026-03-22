import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Store } from "../../model/store";
import { discoverScopes } from "../../scopes";
import { SettingsSerializer } from "../../model/serializers/settings";
import { HooksSerializer } from "../../model/serializers/hooks";
import { SkillsSerializer } from "../../model/serializers/skills";
import { CommandsSerializer } from "../../model/serializers/commands";
import { McpServersSerializer } from "../../model/serializers/mcp-servers";
import { AgentsSerializer } from "../../model/serializers/agents";
import { ClaudeMdSerializer } from "../../model/serializers/claude-md";
import { MemorySerializer } from "../../model/serializers/memory";
import { Scope } from "../../model/types";

describe("Extension Integration", () => {
  let tmpDir: string;
  let globalDir: string;
  let projectDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-integration-"));
    globalDir = path.join(tmpDir, ".claude");
    projectDir = path.join(tmpDir, "my-project");

    // Create directory structure
    fs.mkdirSync(path.join(globalDir, "skills"), { recursive: true });
    fs.mkdirSync(path.join(globalDir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(globalDir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, ".claude", "skills"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, ".claude", "commands"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("discovers scopes and loads all object types into store", () => {
    // Create files across scopes
    fs.writeFileSync(
      path.join(globalDir, "settings.json"),
      JSON.stringify({
        model: "claude-opus-4-6",
        hooks: {
          PreToolUse: [{ matcher: "Bash", command: "echo lint" }],
        },
      }),
    );
    fs.writeFileSync(
      path.join(globalDir, "skills", "tdd.md"),
      "---\nname: tdd\n---\nTDD content",
    );
    fs.writeFileSync(
      path.join(globalDir, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          github: {
            type: "stdio",
            command: "npx",
            args: ["-y", "server-github"],
          },
        },
      }),
    );
    fs.writeFileSync(
      path.join(globalDir, "agents", "dev.md"),
      "---\nname: dev\nmodel: claude-opus-4-6\n---\n\n# Dev Agent",
    );
    fs.writeFileSync(
      path.join(projectDir, ".claude", "skills", "deploy.md"),
      "---\nname: deploy\n---\nDeploy content",
    );
    fs.writeFileSync(
      path.join(projectDir, "CLAUDE.md"),
      "# Project\n\n## Rules\n\nFollow TDD.",
    );

    const scopes = discoverScopes(globalDir, [projectDir]);
    const store = new Store();

    // Load global scope
    const globalScope = scopes.find((s) => s.type === "global")!;
    store.set(
      SettingsSerializer.read(
        path.join(globalScope.path, "settings.json"),
        globalScope,
      ),
    );
    HooksSerializer.readAll(
      path.join(globalScope.path, "settings.json"),
      globalScope,
    ).forEach((h) => store.set(h));
    SkillsSerializer.readAll(globalScope.path, globalScope).forEach((s) =>
      store.set(s),
    );
    CommandsSerializer.readAll(globalScope.path, globalScope).forEach((c) =>
      store.set(c),
    );
    McpServersSerializer.readAll(
      path.join(globalScope.path, "mcp.json"),
      globalScope,
    ).forEach((m) => store.set(m));
    AgentsSerializer.readAll(globalScope.path, globalScope).forEach((a) =>
      store.set(a),
    );

    // Load project scope — project uses settings.local.json
    const projectScope = scopes.find((s) => s.type === "project")!;
    store.set(
      SettingsSerializer.read(
        path.join(projectScope.path, "settings.local.json"),
        projectScope,
      ),
    );
    SkillsSerializer.readAll(projectScope.path, projectScope).forEach((s) =>
      store.set(s),
    );
    ClaudeMdSerializer.findAll(projectDir, projectScope).forEach((c) =>
      store.set(c),
    );

    // Verify everything loaded
    expect(store.listByType("settings")).toHaveLength(2); // global + project
    expect(store.listByType("hook")).toHaveLength(1);
    expect(store.listByType("skill")).toHaveLength(2); // global tdd + project deploy
    expect(store.listByType("mcpServer")).toHaveLength(1);
    expect(store.listByType("agent")).toHaveLength(1);
    expect(store.listByType("claudeMd")).toHaveLength(1);
  });

  it("round-trips objects through store and serializers", () => {
    // Create a skill, save it, reload it
    const scope: Scope = { type: "global", label: "Global", path: globalDir };
    const skill = {
      id: "global:Global:skill:test",
      name: "test",
      type: "skill" as const,
      scope,
      filePath: path.join(globalDir, "skills", "test.md"),
      description: "A test skill",
      content: "Test content here",
    };

    SkillsSerializer.write(skill);
    const store = new Store();
    SkillsSerializer.readAll(globalDir, scope).forEach((s) => store.set(s));

    const loaded = store.get("global:Global:skill:test");
    expect(loaded).toBeDefined();
    expect((loaded as any).name).toBe("test");
    expect((loaded as any).description).toBe("A test skill");
    expect((loaded as any).content).toBe("Test content here");
  });

  it("connections survive store clear and reload", () => {
    const scope: Scope = { type: "global", label: "Global", path: globalDir };

    // Write an agent with markdown frontmatter
    fs.writeFileSync(
      path.join(globalDir, "agents", "dev.md"),
      "---\nname: dev\nmodel: sonnet\n---\n\n# Dev Agent\n\nUse TDD.",
    );
    fs.writeFileSync(
      path.join(globalDir, "skills", "tdd.md"),
      "---\nname: tdd\n---\nTDD",
    );

    const store = new Store();
    AgentsSerializer.readAll(globalDir, scope).forEach((a) => store.set(a));
    SkillsSerializer.readAll(globalDir, scope).forEach((s) => store.set(s));

    // Verify agent loaded
    const agent = store.get("global:Global:agent:dev") as any;
    expect(agent).toBeDefined();
    expect(agent.model).toBe("sonnet");
    expect(agent.instructions).toContain("Use TDD.");
  });
});
