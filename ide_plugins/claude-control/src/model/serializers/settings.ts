import * as fs from "fs";
import * as path from "path";
import { SettingsConfig, Scope } from "../types";

export class SettingsSerializer {
  /**
   * Resolve the actual settings file path.
   *
   * Global scope uses `settings.json` directly in `~/.claude/`.
   * Project scope uses `settings.local.json` inside `<workspace>/.claude/`.
   *
   * When a specific path is given we try it first, then fall back to the
   * alternative name so callers don't need to know the naming convention.
   */
  static resolveSettingsPath(filePath: string): string {
    if (fs.existsSync(filePath)) return filePath;

    // Try the alternate name
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);

    if (base === "settings.json") {
      const alt = path.join(dir, "settings.local.json");
      if (fs.existsSync(alt)) return alt;
    } else if (base === "settings.local.json") {
      const alt = path.join(dir, "settings.json");
      if (fs.existsSync(alt)) return alt;
    }

    // Neither exists — return the original so downstream code creates it there.
    return filePath;
  }

  static read(filePath: string, scope: Scope): SettingsConfig {
    const actualPath = SettingsSerializer.resolveSettingsPath(filePath);
    let raw: Record<string, unknown> = {};

    if (fs.existsSync(actualPath)) {
      raw = JSON.parse(fs.readFileSync(actualPath, "utf-8"));
    }

    return {
      id: `${scope.type}:${scope.label}:settings:main`,
      name: "settings",
      type: "settings",
      scope,
      filePath: actualPath,
      permissions: raw.permissions as Record<string, string[]> | undefined,
      model: raw.model as string | undefined,
      customInstructions: raw.customInstructions as string | undefined,
      enabledPlugins: raw.enabledPlugins as string[] | undefined,
      raw,
    };
  }

  static write(settings: SettingsConfig): void {
    const output = { ...settings.raw };
    if (settings.model !== undefined) output.model = settings.model;
    if (settings.permissions !== undefined) output.permissions = settings.permissions;
    if (settings.customInstructions !== undefined) output.customInstructions = settings.customInstructions;

    const dir = path.dirname(settings.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(settings.filePath, JSON.stringify(output, null, 2) + "\n");
  }
}
