import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findMdFilesRecursive } from "../../model/serializers/utils";

describe("findMdFilesRecursive", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns empty array for non-existent directory", () => {
    const result = findMdFilesRecursive(path.join(tmpDir, "nope"));
    expect(result).toEqual([]);
  });

  it("returns empty array for empty directory", () => {
    const dir = path.join(tmpDir, "empty");
    fs.mkdirSync(dir);
    const result = findMdFilesRecursive(dir);
    expect(result).toEqual([]);
  });

  it("finds .md files in top-level directory", () => {
    const dir = path.join(tmpDir, "flat");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "a.md"), "A");
    fs.writeFileSync(path.join(dir, "b.md"), "B");
    fs.writeFileSync(path.join(dir, "c.txt"), "C");

    const result = findMdFilesRecursive(dir);
    expect(result).toHaveLength(2);
    expect(result).toContain(path.join(dir, "a.md"));
    expect(result).toContain(path.join(dir, "b.md"));
  });

  it("finds .md files recursively in subdirectories", () => {
    const dir = path.join(tmpDir, "nested");
    fs.mkdirSync(path.join(dir, "sub1", "deep"), { recursive: true });
    fs.mkdirSync(path.join(dir, "sub2"), { recursive: true });

    fs.writeFileSync(path.join(dir, "top.md"), "top");
    fs.writeFileSync(path.join(dir, "sub1", "middle.md"), "middle");
    fs.writeFileSync(path.join(dir, "sub1", "deep", "bottom.md"), "bottom");
    fs.writeFileSync(path.join(dir, "sub2", "other.md"), "other");
    fs.writeFileSync(path.join(dir, "sub2", "skip.txt"), "skip");

    const result = findMdFilesRecursive(dir);
    expect(result).toHaveLength(4);
    expect(result).toContain(path.join(dir, "top.md"));
    expect(result).toContain(path.join(dir, "sub1", "middle.md"));
    expect(result).toContain(path.join(dir, "sub1", "deep", "bottom.md"));
    expect(result).toContain(path.join(dir, "sub2", "other.md"));
  });

  it("ignores non-.md files at all levels", () => {
    const dir = path.join(tmpDir, "mixed");
    fs.mkdirSync(path.join(dir, "sub"), { recursive: true });

    fs.writeFileSync(path.join(dir, "readme.md"), "readme");
    fs.writeFileSync(path.join(dir, "data.json"), "{}");
    fs.writeFileSync(path.join(dir, "sub", "skill.md"), "skill");
    fs.writeFileSync(path.join(dir, "sub", "config.yaml"), "key: value");

    const result = findMdFilesRecursive(dir);
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.endsWith(".md"))).toBe(true);
  });
});
