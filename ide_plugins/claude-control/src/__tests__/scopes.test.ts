import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { discoverScopes } from "../scopes";

describe("discoverScopes", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("discovers global scope", () => {
    const globalDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(globalDir, { recursive: true });

    const scopes = discoverScopes(globalDir, []);
    expect(scopes).toContainEqual(
      expect.objectContaining({ type: "global", label: "Global" })
    );
  });

  it("discovers project scopes from workspace folders", () => {
    const projectDir = path.join(tmpDir, "my-project", ".claude");
    fs.mkdirSync(projectDir, { recursive: true });

    const scopes = discoverScopes(
      path.join(tmpDir, ".claude"),
      [path.join(tmpDir, "my-project")]
    );
    expect(scopes).toContainEqual(
      expect.objectContaining({ type: "project", label: "my-project" })
    );
  });

  it("discovers multiple workspace folders", () => {
    const projectA = path.join(tmpDir, "project-a", ".claude");
    const projectB = path.join(tmpDir, "project-b", ".claude");
    fs.mkdirSync(projectA, { recursive: true });
    fs.mkdirSync(projectB, { recursive: true });

    const scopes = discoverScopes(
      path.join(tmpDir, ".claude"),
      [path.join(tmpDir, "project-a"), path.join(tmpDir, "project-b")]
    );

    expect(scopes).toContainEqual(
      expect.objectContaining({ type: "project", label: "project-a" })
    );
    expect(scopes).toContainEqual(
      expect.objectContaining({ type: "project", label: "project-b" })
    );
    // global + 2 projects
    expect(scopes).toHaveLength(3);
  });

  it("includes workspace folder without .claude/ directory as a scope", () => {
    // The workspace folder exists but has no .claude/ subdirectory.
    // The extension may create it later, so we still include it.
    const projectDir = path.join(tmpDir, "no-claude-dir");
    fs.mkdirSync(projectDir, { recursive: true });

    const scopes = discoverScopes(
      path.join(tmpDir, ".claude"),
      [projectDir]
    );
    expect(scopes).toContainEqual(
      expect.objectContaining({ type: "project", label: "no-claude-dir" })
    );
  });

  it("global scope always exists even if the directory does not yet exist", () => {
    const nonExistentGlobal = path.join(tmpDir, "nonexistent", ".claude");

    const scopes = discoverScopes(nonExistentGlobal, []);
    expect(scopes).toContainEqual(
      expect.objectContaining({
        type: "global",
        label: "Global",
        path: nonExistentGlobal,
      })
    );
  });

  it("project scope path points to .claude/ inside the workspace folder", () => {
    const projectDir = path.join(tmpDir, "my-project", ".claude");
    fs.mkdirSync(projectDir, { recursive: true });

    const scopes = discoverScopes(
      path.join(tmpDir, ".claude"),
      [path.join(tmpDir, "my-project")]
    );

    const projectScope = scopes.find((s) => s.type === "project");
    expect(projectScope).toBeDefined();
    expect(projectScope!.path).toBe(projectDir);
  });
});
