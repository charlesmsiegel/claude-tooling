import * as path from "path";
import { Scope } from "./model/types";

/**
 * Discovers all scopes the extension should manage.
 *
 * @param globalClaudeDir - Absolute path to the global ~/.claude directory.
 * @param workspaceFolders - Absolute paths to open workspace folder roots.
 * @returns An array of Scope objects (always includes global, plus one per workspace folder).
 */
export function discoverScopes(
  globalClaudeDir: string,
  workspaceFolders: string[],
): Scope[] {
  const scopes: Scope[] = [];

  // Global scope is always present, even if the directory doesn't exist yet.
  scopes.push({
    type: "global",
    label: "Global",
    path: globalClaudeDir,
  });

  // One project scope per workspace folder.
  for (const folder of workspaceFolders) {
    scopes.push({
      type: "project",
      label: path.basename(folder),
      path: path.join(folder, ".claude"),
    });
  }

  return scopes;
}
