import * as fs from "fs";
import * as path from "path";
import { CommandConfig, Scope } from "../types";
import { findMdFilesRecursive } from "./utils";

export class CommandsSerializer {
  static read(filePath: string, scope: Scope): CommandConfig {
    const raw = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath, ".md");

    const frontmatter: Record<string, string> = {};
    let content = raw;

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fmMatch) {
      const fmLines = fmMatch[1].split("\n");
      for (const line of fmLines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          frontmatter[key] = value;
        }
      }
      content = fmMatch[2].trim();
    }

    return {
      id: `${scope.type}:${scope.label}:command:${frontmatter.name || fileName}`,
      name: frontmatter.name || fileName,
      type: "command",
      scope,
      filePath,
      description: frontmatter.description,
      arguments: frontmatter.arguments,
      template: content,
    };
  }

  static readAll(claudeDir: string, scope: Scope): CommandConfig[] {
    const commandsDir = path.join(claudeDir, "commands");
    return findMdFilesRecursive(commandsDir).map((f) =>
      CommandsSerializer.read(f, scope),
    );
  }

  static write(command: CommandConfig): void {
    const lines: string[] = ["---"];
    lines.push(`name: ${command.name}`);
    if (command.description) lines.push(`description: ${command.description}`);
    if (command.arguments) lines.push(`arguments: ${command.arguments}`);
    lines.push("---");
    lines.push("");
    lines.push(command.template);

    const dir = path.dirname(command.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(command.filePath, lines.join("\n"));
  }

  static delete(command: CommandConfig): void {
    if (fs.existsSync(command.filePath)) fs.unlinkSync(command.filePath);
  }
}
