import * as fs from "fs";
import * as path from "path";
import { ClaudeMdConfig, ClaudeMdSection, Scope } from "../types";

export class ClaudeMdSerializer {
  static read(filePath: string, scope: Scope, location: "root" | "dotclaude"): ClaudeMdConfig {
    const raw = fs.readFileSync(filePath, "utf-8");
    const sections = ClaudeMdSerializer.parseSections(raw);

    return {
      id: `${scope.type}:${scope.label}:claudeMd:${location}`,
      name: "CLAUDE.md",
      type: "claudeMd",
      scope,
      filePath,
      content: raw,
      sections,
    };
  }

  static findAll(workspaceFolder: string, scope: Scope): ClaudeMdConfig[] {
    const results: ClaudeMdConfig[] = [];

    const rootPath = path.join(workspaceFolder, "CLAUDE.md");
    if (fs.existsSync(rootPath)) {
      results.push(ClaudeMdSerializer.read(rootPath, scope, "root"));
    }

    const dotClaudePath = path.join(workspaceFolder, ".claude", "CLAUDE.md");
    if (fs.existsSync(dotClaudePath)) {
      results.push(ClaudeMdSerializer.read(dotClaudePath, scope, "dotclaude"));
    }

    return results;
  }

  static write(claudeMd: ClaudeMdConfig): void {
    const parts: string[] = [];

    for (const section of claudeMd.sections) {
      if (section.heading) {
        parts.push(`## ${section.heading}\n\n${section.content}`);
      } else {
        parts.push(section.content);
      }
    }

    const output = parts.join("\n\n");

    const dir = path.dirname(claudeMd.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(claudeMd.filePath, output);
  }

  private static parseSections(content: string): ClaudeMdSection[] {
    const lines = content.split("\n");
    const sections: ClaudeMdSection[] = [];
    let currentHeading = "";
    let currentLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("## ")) {
        // Push the previous section
        if (currentLines.length > 0 || sections.length > 0 || currentHeading !== "") {
          sections.push({
            heading: currentHeading,
            content: currentLines.join("\n").trim(),
          });
        }
        currentHeading = line.slice(3);
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    // Push the last section (or the only section if no headings were found)
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim(),
    });

    return sections;
  }
}
