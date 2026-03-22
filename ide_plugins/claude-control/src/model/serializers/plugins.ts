import * as fs from "fs";
import * as path from "path";
import { SkillConfig, CommandConfig, Scope } from "../types";
import { SkillsSerializer } from "./skills";
import { CommandsSerializer } from "./commands";

/**
 * Scans the Claude plugin cache directory for installed plugin skills and commands.
 *
 * Plugin cache layout:
 *   ~/.claude/plugins/cache/<org>/<plugin-name>/<version>/
 *     skills/           (may contain subdirectories with SKILL.md, index.md, etc.)
 *     commands/*.md
 *     agents/
 */
export class PluginsSerializer {
  /**
   * Discover skills from all enabled plugins in the cache directory.
   */
  static readAllSkills(
    globalClaudeDir: string,
    enabledPlugins: string[],
  ): SkillConfig[] {
    const cacheDir = path.join(globalClaudeDir, "plugins", "cache");
    if (!fs.existsSync(cacheDir)) return [];

    const results: SkillConfig[] = [];

    for (const pluginId of enabledPlugins) {
      const pluginDirs = PluginsSerializer.findPluginDirs(cacheDir, pluginId);
      for (const pluginDir of pluginDirs) {
        const scope: Scope = {
          type: "global",
          label: `plugin:${pluginId}`,
          path: pluginDir,
        };
        results.push(...SkillsSerializer.readAll(pluginDir, scope));
      }
    }

    return results;
  }

  /**
   * Discover commands from all enabled plugins in the cache directory.
   */
  static readAllCommands(
    globalClaudeDir: string,
    enabledPlugins: string[],
  ): CommandConfig[] {
    const cacheDir = path.join(globalClaudeDir, "plugins", "cache");
    if (!fs.existsSync(cacheDir)) return [];

    const results: CommandConfig[] = [];

    for (const pluginId of enabledPlugins) {
      const pluginDirs = PluginsSerializer.findPluginDirs(cacheDir, pluginId);
      for (const pluginDir of pluginDirs) {
        const scope: Scope = {
          type: "global",
          label: `plugin:${pluginId}`,
          path: pluginDir,
        };
        results.push(...CommandsSerializer.readAll(pluginDir, scope));
      }
    }

    return results;
  }

  /**
   * Find the versioned directories for a plugin in the cache.
   *
   * A pluginId might be:
   *   - "anthropic-agent-skills/document-skills"   (org/name)
   *   - "claude-code-plugins/superpowers"           (org/name)
   *
   * Each has versioned subdirectories; we return all of them (usually the latest).
   */
  static findPluginDirs(cacheDir: string, pluginId: string): string[] {
    const pluginBase = path.join(cacheDir, ...pluginId.split("/"));
    if (!fs.existsSync(pluginBase)) return [];

    const results: string[] = [];
    try {
      const entries = fs.readdirSync(pluginBase, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          results.push(path.join(pluginBase, entry.name));
        }
      }
    } catch {
      // permission error or similar — skip
    }

    return results;
  }
}
