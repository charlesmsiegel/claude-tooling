import * as fs from "fs";
import * as path from "path";
import { HookConfig, Scope } from "../types";

export class HooksSerializer {
  static readAll(settingsPath: string, scope: Scope): HookConfig[] {
    if (!fs.existsSync(settingsPath)) return [];

    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    if (!raw.hooks) return [];

    const hooks: HookConfig[] = [];

    for (const [event, entries] of Object.entries(raw.hooks)) {
      if (!Array.isArray(entries)) continue;
      entries.forEach((entry: any, index: number) => {
        hooks.push({
          id: `${scope.type}:${scope.label}:hook:${event}:${index}`,
          name: entry.matcher ? `${event}:${entry.matcher}` : event,
          type: "hook",
          scope,
          filePath: settingsPath,
          event,
          matcher: entry.matcher,
          command: entry.command,
          timeout: entry.timeout,
          enabled: entry.enabled !== false,
        });
      });
    }

    return hooks;
  }

  static write(hook: HookConfig): void {
    let raw: Record<string, any> = {};
    if (fs.existsSync(hook.filePath)) {
      raw = JSON.parse(fs.readFileSync(hook.filePath, "utf-8"));
    }

    if (!raw.hooks) raw.hooks = {};
    if (!raw.hooks[hook.event]) raw.hooks[hook.event] = [];

    const entry: Record<string, any> = { command: hook.command };
    if (hook.matcher) entry.matcher = hook.matcher;
    if (hook.timeout) entry.timeout = hook.timeout;
    if (!hook.enabled) entry.enabled = false;

    // Upsert: if the hook ID contains an index that points to an existing
    // entry in the same event array, replace it in place. Otherwise append.
    const parts = hook.id.split(":");
    const index = parseInt(parts[parts.length - 1], 10);
    const eventArray: any[] = raw.hooks[hook.event];

    if (!isNaN(index) && index >= 0 && index < eventArray.length) {
      eventArray[index] = entry;
    } else {
      eventArray.push(entry);
    }

    const dir = path.dirname(hook.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(hook.filePath, JSON.stringify(raw, null, 2) + "\n");
  }

  static remove(hook: HookConfig): void {
    if (!fs.existsSync(hook.filePath)) return;

    const raw = JSON.parse(fs.readFileSync(hook.filePath, "utf-8"));
    if (!raw.hooks?.[hook.event]) return;

    // Match by content (command + matcher) instead of index, so removal is
    // stable regardless of prior add/remove mutations.
    const entries: any[] = raw.hooks[hook.event];
    const idx = entries.findIndex(
      (e: any) =>
        e.command === hook.command &&
        (e.matcher ?? undefined) === (hook.matcher ?? undefined),
    );
    if (idx !== -1) {
      entries.splice(idx, 1);
    }

    if (entries.length === 0) delete raw.hooks[hook.event];
    if (Object.keys(raw.hooks).length === 0) delete raw.hooks;

    fs.writeFileSync(hook.filePath, JSON.stringify(raw, null, 2) + "\n");
  }
}
