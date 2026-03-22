import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { HooksSerializer } from "../../model/serializers/hooks";
import { Scope } from "../../model/types";

describe("HooksSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("parses hooks from settings.json", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", command: "echo lint", timeout: 5000 }
        ],
        PostToolUse: [
          { matcher: "*", command: "echo done" }
        ]
      }
    }));

    const results = HooksSerializer.readAll(settingsPath, scope);
    expect(results).toHaveLength(2);
    expect(results[0].event).toBe("PreToolUse");
    expect(results[0].matcher).toBe("Bash");
    expect(results[0].command).toBe("echo lint");
    expect(results[1].event).toBe("PostToolUse");
  });

  it("writes a hook back into settings.json", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({ model: "sonnet" }));

    const hook = {
      id: `global:Global:hook:PreToolUse:0`,
      name: "lint",
      type: "hook" as const,
      scope,
      filePath: settingsPath,
      event: "PreToolUse",
      matcher: "Bash",
      command: "echo lint",
      timeout: 5000,
      enabled: true,
    };

    HooksSerializer.write(hook);
    const written = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(written.model).toBe("sonnet");
    expect(written.hooks.PreToolUse).toHaveLength(1);
    expect(written.hooks.PreToolUse[0].command).toBe("echo lint");
  });

  it("returns empty array for file without hooks", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({}));
    const results = HooksSerializer.readAll(settingsPath, scope);
    expect(results).toHaveLength(0);
  });

  it("write() updates an existing hook instead of duplicating", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", command: "echo original", timeout: 5000 },
        ],
      },
    }));

    // Simulate editing the existing hook (index 0)
    const hook = {
      id: "global:Global:hook:PreToolUse:0",
      name: "PreToolUse:Bash",
      type: "hook" as const,
      scope,
      filePath: settingsPath,
      event: "PreToolUse",
      matcher: "Bash",
      command: "echo updated",
      timeout: 3000,
      enabled: true,
    };

    HooksSerializer.write(hook);
    const written = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(written.hooks.PreToolUse).toHaveLength(1);
    expect(written.hooks.PreToolUse[0].command).toBe("echo updated");
    expect(written.hooks.PreToolUse[0].timeout).toBe(3000);
  });

  it("remove() removes a hook by content matching", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", command: "echo lint" },
        ],
      },
    }));

    const hook = {
      id: "global:Global:hook:PreToolUse:0",
      name: "PreToolUse:Bash",
      type: "hook" as const,
      scope,
      filePath: settingsPath,
      event: "PreToolUse",
      matcher: "Bash",
      command: "echo lint",
      enabled: true,
    };

    HooksSerializer.remove(hook);
    const written = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    // Event array and hooks key should be cleaned up
    expect(written.hooks).toBeUndefined();
  });

  it("remove() only removes the matching hook when multiple hooks exist for the same event", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", command: "echo first" },
          { matcher: "Write", command: "echo second" },
          { matcher: "Bash", command: "echo third" },
        ],
      },
    }));

    // Remove the second hook (Write matcher)
    const hook = {
      id: "global:Global:hook:PreToolUse:1",
      name: "PreToolUse:Write",
      type: "hook" as const,
      scope,
      filePath: settingsPath,
      event: "PreToolUse",
      matcher: "Write",
      command: "echo second",
      enabled: true,
    };

    HooksSerializer.remove(hook);
    const written = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(written.hooks.PreToolUse).toHaveLength(2);
    expect(written.hooks.PreToolUse[0].command).toBe("echo first");
    expect(written.hooks.PreToolUse[1].command).toBe("echo third");
  });

  it("remove() cleans up empty event arrays and hooks key", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      model: "sonnet",
      hooks: {
        PostToolUse: [
          { command: "echo done" },
        ],
      },
    }));

    const hook = {
      id: "global:Global:hook:PostToolUse:0",
      name: "PostToolUse",
      type: "hook" as const,
      scope,
      filePath: settingsPath,
      event: "PostToolUse",
      command: "echo done",
      enabled: true,
    };

    HooksSerializer.remove(hook);
    const written = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    // hooks key should be removed entirely
    expect(written.hooks).toBeUndefined();
    // other keys should be preserved
    expect(written.model).toBe("sonnet");
  });
});
