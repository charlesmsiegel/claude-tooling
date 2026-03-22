import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MemorySerializer } from "../../model/serializers/memory";
import { Scope } from "../../model/types";

describe("MemorySerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    scope = { type: "project", label: "my-project", path: path.join(tmpDir, ".claude") };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  describe("getMemoryDir", () => {
    it("derives memory dir from workspace path", () => {
      const result = MemorySerializer.getMemoryDir(
        "/home/user/.claude",
        "/home/user/project"
      );
      expect(result).toBe(
        "/home/user/.claude/projects/-home-user-project/memory"
      );
    });

    it("replaces all slashes with dashes, producing a leading dash", () => {
      const result = MemorySerializer.getMemoryDir(
        "/home/user/.claude",
        "/home/user/my-project"
      );
      expect(result).toBe(
        "/home/user/.claude/projects/-home-user-my-project/memory"
      );
    });

    it("handles deeply nested workspace paths", () => {
      const result = MemorySerializer.getMemoryDir(
        "/home/user/.claude",
        "/home/user/code/org/repo"
      );
      expect(result).toBe(
        "/home/user/.claude/projects/-home-user-code-org-repo/memory"
      );
    });

    it("handles root workspace path", () => {
      const result = MemorySerializer.getMemoryDir(
        "/home/user/.claude",
        "/"
      );
      expect(result).toBe(
        "/home/user/.claude/projects/-/memory"
      );
    });
  });

  describe("read", () => {
    it("reads MEMORY.md and returns MemoryConfig with topic MEMORY", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "MEMORY.md");
      fs.writeFileSync(filePath, "This project uses TypeScript.");

      const result = MemorySerializer.read(filePath, scope);
      expect(result.type).toBe("memory");
      expect(result.topic).toBe("MEMORY");
      expect(result.content).toBe("This project uses TypeScript.");
      expect(result.name).toBe("MEMORY.md");
      expect(result.filePath).toBe(filePath);
      expect(result.scope).toBe(scope);
    });

    it("reads a topic file like debugging.md", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "debugging.md");
      fs.writeFileSync(filePath, "Use console.log for debugging.");

      const result = MemorySerializer.read(filePath, scope);
      expect(result.type).toBe("memory");
      expect(result.topic).toBe("debugging");
      expect(result.content).toBe("Use console.log for debugging.");
      expect(result.name).toBe("debugging.md");
    });

    it("reads a topic file like patterns.md", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "patterns.md");
      fs.writeFileSync(filePath, "Use factory pattern for services.");

      const result = MemorySerializer.read(filePath, scope);
      expect(result.topic).toBe("patterns");
      expect(result.content).toBe("Use factory pattern for services.");
    });

    it("sets the correct ID format", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "debugging.md");
      fs.writeFileSync(filePath, "Content.");

      const result = MemorySerializer.read(filePath, scope);
      expect(result.id).toBe("project:my-project:memory:debugging");
    });

    it("sets the correct ID format for MEMORY.md", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "MEMORY.md");
      fs.writeFileSync(filePath, "Content.");

      const result = MemorySerializer.read(filePath, scope);
      expect(result.id).toBe("project:my-project:memory:MEMORY");
    });
  });

  describe("readAll", () => {
    it("reads all memory files from a project memory directory", () => {
      const globalClaudeDir = path.join(tmpDir, ".claude");
      const workspacePath = "/home/user/project";
      const projectKey = workspacePath.replace(/\//g, "-");
      const memoryDir = path.join(globalClaudeDir, "projects", projectKey, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });

      fs.writeFileSync(path.join(memoryDir, "MEMORY.md"), "Main memory content.");
      fs.writeFileSync(path.join(memoryDir, "debugging.md"), "Debugging tips.");
      fs.writeFileSync(path.join(memoryDir, "patterns.md"), "Design patterns.");

      const results = MemorySerializer.readAll(globalClaudeDir, workspacePath, scope);
      expect(results).toHaveLength(3);

      const topics = results.map((r) => r.topic).sort();
      expect(topics).toEqual(["MEMORY", "debugging", "patterns"]);
    });

    it("only reads .md files from the memory directory", () => {
      const globalClaudeDir = path.join(tmpDir, ".claude");
      const workspacePath = "/home/user/project";
      const projectKey = workspacePath.replace(/\//g, "-");
      const memoryDir = path.join(globalClaudeDir, "projects", projectKey, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });

      fs.writeFileSync(path.join(memoryDir, "MEMORY.md"), "Memory content.");
      fs.writeFileSync(path.join(memoryDir, "notes.txt"), "Should be ignored.");
      fs.writeFileSync(path.join(memoryDir, "data.json"), "{}");

      const results = MemorySerializer.readAll(globalClaudeDir, workspacePath, scope);
      expect(results).toHaveLength(1);
      expect(results[0].topic).toBe("MEMORY");
    });

    it("returns empty array when memory directory does not exist", () => {
      const globalClaudeDir = path.join(tmpDir, ".claude");
      const workspacePath = "/home/user/nonexistent";

      const results = MemorySerializer.readAll(globalClaudeDir, workspacePath, scope);
      expect(results).toHaveLength(0);
    });

    it("returns empty array when memory directory is empty", () => {
      const globalClaudeDir = path.join(tmpDir, ".claude");
      const workspacePath = "/home/user/project";
      const projectKey = workspacePath.replace(/\//g, "-");
      const memoryDir = path.join(globalClaudeDir, "projects", projectKey, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });

      const results = MemorySerializer.readAll(globalClaudeDir, workspacePath, scope);
      expect(results).toHaveLength(0);
    });
  });

  describe("write", () => {
    it("writes memory content to file", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "MEMORY.md");

      MemorySerializer.write({
        id: "project:my-project:memory:MEMORY",
        name: "MEMORY.md",
        type: "memory",
        scope,
        filePath,
        topic: "MEMORY",
        content: "Updated memory content.",
      });

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toBe("Updated memory content.");
    });

    it("creates parent directories if needed", () => {
      const filePath = path.join(tmpDir, "deep", "nested", "memory", "test.md");

      MemorySerializer.write({
        id: "project:my-project:memory:test",
        name: "test.md",
        type: "memory",
        scope,
        filePath,
        topic: "test",
        content: "Test content.",
      });

      expect(fs.existsSync(filePath)).toBe(true);
      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toBe("Test content.");
    });

    it("overwrites existing file content", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "MEMORY.md");
      fs.writeFileSync(filePath, "Old content.");

      MemorySerializer.write({
        id: "project:my-project:memory:MEMORY",
        name: "MEMORY.md",
        type: "memory",
        scope,
        filePath,
        topic: "MEMORY",
        content: "New content.",
      });

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toBe("New content.");
    });
  });

  describe("delete", () => {
    it("removes the memory file", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "debugging.md");
      fs.writeFileSync(filePath, "Content to delete.");

      MemorySerializer.delete({
        id: "project:my-project:memory:debugging",
        name: "debugging.md",
        type: "memory",
        scope,
        filePath,
        topic: "debugging",
        content: "Content to delete.",
      });

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("does not throw when file does not exist", () => {
      const filePath = path.join(tmpDir, "memory", "nonexistent.md");

      expect(() => {
        MemorySerializer.delete({
          id: "project:my-project:memory:nonexistent",
          name: "nonexistent.md",
          type: "memory",
          scope,
          filePath,
          topic: "nonexistent",
          content: "",
        });
      }).not.toThrow();
    });
  });

  describe("round-trip", () => {
    it("read then write preserves content", () => {
      const memoryDir = path.join(tmpDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });
      const filePath = path.join(memoryDir, "MEMORY.md");
      const original = "This is important project memory.\n\nRemember these things.";
      fs.writeFileSync(filePath, original);

      const parsed = MemorySerializer.read(filePath, scope);
      MemorySerializer.write(parsed);

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toBe(original);
    });
  });
});
