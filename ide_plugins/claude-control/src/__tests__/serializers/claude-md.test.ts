import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ClaudeMdSerializer } from "../../model/serializers/claude-md";
import { Scope } from "../../model/types";

describe("ClaudeMdSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    scope = { type: "project", label: "my-project", path: path.join(tmpDir, ".claude") };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  describe("read", () => {
    it("parses a CLAUDE.md with multiple ## sections", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      fs.writeFileSync(filePath, [
        "## Project Overview",
        "",
        "This is a TypeScript project.",
        "",
        "## Code Style",
        "",
        "Use 2-space indentation.",
        "",
        "## Testing",
        "",
        "Always write tests first.",
      ].join("\n"));

      const result = ClaudeMdSerializer.read(filePath, scope, "root");
      expect(result.type).toBe("claudeMd");
      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].heading).toBe("Project Overview");
      expect(result.sections[0].content).toBe("This is a TypeScript project.");
      expect(result.sections[1].heading).toBe("Code Style");
      expect(result.sections[1].content).toBe("Use 2-space indentation.");
      expect(result.sections[2].heading).toBe("Testing");
      expect(result.sections[2].content).toBe("Always write tests first.");
    });

    it("parses a file with no headings as a single section with empty heading", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      fs.writeFileSync(filePath, "Just some plain instructions.\n\nNo headings here.");

      const result = ClaudeMdSerializer.read(filePath, scope, "root");
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].heading).toBe("");
      expect(result.sections[0].content).toBe("Just some plain instructions.\n\nNo headings here.");
    });

    it("handles content before the first heading", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      fs.writeFileSync(filePath, [
        "Preamble text before any heading.",
        "",
        "## First Section",
        "",
        "Section content.",
      ].join("\n"));

      const result = ClaudeMdSerializer.read(filePath, scope, "root");
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].heading).toBe("");
      expect(result.sections[0].content).toBe("Preamble text before any heading.");
      expect(result.sections[1].heading).toBe("First Section");
      expect(result.sections[1].content).toBe("Section content.");
    });

    it("sets the correct ID for root location", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      fs.writeFileSync(filePath, "# Hello");

      const result = ClaudeMdSerializer.read(filePath, scope, "root");
      expect(result.id).toBe("project:my-project:claudeMd:root");
    });

    it("sets the correct ID for dotclaude location", () => {
      const dotClaudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(dotClaudeDir, { recursive: true });
      const filePath = path.join(dotClaudeDir, "CLAUDE.md");
      fs.writeFileSync(filePath, "# Hello");

      const result = ClaudeMdSerializer.read(filePath, scope, "dotclaude");
      expect(result.id).toBe("project:my-project:claudeMd:dotclaude");
    });

    it("stores the full raw content", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      const content = "## Section A\n\nContent A\n\n## Section B\n\nContent B";
      fs.writeFileSync(filePath, content);

      const result = ClaudeMdSerializer.read(filePath, scope, "root");
      expect(result.content).toBe(content);
    });
  });

  describe("findAll", () => {
    it("finds CLAUDE.md at workspace root", () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Root instructions");

      const results = ClaudeMdSerializer.findAll(tmpDir, scope);
      expect(results).toHaveLength(1);
      expect(results[0].id).toContain("root");
      expect(results[0].content).toBe("Root instructions");
    });

    it("finds CLAUDE.md in .claude directory", () => {
      const dotClaudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(dotClaudeDir, { recursive: true });
      fs.writeFileSync(path.join(dotClaudeDir, "CLAUDE.md"), "Dot-claude instructions");

      const results = ClaudeMdSerializer.findAll(tmpDir, scope);
      expect(results).toHaveLength(1);
      expect(results[0].id).toContain("dotclaude");
      expect(results[0].content).toBe("Dot-claude instructions");
    });

    it("finds both root and .claude/CLAUDE.md", () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Root");
      const dotClaudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(dotClaudeDir, { recursive: true });
      fs.writeFileSync(path.join(dotClaudeDir, "CLAUDE.md"), "Dot-claude");

      const results = ClaudeMdSerializer.findAll(tmpDir, scope);
      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain("project:my-project:claudeMd:root");
      expect(ids).toContain("project:my-project:claudeMd:dotclaude");
    });

    it("returns empty array when no CLAUDE.md files exist", () => {
      const results = ClaudeMdSerializer.findAll(tmpDir, scope);
      expect(results).toHaveLength(0);
    });
  });

  describe("write", () => {
    it("writes sections back as markdown", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      ClaudeMdSerializer.write({
        id: "project:my-project:claudeMd:root",
        name: "CLAUDE.md",
        type: "claudeMd",
        scope,
        filePath,
        content: "",
        sections: [
          { heading: "Overview", content: "Project overview." },
          { heading: "Rules", content: "Follow these rules." },
        ],
      });

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toContain("## Overview");
      expect(written).toContain("Project overview.");
      expect(written).toContain("## Rules");
      expect(written).toContain("Follow these rules.");
    });

    it("writes a section with empty heading without a ## prefix", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      ClaudeMdSerializer.write({
        id: "project:my-project:claudeMd:root",
        name: "CLAUDE.md",
        type: "claudeMd",
        scope,
        filePath,
        content: "",
        sections: [
          { heading: "", content: "Preamble content." },
          { heading: "Details", content: "Some details." },
        ],
      });

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toMatch(/^Preamble content\./);
      expect(written).toContain("## Details");
      expect(written).toContain("Some details.");
    });

    it("creates parent directories if needed", () => {
      const filePath = path.join(tmpDir, "deep", "nested", "CLAUDE.md");
      ClaudeMdSerializer.write({
        id: "project:my-project:claudeMd:root",
        name: "CLAUDE.md",
        type: "claudeMd",
        scope,
        filePath,
        content: "",
        sections: [{ heading: "Test", content: "Content." }],
      });

      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("round-trip", () => {
    it("parse then write produces equivalent content", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      const original = [
        "## Project Overview",
        "",
        "This is a TypeScript project.",
        "",
        "## Code Style",
        "",
        "Use 2-space indentation.",
      ].join("\n");
      fs.writeFileSync(filePath, original);

      const parsed = ClaudeMdSerializer.read(filePath, scope, "root");
      ClaudeMdSerializer.write(parsed);

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written.trim()).toBe(original.trim());
    });

    it("round-trips content with preamble", () => {
      const filePath = path.join(tmpDir, "CLAUDE.md");
      const original = [
        "Preamble text.",
        "",
        "## Section One",
        "",
        "Content one.",
      ].join("\n");
      fs.writeFileSync(filePath, original);

      const parsed = ClaudeMdSerializer.read(filePath, scope, "root");
      ClaudeMdSerializer.write(parsed);

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written.trim()).toBe(original.trim());
    });
  });
});
