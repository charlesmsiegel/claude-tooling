# Claude Control Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a VS Code extension with tree view and form-based webview editors for managing Claude Code's `.claude/` configuration.

**Architecture:** Hybrid approach — native tree view for navigation, per-object-type webview editor panels with drag-and-drop linkable items, and a connections graph view using React Flow. Extension host owns an in-memory model synced to disk via file watchers.

**Tech Stack:** TypeScript, VS Code Extension API, esbuild, React 18, Vite, @vscode/webview-ui-toolkit, @dnd-kit, @xyflow/react, Vitest

---

## Phase 1: Project Scaffolding

### Task 1: Initialize VS Code Extension

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/extension.ts`
- Create: `.vscodeignore`
- Create: `.gitignore`
- Create: `esbuild.config.mjs`

**Step 1: Initialize npm and install extension dependencies**

Run:
```bash
npm init -y
npm install --save-dev @types/vscode @types/node typescript esbuild
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022"],
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "webview-ui"]
}
```

**Step 3: Create package.json extension manifest**

Add to `package.json`:
```json
{
  "name": "claude-control-plugin",
  "displayName": "Claude Control",
  "description": "Graphical management for Claude Code configuration",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "main": "./dist/extension.js",
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "claude-control",
          "title": "Claude Control",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "claude-control": [
        {
          "id": "claudeControlTree",
          "name": "Configuration"
        }
      ]
    },
    "commands": [
      { "command": "claudeControl.refresh", "title": "Refresh", "icon": "$(refresh)" },
      { "command": "claudeControl.showConnections", "title": "Show Connections" }
    ]
  },
  "scripts": {
    "build:ext": "node esbuild.config.mjs",
    "watch:ext": "node esbuild.config.mjs --watch",
    "build:webview": "cd webview-ui && npm run build",
    "build": "npm run build:ext && npm run build:webview",
    "watch": "concurrently \"npm run watch:ext\" \"cd webview-ui && npm run dev\"",
    "package": "vsce package",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 4: Create esbuild.config.mjs**

```javascript
import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

const config = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
} else {
  await esbuild.build(config);
}
```

**Step 5: Create minimal extension.ts**

```typescript
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("Claude Control Plugin activated");
}

export function deactivate() {}
```

**Step 6: Create .vscodeignore and .gitignore**

`.vscodeignore`:
```
src/**
webview-ui/src/**
node_modules/**
.gitignore
tsconfig.json
esbuild.config.mjs
```

`.gitignore`:
```
node_modules/
dist/
webview-ui/dist/
*.vsix
```

**Step 7: Build and verify**

Run: `npm run build:ext`
Expected: `dist/extension.js` created without errors

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold VS Code extension project"
```

---

### Task 2: Initialize Webview UI (React + Vite)

**Files:**
- Create: `webview-ui/package.json`
- Create: `webview-ui/tsconfig.json`
- Create: `webview-ui/vite.config.ts`
- Create: `webview-ui/index.html`
- Create: `webview-ui/src/App.tsx`
- Create: `webview-ui/src/main.tsx`
- Create: `webview-ui/src/vscode.ts`

**Step 1: Initialize webview-ui project**

```bash
mkdir -p webview-ui/src
cd webview-ui
npm init -y
npm install react react-dom @vscode/webview-ui-toolkit
npm install --save-dev @types/react @types/react-dom typescript vite @vitejs/plugin-react
```

**Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
```

**Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Claude Control</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 4: Create vscode.ts utility**

```typescript
import type { WebviewApi } from "vscode-webview";

class VSCodeAPIWrapper {
  private readonly vsCodeApi: WebviewApi<unknown> | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === "function") {
      this.vsCodeApi = acquireVsCodeApi();
    }
  }

  public postMessage(message: unknown): void {
    if (this.vsCodeApi) {
      this.vsCodeApi.postMessage(message);
    } else {
      console.log("postMessage:", message);
    }
  }

  public getState(): unknown | undefined {
    return this.vsCodeApi?.getState();
  }

  public setState<T extends unknown>(newState: T): T {
    if (this.vsCodeApi) {
      return this.vsCodeApi.setState(newState);
    }
    return newState;
  }
}

export const vscode = new VSCodeAPIWrapper();
```

**Step 5: Create main.tsx and App.tsx**

`main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`App.tsx`:
```tsx
import React from "react";

const App: React.FC = () => {
  return <div>Claude Control Webview</div>;
};

export default App;
```

**Step 6: Create webview-ui/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

**Step 7: Build and verify**

Run: `cd webview-ui && npm run build`
Expected: `webview-ui/dist/` created with bundled assets

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold webview-ui React project"
```

---

### Task 3: Install Test Infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `src/__tests__/example.test.ts`

**Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

**Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

**Step 3: Write a smoke test**

`src/__tests__/example.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: 1 test passes

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add vitest test infrastructure"
```

---

## Phase 2: Model Types & Store

### Task 4: Define All Model Types

**Files:**
- Create: `src/model/types.ts`

**Step 1: Write the types file**

```typescript
// Scopes
export type Scope = {
  type: "global" | "project";
  label: string;
  path: string; // absolute path to the .claude/ directory
};

// Base for all managed objects
export interface BaseObject {
  id: string; // unique identifier (scope + type + name)
  name: string;
  scope: Scope;
  filePath: string; // absolute path to the backing file
}

// Agents
export interface AgentConfig extends BaseObject {
  type: "agent";
  model?: string;
  instructions?: string;
  permissions?: string[];
  skills?: string[]; // IDs of linked skills
  hooks?: string[]; // IDs of linked hooks
  mcpServers?: string[]; // IDs of linked MCP servers
  claudeMdFiles?: string[]; // IDs of linked CLAUDE.md files
}

// Skills
export interface SkillConfig extends BaseObject {
  type: "skill";
  description?: string;
  triggerConditions?: string;
  skillType?: "rigid" | "flexible";
  content: string;
}

// Hooks
export interface HookConfig extends BaseObject {
  type: "hook";
  event: string; // PreToolUse, PostToolUse, Notification, etc.
  matcher?: string;
  command: string;
  timeout?: number;
  enabled: boolean;
}

// Commands
export interface CommandConfig extends BaseObject {
  type: "command";
  description?: string;
  template: string;
  arguments?: string;
}

// MCP Servers
export interface McpServerConfig extends BaseObject {
  type: "mcpServer";
  transportType: "stdio" | "sse";
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

// Settings
export interface SettingsConfig extends BaseObject {
  type: "settings";
  permissions?: Record<string, string[]>;
  model?: string;
  customInstructions?: string;
  hooks?: string[]; // IDs of linked hooks
  raw: Record<string, unknown>; // full raw JSON
}

// CLAUDE.md
export interface ClaudeMdConfig extends BaseObject {
  type: "claudeMd";
  content: string;
  sections: ClaudeMdSection[];
}

export interface ClaudeMdSection {
  heading: string;
  content: string;
}

// Memory
export interface MemoryConfig extends BaseObject {
  type: "memory";
  topic: string;
  content: string;
}

// Union type
export type ConfigObject =
  | AgentConfig
  | SkillConfig
  | HookConfig
  | CommandConfig
  | McpServerConfig
  | SettingsConfig
  | ClaudeMdConfig
  | MemoryConfig;

export type ConfigObjectType = ConfigObject["type"];

// Connections
export interface Connection {
  id: string;
  sourceId: string;
  sourceType: ConfigObjectType;
  targetId: string;
  targetType: ConfigObjectType;
}

// Messages between extension host and webview
export type ExtensionMessage =
  | { type: "update"; objectType: ConfigObjectType; objects: ConfigObject[] }
  | { type: "connections"; connections: Connection[] }
  | { type: "scopeList"; scopes: Scope[] };

export type WebviewMessage =
  | { type: "save"; object: ConfigObject }
  | { type: "delete"; objectId: string }
  | { type: "connect"; sourceId: string; targetId: string }
  | { type: "disconnect"; connectionId: string }
  | { type: "ready" };
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: define model types for all config objects"
```

---

### Task 5: Create In-Memory Store

**Files:**
- Create: `src/model/store.ts`
- Create: `src/__tests__/store.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../model/store";
import { SkillConfig, AgentConfig, Scope } from "../model/types";

const globalScope: Scope = { type: "global", label: "Global", path: "/home/user/.claude" };

function makeSkill(name: string): SkillConfig {
  return {
    id: `global:skill:${name}`,
    name,
    scope: globalScope,
    filePath: `/home/user/.claude/skills/${name}.md`,
    type: "skill",
    content: "test",
  };
}

function makeAgent(name: string): AgentConfig {
  return {
    id: `global:agent:${name}`,
    name,
    scope: globalScope,
    filePath: `/home/user/.claude/agents/${name}.yml`,
    type: "agent",
  };
}

describe("Store", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it("adds and retrieves objects", () => {
    const skill = makeSkill("tdd");
    store.set(skill);
    expect(store.get("global:skill:tdd")).toEqual(skill);
  });

  it("lists objects by type", () => {
    store.set(makeSkill("tdd"));
    store.set(makeSkill("debug"));
    store.set(makeAgent("dev"));
    expect(store.listByType("skill")).toHaveLength(2);
    expect(store.listByType("agent")).toHaveLength(1);
  });

  it("deletes objects", () => {
    store.set(makeSkill("tdd"));
    store.delete("global:skill:tdd");
    expect(store.get("global:skill:tdd")).toBeUndefined();
  });

  it("manages connections", () => {
    store.set(makeSkill("tdd"));
    store.set(makeAgent("dev"));
    store.connect("global:agent:dev", "agent", "global:skill:tdd", "skill");
    const conns = store.getConnections();
    expect(conns).toHaveLength(1);
    expect(conns[0].sourceId).toBe("global:agent:dev");
    expect(conns[0].targetId).toBe("global:skill:tdd");
  });

  it("removes connections", () => {
    store.set(makeSkill("tdd"));
    store.set(makeAgent("dev"));
    store.connect("global:agent:dev", "agent", "global:skill:tdd", "skill");
    const conn = store.getConnections()[0];
    store.disconnect(conn.id);
    expect(store.getConnections()).toHaveLength(0);
  });

  it("gets connections for a specific object", () => {
    store.set(makeSkill("tdd"));
    store.set(makeSkill("debug"));
    store.set(makeAgent("dev"));
    store.connect("global:agent:dev", "agent", "global:skill:tdd", "skill");
    store.connect("global:agent:dev", "agent", "global:skill:debug", "skill");
    expect(store.getConnectionsFor("global:agent:dev")).toHaveLength(2);
    expect(store.getConnectionsFor("global:skill:tdd")).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/store.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the store**

```typescript
import { ConfigObject, ConfigObjectType, Connection } from "./types";

export class Store {
  private objects = new Map<string, ConfigObject>();
  private connections: Connection[] = [];

  set(obj: ConfigObject): void {
    this.objects.set(obj.id, obj);
  }

  get(id: string): ConfigObject | undefined {
    return this.objects.get(id);
  }

  delete(id: string): void {
    this.objects.delete(id);
    this.connections = this.connections.filter(
      (c) => c.sourceId !== id && c.targetId !== id
    );
  }

  listByType(type: ConfigObjectType): ConfigObject[] {
    return Array.from(this.objects.values()).filter((o) => o.type === type);
  }

  listAll(): ConfigObject[] {
    return Array.from(this.objects.values());
  }

  connect(
    sourceId: string,
    sourceType: ConfigObjectType,
    targetId: string,
    targetType: ConfigObjectType
  ): Connection {
    const conn: Connection = {
      id: `${sourceId}->${targetId}`,
      sourceId,
      sourceType,
      targetId,
      targetType,
    };
    this.connections.push(conn);
    return conn;
  }

  disconnect(connectionId: string): void {
    this.connections = this.connections.filter((c) => c.id !== connectionId);
  }

  getConnections(): Connection[] {
    return [...this.connections];
  }

  getConnectionsFor(objectId: string): Connection[] {
    return this.connections.filter(
      (c) => c.sourceId === objectId || c.targetId === objectId
    );
  }

  clear(): void {
    this.objects.clear();
    this.connections = [];
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/store.test.ts`
Expected: All 6 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add in-memory store with connection management"
```

---

## Phase 3: Serializers (TDD)

Each serializer reads files from disk and returns typed objects, and writes typed objects back to disk. These are the most critical code — incorrect serialization corrupts user configs.

### Task 6: Settings Serializer

**Files:**
- Create: `src/model/serializers/settings.ts`
- Create: `src/__tests__/serializers/settings.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SettingsSerializer } from "../../model/serializers/settings";
import { Scope } from "../../model/types";

describe("SettingsSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("parses settings.json", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      permissions: { allow: ["Read", "Write"], deny: ["Bash"] },
      model: "claude-sonnet-4-6"
    }));

    const result = SettingsSerializer.read(settingsPath, scope);
    expect(result.type).toBe("settings");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.permissions).toEqual({ allow: ["Read", "Write"], deny: ["Bash"] });
  });

  it("writes settings.json preserving unknown fields", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      permissions: { allow: ["Read"] },
      someOtherField: true
    }));

    const settings = SettingsSerializer.read(settingsPath, scope);
    settings.model = "claude-opus-4-6";
    SettingsSerializer.write(settings);

    const written = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(written.model).toBe("claude-opus-4-6");
    expect(written.someOtherField).toBe(true);
  });

  it("returns empty settings for missing file", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    const result = SettingsSerializer.read(settingsPath, scope);
    expect(result.type).toBe("settings");
    expect(result.raw).toEqual({});
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/serializers/settings.test.ts`
Expected: FAIL

**Step 3: Implement**

```typescript
import * as fs from "fs";
import * as path from "path";
import { SettingsConfig, Scope } from "../types";

export class SettingsSerializer {
  static read(filePath: string, scope: Scope): SettingsConfig {
    let raw: Record<string, unknown> = {};

    if (fs.existsSync(filePath)) {
      raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }

    return {
      id: `${scope.type}:${scope.label}:settings:main`,
      name: "settings",
      type: "settings",
      scope,
      filePath,
      permissions: raw.permissions as Record<string, string[]> | undefined,
      model: raw.model as string | undefined,
      customInstructions: raw.customInstructions as string | undefined,
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
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/serializers/settings.test.ts`
Expected: All 3 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add settings serializer with TDD"
```

---

### Task 7: Hooks Serializer

**Files:**
- Create: `src/model/serializers/hooks.ts`
- Create: `src/__tests__/serializers/hooks.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { HooksSerializer } from "../../model/serializers/hooks";
import { Scope } from "../../model/types";

describe("HooksSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("parses hooks from settings.json", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", command: "echo lint", timeout: 5000 }
        ],
        PostToolUse: [
          { matcher: "*", command: "echo done" }
        ]
      }
    }));

    const results = HooksSerializer.readAll(settingsPath, scope);
    expect(results).toHaveLength(2);
    expect(results[0].event).toBe("PreToolUse");
    expect(results[0].matcher).toBe("Bash");
    expect(results[0].command).toBe("echo lint");
    expect(results[1].event).toBe("PostToolUse");
  });

  it("writes a hook back into settings.json", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({ model: "sonnet" }));

    const hook = {
      id: `global:Global:hook:PreToolUse:0`,
      name: "lint",
      type: "hook" as const,
      scope,
      filePath: settingsPath,
      event: "PreToolUse",
      matcher: "Bash",
      command: "echo lint",
      timeout: 5000,
      enabled: true,
    };

    HooksSerializer.write(hook);
    const written = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(written.model).toBe("sonnet");
    expect(written.hooks.PreToolUse).toHaveLength(1);
    expect(written.hooks.PreToolUse[0].command).toBe("echo lint");
  });

  it("returns empty array for file without hooks", () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({}));
    const results = HooksSerializer.readAll(settingsPath, scope);
    expect(results).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/serializers/hooks.test.ts`
Expected: FAIL

**Step 3: Implement**

```typescript
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

    raw.hooks[hook.event].push(entry);

    const dir = path.dirname(hook.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(hook.filePath, JSON.stringify(raw, null, 2) + "\n");
  }

  static remove(hook: HookConfig): void {
    if (!fs.existsSync(hook.filePath)) return;

    const raw = JSON.parse(fs.readFileSync(hook.filePath, "utf-8"));
    if (!raw.hooks?.[hook.event]) return;

    const parts = hook.id.split(":");
    const index = parseInt(parts[parts.length - 1], 10);
    raw.hooks[hook.event].splice(index, 1);

    if (raw.hooks[hook.event].length === 0) delete raw.hooks[hook.event];
    if (Object.keys(raw.hooks).length === 0) delete raw.hooks;

    fs.writeFileSync(hook.filePath, JSON.stringify(raw, null, 2) + "\n");
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/serializers/hooks.test.ts`
Expected: All 3 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add hooks serializer with TDD"
```

---

### Task 8: Skills Serializer

**Files:**
- Create: `src/model/serializers/skills.ts`
- Create: `src/__tests__/serializers/skills.test.ts`

Skills are markdown files in `.claude/skills/` with YAML-like frontmatter (name, description, trigger).

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SkillsSerializer } from "../../model/serializers/skills";
import { Scope } from "../../model/types";

describe("SkillsSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    fs.mkdirSync(path.join(tmpDir, "skills"), { recursive: true });
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("reads a skill markdown file", () => {
    const skillPath = path.join(tmpDir, "skills", "tdd.md");
    fs.writeFileSync(skillPath, [
      "---",
      "name: tdd",
      "description: Test-driven development workflow",
      "---",
      "",
      "# TDD Skill",
      "",
      "Write tests first.",
    ].join("\n"));

    const result = SkillsSerializer.read(skillPath, scope);
    expect(result.type).toBe("skill");
    expect(result.name).toBe("tdd");
    expect(result.description).toBe("Test-driven development workflow");
    expect(result.content).toContain("# TDD Skill");
  });

  it("reads all skills from a directory", () => {
    fs.writeFileSync(path.join(tmpDir, "skills", "a.md"), "---\nname: a\n---\nContent A");
    fs.writeFileSync(path.join(tmpDir, "skills", "b.md"), "---\nname: b\n---\nContent B");

    const results = SkillsSerializer.readAll(tmpDir, scope);
    expect(results).toHaveLength(2);
  });

  it("writes a skill to markdown", () => {
    const skillPath = path.join(tmpDir, "skills", "new.md");
    SkillsSerializer.write({
      id: "global:Global:skill:new",
      name: "new",
      type: "skill",
      scope,
      filePath: skillPath,
      description: "A new skill",
      content: "# New\n\nDo things.",
    });

    const written = fs.readFileSync(skillPath, "utf-8");
    expect(written).toContain("name: new");
    expect(written).toContain("description: A new skill");
    expect(written).toContain("# New");
  });

  it("handles skill without frontmatter", () => {
    const skillPath = path.join(tmpDir, "skills", "plain.md");
    fs.writeFileSync(skillPath, "Just content, no frontmatter.");

    const result = SkillsSerializer.read(skillPath, scope);
    expect(result.name).toBe("plain");
    expect(result.content).toBe("Just content, no frontmatter.");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/serializers/skills.test.ts`
Expected: FAIL

**Step 3: Implement**

```typescript
import * as fs from "fs";
import * as path from "path";
import { SkillConfig, Scope } from "../types";

export class SkillsSerializer {
  static read(filePath: string, scope: Scope): SkillConfig {
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
      id: `${scope.type}:${scope.label}:skill:${frontmatter.name || fileName}`,
      name: frontmatter.name || fileName,
      type: "skill",
      scope,
      filePath,
      description: frontmatter.description,
      triggerConditions: frontmatter.trigger,
      skillType: frontmatter.type as "rigid" | "flexible" | undefined,
      content,
    };
  }

  static readAll(claudeDir: string, scope: Scope): SkillConfig[] {
    const skillsDir = path.join(claudeDir, "skills");
    if (!fs.existsSync(skillsDir)) return [];

    return fs
      .readdirSync(skillsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => SkillsSerializer.read(path.join(skillsDir, f), scope));
  }

  static write(skill: SkillConfig): void {
    const lines: string[] = ["---"];
    lines.push(`name: ${skill.name}`);
    if (skill.description) lines.push(`description: ${skill.description}`);
    if (skill.triggerConditions) lines.push(`trigger: ${skill.triggerConditions}`);
    if (skill.skillType) lines.push(`type: ${skill.skillType}`);
    lines.push("---");
    lines.push("");
    lines.push(skill.content);

    const dir = path.dirname(skill.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(skill.filePath, lines.join("\n"));
  }

  static delete(skill: SkillConfig): void {
    if (fs.existsSync(skill.filePath)) fs.unlinkSync(skill.filePath);
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/serializers/skills.test.ts`
Expected: All 4 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add skills serializer with TDD"
```

---

### Task 9: Commands Serializer

Same pattern as skills — markdown files in `.claude/commands/`. Follow the exact same test/implement/commit pattern from Task 8, adapted for command fields (template, arguments). The filename becomes the slash command name.

**Files:**
- Create: `src/model/serializers/commands.ts`
- Create: `src/__tests__/serializers/commands.test.ts`

**Key differences from skills:**
- Directory: `.claude/commands/` instead of `.claude/skills/`
- Frontmatter fields: `name`, `description`, `arguments`
- Body is the command `template`
- ID format: `${scope.type}:${scope.label}:command:${name}`

Follow the same TDD cycle: write 3-4 tests, run to verify failure, implement, verify pass, commit with message `"feat: add commands serializer with TDD"`.

---

### Task 10: MCP Servers Serializer

**Files:**
- Create: `src/model/serializers/mcp-servers.ts`
- Create: `src/__tests__/serializers/mcp-servers.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { McpServersSerializer } from "../../model/serializers/mcp-servers";
import { Scope } from "../../model/types";

describe("McpServersSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("reads mcp.json", () => {
    const mcpPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(mcpPath, JSON.stringify({
      mcpServers: {
        github: {
          type: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: { GITHUB_TOKEN: "abc" }
        },
        remote: {
          type: "sse",
          url: "http://localhost:3000/sse"
        }
      }
    }));

    const results = McpServersSerializer.readAll(mcpPath, scope);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("github");
    expect(results[0].transportType).toBe("stdio");
    expect(results[0].command).toBe("npx");
    expect(results[0].args).toEqual(["-y", "@modelcontextprotocol/server-github"]);
    expect(results[1].name).toBe("remote");
    expect(results[1].transportType).toBe("sse");
    expect(results[1].url).toBe("http://localhost:3000/sse");
  });

  it("writes a new server to mcp.json", () => {
    const mcpPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers: {} }));

    McpServersSerializer.write({
      id: "global:Global:mcpServer:test",
      name: "test",
      type: "mcpServer",
      scope,
      filePath: mcpPath,
      transportType: "stdio",
      command: "node",
      args: ["server.js"],
      env: {},
      enabled: true,
    });

    const written = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    expect(written.mcpServers.test).toBeDefined();
    expect(written.mcpServers.test.command).toBe("node");
  });

  it("removes a server from mcp.json", () => {
    const mcpPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(mcpPath, JSON.stringify({
      mcpServers: { a: { type: "stdio", command: "a" }, b: { type: "stdio", command: "b" } }
    }));

    McpServersSerializer.remove("a", mcpPath);
    const written = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    expect(written.mcpServers.a).toBeUndefined();
    expect(written.mcpServers.b).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/serializers/mcp-servers.test.ts`
Expected: FAIL

**Step 3: Implement**

```typescript
import * as fs from "fs";
import * as path from "path";
import { McpServerConfig, Scope } from "../types";

export class McpServersSerializer {
  static readAll(mcpPath: string, scope: Scope): McpServerConfig[] {
    if (!fs.existsSync(mcpPath)) return [];

    const raw = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    if (!raw.mcpServers) return [];

    return Object.entries(raw.mcpServers).map(([name, config]: [string, any]) => ({
      id: `${scope.type}:${scope.label}:mcpServer:${name}`,
      name,
      type: "mcpServer" as const,
      scope,
      filePath: mcpPath,
      transportType: config.type === "sse" ? "sse" : "stdio",
      command: config.command,
      url: config.url,
      args: config.args,
      env: config.env,
      enabled: config.disabled !== true,
    }));
  }

  static write(server: McpServerConfig): void {
    let raw: Record<string, any> = {};
    if (fs.existsSync(server.filePath)) {
      raw = JSON.parse(fs.readFileSync(server.filePath, "utf-8"));
    }
    if (!raw.mcpServers) raw.mcpServers = {};

    const entry: Record<string, any> = { type: server.transportType };
    if (server.command) entry.command = server.command;
    if (server.url) entry.url = server.url;
    if (server.args?.length) entry.args = server.args;
    if (server.env && Object.keys(server.env).length) entry.env = server.env;
    if (!server.enabled) entry.disabled = true;

    raw.mcpServers[server.name] = entry;

    const dir = path.dirname(server.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(server.filePath, JSON.stringify(raw, null, 2) + "\n");
  }

  static remove(name: string, mcpPath: string): void {
    if (!fs.existsSync(mcpPath)) return;

    const raw = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    if (raw.mcpServers) {
      delete raw.mcpServers[name];
      fs.writeFileSync(mcpPath, JSON.stringify(raw, null, 2) + "\n");
    }
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/serializers/mcp-servers.test.ts`
Expected: All 3 tests pass

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add MCP servers serializer with TDD"
```

---

### Task 11: Agents Serializer

**Files:**
- Create: `src/model/serializers/agents.ts`
- Create: `src/__tests__/serializers/agents.test.ts`

Agents are YAML files in `.claude/agents/`. Install `yaml` package: `npm install yaml`.

Follow the same TDD pattern. Key fields: `model`, `instructions`, `permissions`, `skills` (array of skill names), `hooks` (array of hook references), `mcpServers` (array of server names), `claudeMdFiles` (array of paths).

Tests should cover: reading a YAML agent file, writing an agent back, round-trip preserving all fields, handling missing file.

Commit message: `"feat: add agents serializer with TDD"`

---

### Task 12: CLAUDE.md Serializer

**Files:**
- Create: `src/model/serializers/claude-md.ts`
- Create: `src/__tests__/serializers/claude-md.test.ts`

Reads `CLAUDE.md` files and parses them into sections (split on `## ` headings). Writes sections back as markdown. Tests should cover: parsing headings into sections, round-trip, file with no headings (single section), finding all CLAUDE.md files in a project (root + `.claude/CLAUDE.md`).

Commit message: `"feat: add CLAUDE.md serializer with TDD"`

---

### Task 13: Memory Serializer

**Files:**
- Create: `src/model/serializers/memory.ts`
- Create: `src/__tests__/serializers/memory.test.ts`

Reads from `~/.claude/projects/<project-path>/memory/`. The project path is the workspace folder path with `/` replaced by `-` and leading `-`. Tests should cover: reading MEMORY.md, reading additional topic files, writing memory content, path derivation from workspace folder.

Commit message: `"feat: add memory serializer with TDD"`

---

## Phase 4: Extension Infrastructure

### Task 14: Scope Discovery

**Files:**
- Create: `src/scopes.ts`
- Create: `src/__tests__/scopes.test.ts`

**Step 1: Write the failing test**

```typescript
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
});
```

**Step 2-5:** Implement `discoverScopes(globalClaudeDir, workspaceFolders)` that returns `Scope[]`, run tests, commit with `"feat: add scope discovery"`.

---

### Task 15: File Watcher Setup

**Files:**
- Create: `src/watchers/file-watcher.ts`

No unit test for this one — it's pure VS Code API glue. Creates `FileSystemWatcher` instances for each discovered scope and fires callbacks on change/create/delete.

```typescript
import * as vscode from "vscode";
import { Scope } from "./model/types";

export class ClaudeFileWatcher implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private onChange: () => void;

  constructor(scopes: Scope[], onChange: () => void) {
    this.onChange = onChange;

    for (const scope of scopes) {
      const pattern = new vscode.RelativePattern(scope.path, "**/*");
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidChange(() => this.onChange());
      watcher.onDidCreate(() => this.onChange());
      watcher.onDidDelete(() => this.onChange());
      this.watchers.push(watcher);
    }
  }

  dispose(): void {
    this.watchers.forEach((w) => w.dispose());
  }
}
```

Commit: `"feat: add file watcher for .claude directories"`

---

### Task 16: Tree View Provider

**Files:**
- Create: `src/tree/provider.ts`
- Create: `src/tree/items.ts`

Implement `TreeDataProvider` that groups by object type (top-level nodes: Agents, Skills, Hooks, Commands, MCP Servers, Settings, CLAUDE.md, Memory). Children are the actual objects with scope badges. Context menu actions: create, delete, duplicate, open editor.

This is VS Code API code — test via integration tests later. Commit: `"feat: add tree view data provider"`

---

### Task 17: Webview Panel Manager

**Files:**
- Create: `src/webview/panel-manager.ts`

Manages creating/showing webview panels for each editor type. Handles postMessage communication between extension host and webview. Sends initial state on panel open. Receives save/delete/connect/disconnect messages and dispatches to serializers.

Commit: `"feat: add webview panel manager"`

---

### Task 18: Wire Up Extension Activation

**Files:**
- Modify: `src/extension.ts`

Connect everything: discover scopes, create store, load all objects via serializers, register tree view, register commands, start file watchers.

Commit: `"feat: wire up extension activation with all components"`

---

## Phase 5: Webview Editors

### Task 19: Shared Webview Components

**Files:**
- Create: `webview-ui/src/components/FormField.tsx`
- Create: `webview-ui/src/components/ScopeBadge.tsx`
- Create: `webview-ui/src/components/LinkableItems.tsx`
- Create: `webview-ui/src/hooks/useExtensionState.ts`

`FormField` — renders labeled input, textarea, dropdown, toggle, key-value editor, or list editor based on a `fieldType` prop. Uses `@vscode/webview-ui-toolkit` components.

`ScopeBadge` — colored badge showing Global/Project name.

`LinkableItems` — drag-and-drop panel using `@dnd-kit`. Shows available objects that can be linked, and a drop zone for currently linked items. On drop, sends `connect` message to extension host. On remove, sends `disconnect`.

`useExtensionState` — React hook that listens for `postMessage` from extension host and provides current object data + `sendMessage` function.

Install dependencies:
```bash
cd webview-ui && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Commit: `"feat: add shared webview components (FormField, ScopeBadge, LinkableItems)"`

---

### Task 20: Agent Editor

**Files:**
- Create: `webview-ui/src/editors/AgentEditor.tsx`

Form fields: name (text), model (dropdown: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001), instructions (textarea), permissions (multi-select).

LinkableItems sections: Skills, MCP Servers, Hooks, CLAUDE.md files.

Commit: `"feat: add agent editor webview"`

---

### Task 21: Remaining Editor Components

Create one editor per object type, following the AgentEditor pattern:

- `SkillEditor.tsx` — name, description, trigger, type (dropdown), content (textarea)
- `HookEditor.tsx` — event (dropdown), matcher, command, timeout, enabled toggle
- `CommandEditor.tsx` — name, description, template (textarea), arguments
- `McpServerEditor.tsx` — name, transport (dropdown), command/URL, args (list), env (key-value), enabled toggle
- `SettingsEditor.tsx` — permissions (key-value with list values), model (dropdown), custom instructions (textarea). LinkableItems: Hooks
- `ClaudeMdEditor.tsx` — section-based editor, add/remove/reorder sections
- `MemoryEditor.tsx` — topic (text), content (textarea)

Each follows the same pattern: `useExtensionState` hook for data, `FormField` components for inputs, `LinkableItems` where applicable, `sendMessage({ type: "save", object })` on change.

Commit each editor separately or batch: `"feat: add all editor webview components"`

---

## Phase 6: Connections View

### Task 22: Install React Flow

```bash
cd webview-ui && npm install @xyflow/react
```

Commit: `"chore: add @xyflow/react dependency"`

---

### Task 23: Connections View Component

**Files:**
- Create: `webview-ui/src/connections/ConnectionsView.tsx`

Uses `@xyflow/react` to render all objects as nodes arranged in columns by type. Connections are edges between nodes. Nodes are colored/badged by scope.

Features:
- Filter dropdowns: by scope, by object type
- Drag a node onto another node to create a connection (uses React Flow's `onConnect` callback)
- Click an edge to select it, press delete or click remove button to disconnect
- Click a node to open its editor panel (sends message to extension host)
- Auto-layout: dagre or elkjs for positioning nodes

Install layout dependency:
```bash
cd webview-ui && npm install dagre @types/dagre
```

Commit: `"feat: add connections view with React Flow"`

---

### Task 24: Register Connections View Command

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/webview/panel-manager.ts`

Add `claudeControl.showConnections` command that opens the ConnectionsView in a webview panel. Panel manager sends all objects + connections to the webview on open and on change.

Commit: `"feat: register connections view command"`

---

## Phase 7: Integration & Polish

### Task 25: Integration Tests

**Files:**
- Create: `src/__tests__/integration/extension.test.ts`

Using `@vscode/test-electron`, test:
1. Extension activates
2. Tree view populates with object types
3. Creating a skill file causes tree view to update
4. Opening an editor panel shows correct data
5. Saving from editor panel writes to disk

Install: `npm install --save-dev @vscode/test-electron`

Commit: `"test: add integration tests for extension lifecycle"`

---

### Task 26: Activity Bar Icon

**Files:**
- Create: `resources/icon.svg`

Simple SVG icon for the activity bar (Claude-themed or gear/config themed).

Commit: `"feat: add activity bar icon"`

---

### Task 27: README

**Files:**
- Create: `README.md`

Document: what the extension does, how to install, supported object types, screenshots placeholder, how to contribute.

Commit: `"docs: add README"`

---

## Execution Notes

- Tasks 9, 11, 12, 13 follow the same TDD pattern as Tasks 6-8, 10 — write tests first, implement, verify, commit
- Tasks 20-21 follow the same React component pattern as Task 19
- Each task is independent enough for a fresh agent to pick up with context from this plan
- The design document at `docs/plans/2026-03-05-claude-control-plugin-design.md` has full architectural context
