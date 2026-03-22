import * as fs from "fs";
import * as path from "path";
import { MemoryConfig, Scope } from "../types";

export class MemorySerializer {
  /**
   * Derives the memory directory path for a given workspace.
   *
   * The project key is the workspace absolute path with all `/` replaced by `-`,
   * resulting in a leading `-`. For example:
   *   /home/user/my-project -> -home-user-my-project
   *
   * The memory directory lives at:
   *   <globalClaudeDir>/projects/<projectKey>/memory/
   */
  static getMemoryDir(globalClaudeDir: string, workspacePath: string): string {
    const projectKey = workspacePath.replace(/\//g, "-");
    return path.join(globalClaudeDir, "projects", projectKey, "memory");
  }

  /**
   * Reads a single memory file and returns a MemoryConfig.
   * The topic is derived from the filename without extension.
   */
  static read(filePath: string, scope: Scope): MemoryConfig {
    const raw = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath);
    const topic = path.basename(filePath, ".md");

    return {
      id: `${scope.type}:${scope.label}:memory:${topic}`,
      name: fileName,
      type: "memory",
      scope,
      filePath,
      topic,
      content: raw,
    };
  }

  /**
   * Reads all memory files (.md) for a project.
   */
  static readAll(
    globalClaudeDir: string,
    workspacePath: string,
    scope: Scope
  ): MemoryConfig[] {
    const memoryDir = MemorySerializer.getMemoryDir(globalClaudeDir, workspacePath);
    if (!fs.existsSync(memoryDir)) return [];

    return fs
      .readdirSync(memoryDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => MemorySerializer.read(path.join(memoryDir, f), scope));
  }

  /**
   * Writes memory content to file.
   */
  static write(memory: MemoryConfig): void {
    const dir = path.dirname(memory.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(memory.filePath, memory.content);
  }

  /**
   * Removes the memory file.
   */
  static delete(memory: MemoryConfig): void {
    if (fs.existsSync(memory.filePath)) fs.unlinkSync(memory.filePath);
  }
}
