import * as fs from "fs";
import * as path from "path";
import { AgentConfig, Scope } from "../types";
import { findMdFilesRecursive } from "./utils";

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; content: string } {
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

  return { frontmatter, content };
}

export class AgentsSerializer {
  static read(filePath: string, scope: Scope): AgentConfig {
    const raw = fs.readFileSync(filePath, "utf-8");
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath, ext);

    const { frontmatter, content } = parseFrontmatter(raw);
    const name = frontmatter.name || fileName;

    return {
      id: `${scope.type}:${scope.label}:agent:${name}`,
      name,
      type: "agent",
      scope,
      filePath,
      model: frontmatter.model,
      description: frontmatter.description,
      color: frontmatter.color,
      instructions: content || undefined,
    };
  }

  static readAll(claudeDir: string, scope: Scope): AgentConfig[] {
    const agentsDir = path.join(claudeDir, "agents");
    if (!fs.existsSync(agentsDir)) return [];

    return findMdFilesRecursive(agentsDir).map((f) =>
      AgentsSerializer.read(f, scope),
    );
  }

  static write(agent: AgentConfig): void {
    const lines: string[] = ["---"];
    lines.push(`name: ${agent.name}`);
    if (agent.description) lines.push(`description: ${agent.description}`);
    if (agent.model) lines.push(`model: ${agent.model}`);
    if (agent.color) lines.push(`color: ${agent.color}`);
    lines.push("---");
    lines.push("");
    if (agent.instructions) lines.push(agent.instructions);

    const dir = path.dirname(agent.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(agent.filePath, lines.join("\n"));
  }

  static delete(agent: AgentConfig): void {
    if (fs.existsSync(agent.filePath)) fs.unlinkSync(agent.filePath);
  }
}
