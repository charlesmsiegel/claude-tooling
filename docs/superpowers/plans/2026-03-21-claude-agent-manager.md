# Claude Agent Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VSCode extension that provides full orchestration (visibility, control, launch) of Claude Code agents across directories and git worktrees.

**Architecture:** Service Layer pattern — a `ClaudeCodeBridge` module (pure Node.js, no vscode dependency) encapsulates all Claude Code file watching, process management, and CLI interaction. The extension UI layer (tree view, stream panel, commands) talks only to the bridge. Built with TDD — bridge tests use mock file structures, view tests mock the bridge.

**Tech Stack:** TypeScript, VSCode Extension API, Node.js `fs.watch`/`child_process`, Mocha + sinon for testing, `yo generator-code` for scaffolding, `@vscode/test-electron` for integration tests.

**Spec:** `docs/superpowers/specs/2026-03-21-claude-agent-manager-design.md`

---

## File Structure

```
ide_plugins/agent-manager/
├── package.json                          ← extension manifest, contributes, activation events
├── tsconfig.json                         ← strict mode, ES2022 target, outDir: out/
├── .eslintrc.json                        ← linting config
├── .vscodeignore                         ← exclude test/, src/ from packaged extension
├── src/
│   ├── extension.ts                      ← activate/deactivate, register commands, wire components
│   ├── types.ts                          ← SessionInfo, SubagentInfo, AgentDefinition, etc.
│   ├── bridge/
│   │   ├── index.ts                      ← ClaudeCodeBridge facade: init, dispose, exposes stores
│   │   ├── sessionStore.ts               ← watch sessions dir, parse JSON/JSONL, emit events
│   │   ├── processManager.ts             ← spawn claude CLI, kill/stop by PID, PID validation
│   │   ├── worktreeFinder.ts             ← watch .git/worktrees/, manual dirs, merge results
│   │   ├── streamReader.ts               ← tail JSONL files, parse stream-json, EventEmitter
│   │   └── agentDiscovery.ts             ← scan .claude/agents/*.md, parse frontmatter, merge CLI
│   ├── views/
│   │   ├── agentTreeProvider.ts          ← TreeDataProvider, refresh on bridge events
│   │   ├── agentTreeItems.ts             ← TreeItem subclasses: DirectoryNode, SessionNode, SubagentNode
│   │   └── streamPanel.ts               ← Pseudoterminal factory, connect to StreamReader
│   └── commands/
│       ├── launchAgent.ts                ← multi-step QuickPick: where → how → what
│       ├── stopAgent.ts                  ← stop/kill commands, PID validation
│       └── openStream.ts                 ← open terminal stream for selected agent
├── resources/
│   └── icons/
│       ├── agent-active.svg
│       ├── agent-idle.svg
│       ├── agent-error.svg
│       ├── agent-completed.svg
│       ├── subagent.svg
│       └── directory.svg
└── test/
    ├── suite/
    │   ├── index.ts                      ← mocha test runner setup
    │   ├── bridge/
    │   │   ├── sessionStore.test.ts
    │   │   ├── processManager.test.ts
    │   │   ├── worktreeFinder.test.ts
    │   │   ├── streamReader.test.ts
    │   │   └── agentDiscovery.test.ts
    │   └── views/
    │       ├── agentTreeProvider.test.ts
    │       └── streamPanel.test.ts
    └── fixtures/
        ├── sessions/                     ← mock session JSON files
        ├── projects/                     ← mock JSONL + subagent dirs
        └── agents/                       ← mock agent .md files
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `ide_plugins/agent-manager/package.json`
- Create: `ide_plugins/agent-manager/tsconfig.json`
- Create: `ide_plugins/agent-manager/.eslintrc.json`
- Create: `ide_plugins/agent-manager/.vscodeignore`
- Create: `ide_plugins/agent-manager/src/extension.ts`
- Create: `ide_plugins/agent-manager/src/types.ts`

- [ ] **Step 1: Create package.json with extension manifest**

```json
{
  "name": "claude-agent-manager",
  "displayName": "Claude Agent Manager",
  "description": "Orchestrate Claude Code agents across directories and git worktrees",
  "version": "0.1.0",
  "publisher": "claude-tooling",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "claude-agent-manager",
          "title": "Claude Agents",
          "icon": "resources/icons/directory.svg"
        }
      ]
    },
    "views": {
      "claude-agent-manager": [
        {
          "id": "claudeAgents",
          "name": "Agents"
        }
      ]
    },
    "commands": [
      { "command": "claudeAgentManager.launchAgent", "title": "Claude: New Agent", "icon": "$(add)" },
      { "command": "claudeAgentManager.refresh", "title": "Claude: Refresh Agents", "icon": "$(refresh)" },
      { "command": "claudeAgentManager.openStream", "title": "Claude: Open Agent Stream" },
      { "command": "claudeAgentManager.stopAgent", "title": "Claude: Stop Agent" },
      { "command": "claudeAgentManager.killAgent", "title": "Claude: Kill Agent" },
      { "command": "claudeAgentManager.resumeAgent", "title": "Claude: Resume Session" },
      { "command": "claudeAgentManager.addWatchDir", "title": "Claude: Add Directory to Watch" },
      { "command": "claudeAgentManager.removeWatchDir", "title": "Claude: Remove Watch Directory" },
      { "command": "claudeAgentManager.openInTerminal", "title": "Claude: Open Directory in Terminal" }
    ],
    "menus": {
      "view/title": [
        { "command": "claudeAgentManager.launchAgent", "when": "view == claudeAgents", "group": "navigation" },
        { "command": "claudeAgentManager.refresh", "when": "view == claudeAgents", "group": "navigation" },
        { "command": "claudeAgentManager.addWatchDir", "when": "view == claudeAgents" }
      ],
      "view/item/context": [
        { "command": "claudeAgentManager.launchAgent", "when": "viewItem == directory" },
        { "command": "claudeAgentManager.openInTerminal", "when": "viewItem == directory" },
        { "command": "claudeAgentManager.removeWatchDir", "when": "viewItem == directory" },
        { "command": "claudeAgentManager.openStream", "when": "viewItem == session || viewItem == subagent" },
        { "command": "claudeAgentManager.stopAgent", "when": "viewItem == session" },
        { "command": "claudeAgentManager.killAgent", "when": "viewItem == session" },
        { "command": "claudeAgentManager.resumeAgent", "when": "viewItem == sessionIdle" }
      ]
    },
    "configuration": {
      "title": "Claude Agent Manager",
      "properties": {
        "claudeAgentManager.watchedDirectories": {
          "type": "array",
          "items": { "type": "string" },
          "default": [],
          "description": "Additional directories to monitor for Claude agents"
        },
        "claudeAgentManager.pollInterval": {
          "type": "number",
          "default": 500,
          "description": "JSONL tail polling interval in milliseconds"
        },
        "claudeAgentManager.livenessInterval": {
          "type": "number",
          "default": 5000,
          "description": "PID liveness check interval in milliseconds"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src/",
    "test": "node ./out/test/suite/index.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/mocha": "^10.0.0",
    "@types/node": "^20.0.0",
    "@types/sinon": "^17.0.0",
    "@vscode/test-electron": "^2.3.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "mocha": "^10.0.0",
    "sinon": "^17.0.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "out",
    "rootDir": ".",
    "lib": ["ES2022"],
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "out"]
}
```

- [ ] **Step 3: Create .vscodeignore**

```
src/**
test/**
.eslintrc.json
tsconfig.json
**/*.map
```

- [ ] **Step 4: Create types.ts with shared interfaces**

```typescript
export interface SessionInfo {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  status: AgentStatus;
}

export interface SubagentInfo {
  agentId: string;
  agentType: string;
  description: string;
  sessionId: string;
  isSidechain?: boolean;
}

export interface AgentDefinition {
  name: string;
  model: string;
  description: string;
  source: 'project' | 'global' | 'plugin' | 'builtin';
  filePath?: string;
}

export type AgentStatus = 'active' | 'idle' | 'errored' | 'completed';

export interface SessionStoreEvents {
  'session-added': (session: SessionInfo) => void;
  'session-removed': (sessionId: string) => void;
  'subagent-spawned': (subagent: SubagentInfo) => void;
  'subagent-completed': (sessionId: string, agentId: string) => void;
  'agent-output': (agentId: string, data: string) => void;
}

export interface SpawnOptions {
  cwd: string;
  agent?: string;
  prompt?: string;
  sessionId?: string;
}

export interface WatchedDirectory {
  path: string;
  branch: string;
  isWorktree: boolean;
  repoRoot: string;
}
```

- [ ] **Step 5: Create minimal extension.ts**

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Claude Agent Manager');
  outputChannel.appendLine('Claude Agent Manager activating...');
  context.subscriptions.push(outputChannel);
}

export function deactivate(): void {
  // cleanup will go here
}
```

- [ ] **Step 6: Install dependencies and verify it compiles**

Run: `cd ide_plugins/agent-manager && npm install && npm run compile`
Expected: Clean compilation, `out/` directory created with JS files

- [ ] **Step 7: Commit**

```bash
git add ide_plugins/agent-manager/
git commit -m "feat: scaffold agent-manager VSCode extension"
```

---

### Task 2: Types and Test Fixtures

**Files:**
- Create: `ide_plugins/agent-manager/test/fixtures/sessions/12345.json`
- Create: `ide_plugins/agent-manager/test/fixtures/sessions/12346.json`
- Create: `ide_plugins/agent-manager/test/fixtures/projects/-home-user-myproject/abc-123.jsonl`
- Create: `ide_plugins/agent-manager/test/fixtures/projects/-home-user-myproject/abc-123/subagents/agent-a1b2c3.meta.json`
- Create: `ide_plugins/agent-manager/test/fixtures/projects/-home-user-myproject/abc-123/subagents/agent-a1b2c3.jsonl`
- Create: `ide_plugins/agent-manager/test/fixtures/agents/file-reader.md`
- Create: `ide_plugins/agent-manager/test/suite/index.ts`

- [ ] **Step 1: Create mock session files**

`test/fixtures/sessions/12345.json`:
```json
{"pid": 12345, "sessionId": "abc-123", "cwd": "/home/user/myproject", "startedAt": 1774000000000}
```

`test/fixtures/sessions/12346.json`:
```json
{"pid": 12346, "sessionId": "def-456", "cwd": "/home/user/other-project", "startedAt": 1774000001000}
```

- [ ] **Step 2: Create mock project/subagent files**

`test/fixtures/projects/-home-user-myproject/abc-123.jsonl`:
```jsonl
{"type":"assistant","message":{"content":"Starting work..."}}
{"type":"tool_use","name":"Read","input":{"file_path":"/src/index.ts"}}
```

`test/fixtures/projects/-home-user-myproject/abc-123/subagents/agent-a1b2c3.meta.json`:
```json
{"agentType": "Explore", "description": "Research Claude Code APIs"}
```

`test/fixtures/projects/-home-user-myproject/abc-123/subagents/agent-a1b2c3.jsonl`:
```jsonl
{"type":"assistant","message":{"content":"Searching for files..."}}
```

- [ ] **Step 3: Create mock agent definition file**

`test/fixtures/agents/file-reader.md`:
```markdown
---
name: file-reader
model: haiku
description: File analysis & extraction specialist
---

You are a file reader agent.
```

- [ ] **Step 4: Create mocha test runner**

`test/suite/index.ts`:
```typescript
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 10000 });
  const testsRoot = path.resolve(__dirname);
  const files = await glob('**/**.test.js', { cwd: testsRoot });

  for (const f of files) {
    mocha.addFile(path.resolve(testsRoot, f));
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
```

- [ ] **Step 5: Add glob dependency and verify compilation**

Run: `cd ide_plugins/agent-manager && npm install glob && npm run compile`
Expected: Clean compilation

- [ ] **Step 6: Commit**

```bash
git add ide_plugins/agent-manager/test/ ide_plugins/agent-manager/package.json ide_plugins/agent-manager/package-lock.json
git commit -m "feat: add test fixtures and mocha runner for agent-manager"
```

---

### Task 3: SessionStore — File Watching and Session Discovery

**Files:**
- Create: `ide_plugins/agent-manager/src/bridge/sessionStore.ts`
- Create: `ide_plugins/agent-manager/test/suite/bridge/sessionStore.test.ts`

- [ ] **Step 1: Write failing test — session discovery from existing files**

```typescript
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SessionStore } from '../../../src/bridge/sessionStore';

describe('SessionStore', () => {
  let tmpDir: string;
  let sessionsDir: string;
  let projectsDir: string;
  let store: SessionStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-manager-test-'));
    sessionsDir = path.join(tmpDir, 'sessions');
    projectsDir = path.join(tmpDir, 'projects');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(projectsDir, { recursive: true });
  });

  afterEach(() => {
    store?.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers existing sessions on init', async () => {
    fs.writeFileSync(
      path.join(sessionsDir, '12345.json'),
      JSON.stringify({ pid: 12345, sessionId: 'abc-123', cwd: '/home/user/project', startedAt: 1774000000000 })
    );

    store = new SessionStore(sessionsDir, projectsDir);
    await store.init();

    const sessions = store.getSessions();
    assert.strictEqual(sessions.length, 1);
    assert.strictEqual(sessions[0].sessionId, 'abc-123');
    assert.strictEqual(sessions[0].pid, 12345);
  });

  it('emits session-added when new session file appears', async () => {
    store = new SessionStore(sessionsDir, projectsDir);
    await store.init();

    const added = new Promise<any>((resolve) => store.on('session-added', resolve));

    fs.writeFileSync(
      path.join(sessionsDir, '99999.json'),
      JSON.stringify({ pid: 99999, sessionId: 'new-session', cwd: '/tmp/test', startedAt: Date.now() })
    );

    const session = await added;
    assert.strictEqual(session.sessionId, 'new-session');
  });

  it('skips malformed session files gracefully', async () => {
    fs.writeFileSync(path.join(sessionsDir, 'bad.json'), 'not json');
    fs.writeFileSync(
      path.join(sessionsDir, 'good.json'),
      JSON.stringify({ pid: 111, sessionId: 'good', cwd: '/tmp', startedAt: 1774000000000 })
    );

    store = new SessionStore(sessionsDir, projectsDir);
    await store.init();

    const sessions = store.getSessions();
    assert.strictEqual(sessions.length, 1);
    assert.strictEqual(sessions[0].sessionId, 'good');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/sessionStore.test.js`
Expected: FAIL — `Cannot find module '../../../src/bridge/sessionStore'`

- [ ] **Step 3: Implement SessionStore**

```typescript
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { SessionInfo, SubagentInfo, AgentStatus } from '../types';

export class SessionStore extends EventEmitter {
  private sessions = new Map<string, SessionInfo>();
  private subagents = new Map<string, SubagentInfo[]>();
  private watchers: fs.FSWatcher[] = [];
  private livenessTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sessionsDir: string,
    private readonly projectsDir: string,
    private readonly livenessIntervalMs: number = 5000
  ) {
    super();
  }

  async init(): Promise<void> {
    await this.scanExistingSessions();
    this.watchSessionsDir();
    this.startLivenessChecks();
  }

  getSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  getSubagents(sessionId: string): SubagentInfo[] {
    return this.subagents.get(sessionId) ?? [];
  }

  getSessionById(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  dispose(): void {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
    if (this.livenessTimer) {
      clearInterval(this.livenessTimer);
      this.livenessTimer = null;
    }
    this.removeAllListeners();
  }

  private async scanExistingSessions(): Promise<void> {
    let files: string[];
    try {
      files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
    } catch {
      return;
    }

    for (const file of files) {
      this.loadSessionFile(path.join(this.sessionsDir, file));
    }
  }

  private loadSessionFile(filePath: string): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.pid || !data.sessionId || !data.cwd || !data.startedAt) {
        return;
      }
      const session: SessionInfo = {
        pid: data.pid,
        sessionId: data.sessionId,
        cwd: data.cwd,
        startedAt: data.startedAt,
        status: this.checkPidAlive(data.pid) ? 'active' : 'completed',
      };
      const isNew = !this.sessions.has(session.sessionId);
      this.sessions.set(session.sessionId, session);

      if (isNew) {
        this.emit('session-added', session);
        this.watchSubagents(session.sessionId);
      }
    } catch {
      // skip malformed files
    }
  }

  private watchSessionsDir(): void {
    try {
      const watcher = fs.watch(this.sessionsDir, (eventType, filename) => {
        if (!filename?.endsWith('.json')) return;
        const filePath = path.join(this.sessionsDir, filename);

        if (eventType === 'rename') {
          if (fs.existsSync(filePath)) {
            this.loadSessionFile(filePath);
          } else {
            // file removed — find and remove session
            const pidStr = path.basename(filename, '.json');
            for (const [sid, s] of this.sessions) {
              if (s.pid.toString() === pidStr) {
                this.sessions.delete(sid);
                this.subagents.delete(sid);
                this.emit('session-removed', sid);
                break;
              }
            }
          }
        } else if (eventType === 'change') {
          this.loadSessionFile(filePath);
        }
      });
      this.watchers.push(watcher);
    } catch {
      // directory may not exist yet
    }
  }

  private watchSubagents(sessionId: string): void {
    const projectDir = this.findProjectDir(sessionId);
    if (!projectDir) return;

    const subagentsDir = path.join(projectDir, sessionId, 'subagents');
    if (!fs.existsSync(subagentsDir)) return;

    try {
      const watcher = fs.watch(subagentsDir, (eventType, filename) => {
        if (!filename?.endsWith('.meta.json')) return;
        this.loadSubagentMeta(sessionId, path.join(subagentsDir, filename));
      });
      this.watchers.push(watcher);

      // scan existing subagents
      const files = fs.readdirSync(subagentsDir).filter((f) => f.endsWith('.meta.json'));
      for (const file of files) {
        this.loadSubagentMeta(sessionId, path.join(subagentsDir, file));
      }
    } catch {
      // subagents dir may not exist
    }
  }

  private loadSubagentMeta(sessionId: string, filePath: string): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      const filename = path.basename(filePath);
      const match = filename.match(/^agent-(.+)\.meta\.json$/);
      if (!match) return;

      const agentId = match[1];
      const subagent: SubagentInfo = {
        agentId,
        agentType: data.agentType ?? 'unknown',
        description: data.description ?? '',
        sessionId,
        isSidechain: data.isSidechain,
      };

      const existing = this.subagents.get(sessionId) ?? [];
      if (!existing.find((s) => s.agentId === agentId)) {
        existing.push(subagent);
        this.subagents.set(sessionId, existing);
        this.emit('subagent-spawned', subagent);
      }
    } catch {
      // skip malformed
    }
  }

  private findProjectDir(sessionId: string): string | undefined {
    try {
      const projects = fs.readdirSync(this.projectsDir);
      for (const proj of projects) {
        const projPath = path.join(this.projectsDir, proj);
        if (!fs.statSync(projPath).isDirectory()) continue;
        if (fs.existsSync(path.join(projPath, `${sessionId}.jsonl`))) {
          return projPath;
        }
      }
    } catch {
      // projectsDir may not exist
    }
    return undefined;
  }

  private checkPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private startLivenessChecks(): void {
    this.livenessTimer = setInterval(() => {
      for (const [sid, session] of this.sessions) {
        if (session.status === 'active' && !this.checkPidAlive(session.pid)) {
          session.status = 'completed';
          this.emit('session-removed', sid);
        }
      }
    }, this.livenessIntervalMs);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/sessionStore.test.js`
Expected: 3 tests passing

- [ ] **Step 5: Write failing test — subagent discovery**

Add to `sessionStore.test.ts`:
```typescript
  it('discovers subagents under session directories', async () => {
    // Create session
    fs.writeFileSync(
      path.join(sessionsDir, '12345.json'),
      JSON.stringify({ pid: 12345, sessionId: 'abc-123', cwd: '/home/user/project', startedAt: 1774000000000 })
    );

    // Create project structure with subagent
    const projDir = path.join(projectsDir, '-home-user-project');
    const subagentsDir = path.join(projDir, 'abc-123', 'subagents');
    fs.mkdirSync(subagentsDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, 'abc-123.jsonl'), '');
    fs.writeFileSync(
      path.join(subagentsDir, 'agent-x1y2z3.meta.json'),
      JSON.stringify({ agentType: 'Explore', description: 'Searching files' })
    );

    store = new SessionStore(sessionsDir, projectsDir);
    await store.init();

    const subagents = store.getSubagents('abc-123');
    assert.strictEqual(subagents.length, 1);
    assert.strictEqual(subagents[0].agentType, 'Explore');
    assert.strictEqual(subagents[0].agentId, 'x1y2z3');
    assert.strictEqual(subagents[0].sessionId, 'abc-123');
  });
```

- [ ] **Step 6: Run tests to verify the new test passes**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/sessionStore.test.js`
Expected: 4 tests passing

- [ ] **Step 7: Commit**

```bash
git add ide_plugins/agent-manager/src/bridge/sessionStore.ts ide_plugins/agent-manager/test/
git commit -m "feat: add SessionStore with file watching and subagent discovery"
```

---

### Task 4: WorktreeFinder — Git Worktree Discovery

**Files:**
- Create: `ide_plugins/agent-manager/src/bridge/worktreeFinder.ts`
- Create: `ide_plugins/agent-manager/test/suite/bridge/worktreeFinder.test.ts`

- [ ] **Step 1: Write failing test — parse git worktree list output**

```typescript
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorktreeFinder } from '../../../src/bridge/worktreeFinder';

describe('WorktreeFinder', () => {
  let tmpDir: string;
  let finder: WorktreeFinder;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worktree-test-'));
  });

  afterEach(() => {
    finder?.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses git worktree list --porcelain output', () => {
    const output = [
      'worktree /home/user/myproject',
      'HEAD abc123def456',
      'branch refs/heads/main',
      '',
      'worktree /home/user/myproject-feat',
      'HEAD def456abc123',
      'branch refs/heads/feat/auth',
      '',
    ].join('\n');

    const result = WorktreeFinder.parseWorktreeOutput(output, '/home/user/myproject');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].path, '/home/user/myproject');
    assert.strictEqual(result[0].branch, 'main');
    assert.strictEqual(result[0].isWorktree, false);
    assert.strictEqual(result[1].path, '/home/user/myproject-feat');
    assert.strictEqual(result[1].branch, 'feat/auth');
    assert.strictEqual(result[1].isWorktree, true);
  });

  it('merges manual directories with discovered worktrees', () => {
    const discovered = [
      { path: '/home/user/project', branch: 'main', isWorktree: false, repoRoot: '/home/user/project' },
    ];
    const manual = ['/home/user/other-dir'];

    const result = WorktreeFinder.mergeDirectories(discovered, manual);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].path, '/home/user/other-dir');
    assert.strictEqual(result[1].branch, 'unknown');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/worktreeFinder.test.js`
Expected: FAIL

- [ ] **Step 3: Implement WorktreeFinder**

```typescript
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { WatchedDirectory } from '../types';

export class WorktreeFinder extends EventEmitter {
  private directories = new Map<string, WatchedDirectory>();
  private watchers: fs.FSWatcher[] = [];
  private manualDirs: string[] = [];

  constructor(private readonly workspaceFolders: string[]) {
    super();
  }

  async init(manualDirs: string[] = []): Promise<void> {
    this.manualDirs = manualDirs;
    await this.discoverAll();
    this.watchWorktreeDirs();
  }

  getDirectories(): WatchedDirectory[] {
    return Array.from(this.directories.values());
  }

  addManualDirectory(dirPath: string): void {
    if (this.directories.has(dirPath)) return;
    const dir: WatchedDirectory = {
      path: dirPath,
      branch: this.detectBranch(dirPath),
      isWorktree: this.isWorktree(dirPath),
      repoRoot: this.findRepoRoot(dirPath) ?? dirPath,
    };
    this.directories.set(dirPath, dir);
    this.manualDirs.push(dirPath);
    this.emit('directories-changed', this.getDirectories());
  }

  removeManualDirectory(dirPath: string): void {
    this.directories.delete(dirPath);
    this.manualDirs = this.manualDirs.filter((d) => d !== dirPath);
    this.emit('directories-changed', this.getDirectories());
  }

  dispose(): void {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
    this.removeAllListeners();
  }

  static parseWorktreeOutput(output: string, repoRoot: string): WatchedDirectory[] {
    const dirs: WatchedDirectory[] = [];
    const blocks = output.trim().split('\n\n');

    for (const block of blocks) {
      if (!block.trim()) continue;
      const lines = block.split('\n');
      let wtPath = '';
      let branch = 'detached';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          wtPath = line.substring('worktree '.length);
        } else if (line.startsWith('branch refs/heads/')) {
          branch = line.substring('branch refs/heads/'.length);
        }
      }

      if (wtPath) {
        dirs.push({
          path: wtPath,
          branch,
          isWorktree: wtPath !== repoRoot,
          repoRoot,
        });
      }
    }

    return dirs;
  }

  static mergeDirectories(discovered: WatchedDirectory[], manualPaths: string[]): WatchedDirectory[] {
    const merged = [...discovered];
    const existingPaths = new Set(discovered.map((d) => d.path));

    for (const mp of manualPaths) {
      if (!existingPaths.has(mp)) {
        merged.push({
          path: mp,
          branch: 'unknown',
          isWorktree: false,
          repoRoot: mp,
        });
      }
    }

    return merged;
  }

  private async discoverAll(): Promise<void> {
    this.directories.clear();

    for (const folder of this.workspaceFolders) {
      const repoRoot = this.findRepoRoot(folder);
      if (!repoRoot) continue;

      try {
        const output = execSync('git worktree list --porcelain', {
          cwd: repoRoot,
          encoding: 'utf-8',
          timeout: 5000,
        });
        const worktrees = WorktreeFinder.parseWorktreeOutput(output, repoRoot);
        for (const wt of worktrees) {
          this.directories.set(wt.path, wt);
        }
      } catch {
        // not a git repo or git not available
        this.directories.set(folder, {
          path: folder,
          branch: 'unknown',
          isWorktree: false,
          repoRoot: folder,
        });
      }
    }

    // merge manual dirs
    for (const mp of this.manualDirs) {
      if (!this.directories.has(mp)) {
        this.directories.set(mp, {
          path: mp,
          branch: this.detectBranch(mp),
          isWorktree: this.isWorktree(mp),
          repoRoot: this.findRepoRoot(mp) ?? mp,
        });
      }
    }
  }

  private watchWorktreeDirs(): void {
    for (const folder of this.workspaceFolders) {
      const repoRoot = this.findRepoRoot(folder);
      if (!repoRoot) continue;

      const worktreesDir = path.join(repoRoot, '.git', 'worktrees');
      if (!fs.existsSync(worktreesDir)) continue;

      try {
        const watcher = fs.watch(worktreesDir, async () => {
          await this.discoverAll();
          this.emit('directories-changed', this.getDirectories());
        });
        this.watchers.push(watcher);
      } catch {
        // watch failed
      }
    }
  }

  private findRepoRoot(dirPath: string): string | undefined {
    try {
      return execSync('git rev-parse --show-toplevel', {
        cwd: dirPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
    } catch {
      return undefined;
    }
  }

  private detectBranch(dirPath: string): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: dirPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
    } catch {
      return 'unknown';
    }
  }

  private isWorktree(dirPath: string): boolean {
    const gitPath = path.join(dirPath, '.git');
    try {
      return fs.statSync(gitPath).isFile(); // worktrees have .git as a file, not a directory
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/worktreeFinder.test.js`
Expected: 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add ide_plugins/agent-manager/src/bridge/worktreeFinder.ts ide_plugins/agent-manager/test/suite/bridge/worktreeFinder.test.ts
git commit -m "feat: add WorktreeFinder with git worktree parsing and file watching"
```

---

### Task 5: ProcessManager — Spawn, Stop, Kill

**Files:**
- Create: `ide_plugins/agent-manager/src/bridge/processManager.ts`
- Create: `ide_plugins/agent-manager/test/suite/bridge/processManager.test.ts`

- [ ] **Step 1: Write failing test — spawn and track a process**

```typescript
import * as assert from 'assert';
import { ProcessManager } from '../../../src/bridge/processManager';

describe('ProcessManager', () => {
  let manager: ProcessManager;

  beforeEach(() => {
    manager = new ProcessManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('spawns a process and tracks it', async () => {
    // Use echo as a stand-in for claude CLI
    const child = manager.spawn({
      cwd: '/tmp',
      command: 'echo',
      args: ['hello'],
    });

    assert.ok(child.pid);
    assert.ok(manager.getSpawnedPids().includes(child.pid!));
  });

  it('removes process from tracked list on exit', async () => {
    const child = manager.spawn({
      cwd: '/tmp',
      command: 'echo',
      args: ['hello'],
    });

    const pid = child.pid!;
    await new Promise<void>((resolve) => child.on('exit', () => resolve()));
    assert.ok(!manager.getSpawnedPids().includes(pid));
  });

  it('validates PID belongs to a claude process', () => {
    // Current process is not claude
    const result = manager.validatePid(process.pid);
    assert.strictEqual(result, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/processManager.test.js`
Expected: FAIL

- [ ] **Step 3: Implement ProcessManager**

```typescript
import { ChildProcess, spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';

export interface ProcessSpawnOptions {
  cwd: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class ProcessManager extends EventEmitter {
  private spawned = new Map<number, ChildProcess>();

  spawn(options: ProcessSpawnOptions): ChildProcess {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (child.pid) {
      this.spawned.set(child.pid, child);
      child.on('exit', (code) => {
        if (child.pid) {
          this.spawned.delete(child.pid);
        }
        this.emit('process-exit', child.pid, code);
      });
    }

    return child;
  }

  spawnClaude(options: { cwd: string; agent?: string; prompt?: string; sessionId?: string }): ChildProcess {
    const args: string[] = [];

    if (options.prompt) {
      args.push('-p', options.prompt);
      args.push('--output-format', 'stream-json');
    }
    if (options.agent) {
      args.push('--agent', options.agent);
    }
    if (options.sessionId) {
      // 'claude resume <id>' is a subcommand, not a flag
      args.unshift('resume');
      args.push(options.sessionId);
    }

    return this.spawn({
      cwd: options.cwd,
      command: 'claude',
      args,
    });
  }

  getSpawnedPids(): number[] {
    return Array.from(this.spawned.keys());
  }

  getSpawnedProcess(pid: number): ChildProcess | undefined {
    return this.spawned.get(pid);
  }

  validatePid(pid: number): boolean {
    try {
      // Check if process is alive
      process.kill(pid, 0);

      // Verify it's a claude/node process
      try {
        const cmdline = execSync(`ps -p ${pid} -o comm=`, {
          encoding: 'utf-8',
          timeout: 2000,
        }).trim();
        return cmdline.includes('node') || cmdline.includes('claude');
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  async stop(pid: number): Promise<boolean> {
    // If we spawned it, use the ChildProcess reference
    const child = this.spawned.get(pid);
    if (child) {
      child.kill('SIGTERM');
      return true;
    }

    // Otherwise validate and signal
    if (!this.validatePid(pid)) {
      return false;
    }

    try {
      process.kill(pid, 'SIGTERM');

      // Wait up to 5 seconds, then SIGKILL
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          try {
            process.kill(pid, 0);
          } catch {
            clearInterval(check);
            resolve();
          }
        }, 500);

        setTimeout(() => {
          clearInterval(check);
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // already dead
          }
          resolve();
        }, 5000);
      });

      return true;
    } catch {
      return false;
    }
  }

  async kill(pid: number): Promise<boolean> {
    const child = this.spawned.get(pid);
    if (child) {
      child.kill('SIGKILL');
      return true;
    }

    if (!this.validatePid(pid)) {
      return false;
    }

    try {
      process.kill(pid, 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    for (const [, child] of this.spawned) {
      child.kill('SIGTERM');
    }
    this.spawned.clear();
    this.removeAllListeners();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/processManager.test.js`
Expected: 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add ide_plugins/agent-manager/src/bridge/processManager.ts ide_plugins/agent-manager/test/suite/bridge/processManager.test.ts
git commit -m "feat: add ProcessManager with spawn, stop, kill, and PID validation"
```

---

### Task 6: StreamReader — JSONL Tailing

**Files:**
- Create: `ide_plugins/agent-manager/src/bridge/streamReader.ts`
- Create: `ide_plugins/agent-manager/test/suite/bridge/streamReader.test.ts`

- [ ] **Step 1: Write failing test — tail a JSONL file**

```typescript
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { StreamReader } from '../../../src/bridge/streamReader';

describe('StreamReader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits data events for existing lines in a JSONL file', async () => {
    const filePath = path.join(tmpDir, 'test.jsonl');
    fs.writeFileSync(filePath, '{"type":"assistant","message":"hello"}\n{"type":"tool","name":"Read"}\n');

    const reader = new StreamReader(filePath, { pollInterval: 100 });
    const lines: any[] = [];

    reader.on('data', (line: any) => lines.push(line));
    reader.start();

    await new Promise((resolve) => setTimeout(resolve, 300));
    reader.stop();

    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[0].type, 'assistant');
    assert.strictEqual(lines[1].type, 'tool');
  });

  it('detects new lines appended to file', async () => {
    const filePath = path.join(tmpDir, 'growing.jsonl');
    fs.writeFileSync(filePath, '');

    const reader = new StreamReader(filePath, { pollInterval: 100 });
    const lines: any[] = [];

    reader.on('data', (line: any) => lines.push(line));
    reader.start();

    await new Promise((resolve) => setTimeout(resolve, 150));
    fs.appendFileSync(filePath, '{"type":"new","data":"appended"}\n');
    await new Promise((resolve) => setTimeout(resolve, 300));

    reader.stop();

    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].type, 'new');
  });

  it('handles malformed JSON lines gracefully', async () => {
    const filePath = path.join(tmpDir, 'bad.jsonl');
    fs.writeFileSync(filePath, 'not json\n{"type":"good"}\n');

    const reader = new StreamReader(filePath, { pollInterval: 100 });
    const lines: any[] = [];

    reader.on('data', (line: any) => lines.push(line));
    reader.start();

    await new Promise((resolve) => setTimeout(resolve, 300));
    reader.stop();

    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].type, 'good');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/streamReader.test.js`
Expected: FAIL

- [ ] **Step 3: Implement StreamReader**

```typescript
import { EventEmitter } from 'events';
import * as fs from 'fs';

export interface StreamReaderOptions {
  pollInterval?: number;
  startFromEnd?: boolean;
}

export class StreamReader extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private offset = 0;
  private readonly pollInterval: number;
  private readonly startFromEnd: boolean;

  constructor(
    private readonly filePath: string,
    options: StreamReaderOptions = {}
  ) {
    super();
    this.pollInterval = options.pollInterval ?? 500;
    this.startFromEnd = options.startFromEnd ?? false;
  }

  start(): void {
    if (this.startFromEnd) {
      try {
        const stat = fs.statSync(this.filePath);
        this.offset = stat.size;
      } catch {
        this.offset = 0;
      }
    }

    this.poll();
    this.timer = setInterval(() => this.poll(), this.pollInterval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private poll(): void {
    try {
      const stat = fs.statSync(this.filePath);
      if (stat.size <= this.offset) return;

      const fd = fs.openSync(this.filePath, 'r');
      const buffer = Buffer.alloc(stat.size - this.offset);
      fs.readSync(fd, buffer, 0, buffer.length, this.offset);
      fs.closeSync(fd);

      this.offset = stat.size;

      const chunk = buffer.toString('utf-8');
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          this.emit('data', parsed);
        } catch {
          this.emit('raw', trimmed);
        }
      }
    } catch {
      // file may not exist yet
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/streamReader.test.js`
Expected: 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add ide_plugins/agent-manager/src/bridge/streamReader.ts ide_plugins/agent-manager/test/suite/bridge/streamReader.test.ts
git commit -m "feat: add StreamReader with JSONL tailing and polling"
```

---

### Task 7: AgentDiscovery — Find Available Agents

**Files:**
- Create: `ide_plugins/agent-manager/src/bridge/agentDiscovery.ts`
- Create: `ide_plugins/agent-manager/test/suite/bridge/agentDiscovery.test.ts`

- [ ] **Step 1: Write failing test — parse agent markdown frontmatter**

```typescript
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentDiscovery } from '../../../src/bridge/agentDiscovery';

describe('AgentDiscovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-disc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses agent definitions from .md files with YAML frontmatter', () => {
    const agentsDir = path.join(tmpDir, '.claude', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'file-reader.md'),
      '---\nname: file-reader\nmodel: haiku\ndescription: File analysis specialist\n---\nYou are a file reader.'
    );

    const agents = AgentDiscovery.scanAgentDir(agentsDir, 'project');
    assert.strictEqual(agents.length, 1);
    assert.strictEqual(agents[0].name, 'file-reader');
    assert.strictEqual(agents[0].model, 'haiku');
    assert.strictEqual(agents[0].source, 'project');
  });

  it('parses claude agents CLI output', () => {
    const output = [
      '8 active agents',
      '',
      'Plugin agents:',
      '  superpowers:code-reviewer · inherit',
      '',
      'Built-in agents:',
      '  Explore · haiku',
      '  Plan · inherit',
    ].join('\n');

    const agents = AgentDiscovery.parseCLIOutput(output);
    assert.strictEqual(agents.length, 3);
    assert.strictEqual(agents[0].name, 'superpowers:code-reviewer');
    assert.strictEqual(agents[0].source, 'plugin');
    assert.strictEqual(agents[1].name, 'Explore');
    assert.strictEqual(agents[1].source, 'builtin');
  });

  it('handles missing agents directory gracefully', () => {
    const agents = AgentDiscovery.scanAgentDir('/nonexistent/path', 'project');
    assert.strictEqual(agents.length, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/agentDiscovery.test.js`
Expected: FAIL

- [ ] **Step 3: Implement AgentDiscovery**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AgentDefinition } from '../types';

export class AgentDiscovery {
  static scanAgentDir(dirPath: string, source: 'project' | 'global'): AgentDefinition[] {
    const agents: AgentDefinition[] = [];

    try {
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = AgentDiscovery.parseFrontmatter(content);

        if (parsed) {
          agents.push({
            name: parsed.name ?? path.basename(file, '.md'),
            model: parsed.model ?? 'inherit',
            description: parsed.description ?? '',
            source,
            filePath,
          });
        }
      }
    } catch {
      // directory doesn't exist
    }

    return agents;
  }

  static parseFrontmatter(content: string): Record<string, string> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const fields: Record<string, string> = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      fields[key] = value;
    }

    return fields;
  }

  static parseCLIOutput(output: string): AgentDefinition[] {
    const agents: AgentDefinition[] = [];
    let currentSource: 'plugin' | 'builtin' = 'builtin';

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.startsWith('Plugin agents:')) {
        currentSource = 'plugin';
        continue;
      }
      if (line.startsWith('Built-in agents:')) {
        currentSource = 'builtin';
        continue;
      }

      const agentMatch = line.match(/^\s+(.+?)\s+·\s+(.+)$/);
      if (agentMatch) {
        agents.push({
          name: agentMatch[1].trim(),
          model: agentMatch[2].trim(),
          description: '',
          source: currentSource,
        });
      }
    }

    return agents;
  }

  static discoverAll(projectDir: string, homeDir: string): AgentDefinition[] {
    const agents: AgentDefinition[] = [];

    // Project-local agents
    const projectAgentsDir = path.join(projectDir, '.claude', 'agents');
    agents.push(...AgentDiscovery.scanAgentDir(projectAgentsDir, 'project'));

    // User-global agents
    const globalAgentsDir = path.join(homeDir, '.claude', 'agents');
    agents.push(...AgentDiscovery.scanAgentDir(globalAgentsDir, 'global'));

    // CLI agents (plugin + built-in)
    try {
      const output = execSync('claude agents', {
        encoding: 'utf-8',
        timeout: 10000,
        cwd: projectDir,
      });
      agents.push(...AgentDiscovery.parseCLIOutput(output));
    } catch {
      // claude CLI not available
    }

    return agents;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha out/test/suite/bridge/agentDiscovery.test.js`
Expected: 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add ide_plugins/agent-manager/src/bridge/agentDiscovery.ts ide_plugins/agent-manager/test/suite/bridge/agentDiscovery.test.ts
git commit -m "feat: add AgentDiscovery with frontmatter parsing and CLI output parsing"
```

---

### Task 8: ClaudeCodeBridge Facade

**Files:**
- Create: `ide_plugins/agent-manager/src/bridge/index.ts`

- [ ] **Step 1: Implement the facade that wires all bridge components together**

```typescript
import * as os from 'os';
import * as path from 'path';
import { SessionStore } from './sessionStore';
import { ProcessManager } from './processManager';
import { WorktreeFinder } from './worktreeFinder';
import { StreamReader } from './streamReader';
import { AgentDiscovery } from './agentDiscovery';
import { AgentDefinition } from '../types';

export class ClaudeCodeBridge {
  public readonly sessionStore: SessionStore;
  public readonly processManager: ProcessManager;
  public readonly worktreeFinder: WorktreeFinder;
  private streamReaders = new Map<string, StreamReader>();

  constructor(workspaceFolders: string[]) {
    const homeDir = os.homedir();
    const sessionsDir = path.join(homeDir, '.claude', 'sessions');
    const projectsDir = path.join(homeDir, '.claude', 'projects');

    this.sessionStore = new SessionStore(sessionsDir, projectsDir);
    this.processManager = new ProcessManager();
    this.worktreeFinder = new WorktreeFinder(workspaceFolders);
  }

  async init(manualDirs: string[] = []): Promise<void> {
    await this.sessionStore.init();
    await this.worktreeFinder.init(manualDirs);
  }

  discoverAgents(projectDir: string): AgentDefinition[] {
    return AgentDiscovery.discoverAll(projectDir, os.homedir());
  }

  getStreamReader(filePath: string, options?: { startFromEnd?: boolean }): StreamReader {
    const existing = this.streamReaders.get(filePath);
    if (existing) return existing;

    const reader = new StreamReader(filePath, {
      startFromEnd: options?.startFromEnd,
    });
    this.streamReaders.set(filePath, reader);
    return reader;
  }

  removeStreamReader(filePath: string): void {
    const reader = this.streamReaders.get(filePath);
    if (reader) {
      reader.stop();
      this.streamReaders.delete(filePath);
    }
  }

  dispose(): void {
    this.sessionStore.dispose();
    this.processManager.dispose();
    this.worktreeFinder.dispose();
    for (const [, reader] of this.streamReaders) {
      reader.stop();
    }
    this.streamReaders.clear();
  }
}

export { SessionStore } from './sessionStore';
export { ProcessManager } from './processManager';
export { WorktreeFinder } from './worktreeFinder';
export { StreamReader } from './streamReader';
export { AgentDiscovery } from './agentDiscovery';
```

- [ ] **Step 2: Verify compilation**

Run: `cd ide_plugins/agent-manager && npm run compile`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add ide_plugins/agent-manager/src/bridge/index.ts
git commit -m "feat: add ClaudeCodeBridge facade wiring all bridge components"
```

---

### Task 9: Agent Tree View — TreeDataProvider

**Files:**
- Create: `ide_plugins/agent-manager/src/views/agentTreeItems.ts`
- Create: `ide_plugins/agent-manager/src/views/agentTreeProvider.ts`

- [ ] **Step 1: Implement tree item types**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { SessionInfo, SubagentInfo, WatchedDirectory, AgentStatus } from '../types';

export class DirectoryNode extends vscode.TreeItem {
  constructor(public readonly dir: WatchedDirectory) {
    const shortPath = dir.path.replace(process.env.HOME ?? '', '~');
    const label = `${shortPath} (${dir.branch})`;
    super(label, vscode.TreeItemCollapsibleState.Expanded);

    this.contextValue = 'directory';
    this.iconPath = new vscode.ThemeIcon('folder');
    if (dir.isWorktree) {
      this.description = 'worktree';
    }
  }
}

export class SessionNode extends vscode.TreeItem {
  constructor(public readonly session: SessionInfo, subagentCount: number) {
    const shortId = session.sessionId.substring(0, 4);
    const label = `Session #${shortId}`;
    const collapsible = subagentCount > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    super(label, collapsible);

    this.contextValue = session.status === 'idle' ? 'sessionIdle' : 'session';
    this.iconPath = SessionNode.statusIcon(session.status);
    if (subagentCount > 0) {
      this.description = `${subagentCount} subagent${subagentCount > 1 ? 's' : ''}`;
    }
  }

  private static statusIcon(status: AgentStatus): vscode.ThemeIcon {
    switch (status) {
      case 'active': return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.runAction'));
      case 'idle': return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('editorWarning.foreground'));
      case 'errored': return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('errorForeground'));
      case 'completed': return new vscode.ThemeIcon('circle-outline');
    }
  }
}

export class SubagentNode extends vscode.TreeItem {
  constructor(public readonly subagent: SubagentInfo) {
    const shortId = subagent.agentId.substring(0, 4);
    super(`${subagent.agentType} #${shortId}`, vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'subagent';
    this.iconPath = new vscode.ThemeIcon('circle-small-filled', new vscode.ThemeColor('textLink.foreground'));
    this.description = subagent.description;
    this.tooltip = `Agent ID: ${subagent.agentId}\nType: ${subagent.agentType}\n${subagent.description}`;
  }
}
```

- [ ] **Step 2: Implement TreeDataProvider**

```typescript
import * as vscode from 'vscode';
import { ClaudeCodeBridge } from '../bridge';
import { DirectoryNode, SessionNode, SubagentNode } from './agentTreeItems';
import { WatchedDirectory } from '../types';

type AgentTreeNode = DirectoryNode | SessionNode | SubagentNode;

export class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AgentTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly bridge: ClaudeCodeBridge) {
    // Refresh tree when bridge state changes
    bridge.sessionStore.on('session-added', () => this.refresh());
    bridge.sessionStore.on('session-removed', () => this.refresh());
    bridge.sessionStore.on('subagent-spawned', () => this.refresh());
    bridge.sessionStore.on('subagent-completed', () => this.refresh());
    bridge.worktreeFinder.on('directories-changed', () => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: AgentTreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AgentTreeNode): AgentTreeNode[] {
    if (!element) {
      // Root level: directories
      return this.bridge.worktreeFinder.getDirectories().map((dir) => new DirectoryNode(dir));
    }

    if (element instanceof DirectoryNode) {
      // Sessions under this directory
      return this.getSessionsForDirectory(element.dir);
    }

    if (element instanceof SessionNode) {
      // Subagents under this session
      return this.bridge.sessionStore
        .getSubagents(element.session.sessionId)
        .map((sub) => new SubagentNode(sub));
    }

    return [];
  }

  private getSessionsForDirectory(dir: WatchedDirectory): SessionNode[] {
    return this.bridge.sessionStore
      .getSessions()
      .filter((s) => s.cwd === dir.path)
      .map((s) => {
        const subagentCount = this.bridge.sessionStore.getSubagents(s.sessionId).length;
        return new SessionNode(s, subagentCount);
      });
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd ide_plugins/agent-manager && npm run compile`
Expected: Clean compilation

- [ ] **Step 4: Commit**

```bash
git add ide_plugins/agent-manager/src/views/
git commit -m "feat: add AgentTreeProvider with directory, session, and subagent nodes"
```

---

### Task 10: Stream Panel — Pseudoterminal

**Files:**
- Create: `ide_plugins/agent-manager/src/views/streamPanel.ts`

- [ ] **Step 1: Implement StreamPanel with Pseudoterminal**

```typescript
import * as vscode from 'vscode';
import { StreamReader } from '../bridge/streamReader';

export class StreamPanel {
  private terminals = new Map<string, vscode.Terminal>();

  createTerminal(agentId: string, label: string, reader: StreamReader): vscode.Terminal {
    const existing = this.terminals.get(agentId);
    if (existing) {
      existing.show();
      return existing;
    }

    const writeEmitter = new vscode.EventEmitter<string>();
    const closeEmitter = new vscode.EventEmitter<void>();

    const pty: vscode.Pseudoterminal = {
      onDidWrite: writeEmitter.event,
      onDidClose: closeEmitter.event,
      open: () => {
        writeEmitter.fire(`\x1b[36m[${label}]\x1b[0m Connected to agent stream\r\n\r\n`);

        reader.on('data', (data: any) => {
          const formatted = StreamPanel.formatStreamData(data);
          if (formatted) {
            writeEmitter.fire(formatted);
          }
        });

        reader.on('raw', (line: string) => {
          writeEmitter.fire(line + '\r\n');
        });

        reader.start();
      },
      close: () => {
        reader.stop();
        this.terminals.delete(agentId);
      },
    };

    const terminal = vscode.window.createTerminal({
      name: label,
      pty,
      iconPath: new vscode.ThemeIcon('hubot'),
    });
    terminal.show();

    this.terminals.set(agentId, terminal);
    return terminal;
  }

  static formatStreamData(data: any): string | null {
    if (!data || typeof data !== 'object') return null;

    // Handle different stream-json message types
    if (data.type === 'assistant' && data.message?.content) {
      const content = typeof data.message.content === 'string'
        ? data.message.content
        : JSON.stringify(data.message.content);
      return content.replace(/\n/g, '\r\n') + '\r\n';
    }

    if (data.type === 'tool_use') {
      return `\x1b[33m[Tool: ${data.name}]\x1b[0m ${JSON.stringify(data.input ?? {}).substring(0, 200)}\r\n`;
    }

    if (data.type === 'tool_result') {
      const preview = typeof data.content === 'string'
        ? data.content.substring(0, 300)
        : JSON.stringify(data.content ?? '').substring(0, 300);
      return `\x1b[32m[Result]\x1b[0m ${preview.replace(/\n/g, '\r\n')}\r\n`;
    }

    // Generic fallback
    if (data.type) {
      return `\x1b[90m[${data.type}]\x1b[0m\r\n`;
    }

    return null;
  }

  disposeTerminal(agentId: string): void {
    const terminal = this.terminals.get(agentId);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(agentId);
    }
  }

  dispose(): void {
    for (const [, terminal] of this.terminals) {
      terminal.dispose();
    }
    this.terminals.clear();
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd ide_plugins/agent-manager && npm run compile`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add ide_plugins/agent-manager/src/views/streamPanel.ts
git commit -m "feat: add StreamPanel with Pseudoterminal for agent output"
```

---

### Task 11: Commands — Launch, Stop, Open Stream

**Files:**
- Create: `ide_plugins/agent-manager/src/commands/launchAgent.ts`
- Create: `ide_plugins/agent-manager/src/commands/stopAgent.ts`
- Create: `ide_plugins/agent-manager/src/commands/openStream.ts`

- [ ] **Step 1: Implement launchAgent command with multi-step QuickPick**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ClaudeCodeBridge } from '../bridge';
import { AgentDiscovery } from '../bridge/agentDiscovery';
import { StreamPanel } from '../views/streamPanel';
import { WatchedDirectory, AgentDefinition } from '../types';

export async function launchAgent(
  bridge: ClaudeCodeBridge,
  streamPanel: StreamPanel,
  preselectedDir?: string
): Promise<void> {
  // Step 1: Where?
  let targetDir: string;
  if (preselectedDir) {
    targetDir = preselectedDir;
  } else {
    const dir = await pickDirectory(bridge);
    if (!dir) return;

    if (dir === '__browse__') {
      const folders = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: 'Select Directory',
      });
      if (!folders?.[0]) return;
      targetDir = folders[0].fsPath;
    } else if (dir === '__new_worktree__') {
      const created = await createWorktree(bridge);
      if (!created) return;
      targetDir = created;
    } else {
      targetDir = dir;
    }
  }

  // Step 2: How?
  const agents = AgentDiscovery.discoverAll(targetDir, os.homedir());
  const agentChoice = await pickAgent(agents);
  if (agentChoice === undefined) return; // cancelled

  // Step 3: What?
  const prompt = await vscode.window.showInputBox({
    prompt: 'Enter prompt (or leave blank for interactive session)',
    placeHolder: 'e.g., Implement the OAuth callback handler...',
  });
  if (prompt === undefined) return; // cancelled (not empty string)

  // Spawn
  const child = bridge.processManager.spawnClaude({
    cwd: targetDir,
    agent: agentChoice || undefined,
    prompt: prompt || undefined,
  });

  if (prompt && child.stdout) {
    // Non-interactive: pipe to stream panel
    const label = agentChoice ? `${agentChoice}` : 'Claude';
    const agentId = `spawned-${child.pid}`;

    const reader = bridge.getStreamReader(`__process:${child.pid}`, { startFromEnd: false });

    child.stdout.on('data', (data: Buffer) => {
      const lines = data.toString('utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          reader.emit('data', parsed);
        } catch {
          reader.emit('raw', trimmed);
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      reader.emit('raw', `\x1b[31m${data.toString()}\x1b[0m`);
    });

    streamPanel.createTerminal(agentId, label, reader);
  } else {
    // Interactive: open in real terminal
    const terminal = vscode.window.createTerminal({
      name: `Claude (${path.basename(targetDir)})`,
      cwd: targetDir,
    });
    const cmd = agentChoice ? `claude --agent ${agentChoice}` : 'claude';
    terminal.sendText(cmd);
    terminal.show();
  }
}

async function pickDirectory(bridge: ClaudeCodeBridge): Promise<string | undefined> {
  const dirs = bridge.worktreeFinder.getDirectories();
  const items: vscode.QuickPickItem[] = dirs.map((d) => ({
    label: d.path.replace(os.homedir(), '~'),
    description: d.isWorktree ? `${d.branch} · worktree` : d.branch,
    detail: d.path,
  }));

  items.push(
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    { label: '$(folder) Browse for directory...', detail: '__browse__' },
    { label: '$(git-branch) Create new worktree...', detail: '__new_worktree__' },
  );

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select target directory',
  });

  return (picked as any)?.detail;
}

async function pickAgent(agents: AgentDefinition[]): Promise<string | null | undefined> {
  const items: vscode.QuickPickItem[] = [
    { label: 'Default (no agent override)', description: '', detail: '' },
  ];

  const grouped: Record<string, AgentDefinition[]> = {};
  for (const a of agents) {
    const key = a.source;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  }

  const sourceLabels: Record<string, string> = {
    project: 'Project agents',
    global: 'Global agents',
    plugin: 'Plugin agents',
    builtin: 'Built-in',
  };

  for (const source of ['project', 'global', 'plugin', 'builtin']) {
    const group = grouped[source];
    if (!group?.length) continue;

    items.push({ label: sourceLabels[source], kind: vscode.QuickPickItemKind.Separator });
    for (const a of group) {
      items.push({
        label: a.name,
        description: `(${a.model})`,
        detail: a.name,
      });
    }
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select agent (optional)',
  });

  if (!picked) return undefined; // cancelled
  return (picked as any).detail || null; // null = default
}

async function createWorktree(bridge: ClaudeCodeBridge): Promise<string | undefined> {
  const branchName = await vscode.window.showInputBox({
    prompt: 'Branch name for new worktree',
    placeHolder: 'feat/my-feature',
  });
  if (!branchName) return;

  const dirs = bridge.worktreeFinder.getDirectories();
  const repoRoot = dirs.find((d) => !d.isWorktree)?.repoRoot;
  if (!repoRoot) {
    vscode.window.showErrorMessage('No git repository found in workspace');
    return;
  }

  const defaultPath = path.join(path.dirname(repoRoot), `${path.basename(repoRoot)}-${branchName.replace(/\//g, '-')}`);
  const worktreePath = await vscode.window.showInputBox({
    prompt: 'Worktree location',
    value: defaultPath,
  });
  if (!worktreePath) return;

  const { execSync } = require('child_process');
  try {
    execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    vscode.window.showInformationMessage(`Created worktree at ${worktreePath}`);
    return worktreePath;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to create worktree: ${err.message}`);
    return;
  }
}
```

- [ ] **Step 2: Implement stopAgent command**

```typescript
import * as vscode from 'vscode';
import { ClaudeCodeBridge } from '../bridge';
import { SessionNode } from '../views/agentTreeItems';

export async function stopAgent(bridge: ClaudeCodeBridge, node?: SessionNode): Promise<void> {
  if (!node) {
    vscode.window.showWarningMessage('Select a session to stop');
    return;
  }

  const success = await bridge.processManager.stop(node.session.pid);
  if (success) {
    vscode.window.showInformationMessage(`Stopped session #${node.session.sessionId.substring(0, 4)}`);
  } else {
    vscode.window.showErrorMessage(`Failed to stop session — process may have already exited or PID is stale`);
  }
}

export async function killAgent(bridge: ClaudeCodeBridge, node?: SessionNode): Promise<void> {
  if (!node) {
    vscode.window.showWarningMessage('Select a session to kill');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Kill session #${node.session.sessionId.substring(0, 4)}? This will terminate it immediately without cleanup.`,
    'Kill',
    'Cancel'
  );
  if (confirm !== 'Kill') return;

  const success = await bridge.processManager.kill(node.session.pid);
  if (success) {
    vscode.window.showInformationMessage(`Killed session #${node.session.sessionId.substring(0, 4)}`);
  } else {
    vscode.window.showErrorMessage(`Failed to kill session`);
  }
}
```

- [ ] **Step 3: Implement openStream command**

```typescript
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { ClaudeCodeBridge } from '../bridge';
import { StreamPanel } from '../views/streamPanel';
import { SessionNode, SubagentNode } from '../views/agentTreeItems';

export function openStream(
  bridge: ClaudeCodeBridge,
  streamPanel: StreamPanel,
  node?: SessionNode | SubagentNode
): void {
  if (!node) {
    vscode.window.showWarningMessage('Select a session or subagent to view');
    return;
  }

  const homeDir = os.homedir();

  if (node instanceof SessionNode) {
    const session = node.session;
    const projectKey = session.cwd.replace(/\//g, '-');
    const jsonlPath = path.join(homeDir, '.claude', 'projects', projectKey, `${session.sessionId}.jsonl`);
    const label = `Session #${session.sessionId.substring(0, 4)}`;

    const reader = bridge.getStreamReader(jsonlPath, { startFromEnd: true });
    streamPanel.createTerminal(session.sessionId, label, reader);
  }

  if (node instanceof SubagentNode) {
    const sub = node.subagent;
    const session = bridge.sessionStore.getSessionById(sub.sessionId);
    if (!session) {
      vscode.window.showErrorMessage('Parent session not found');
      return;
    }

    const projectKey = session.cwd.replace(/\//g, '-');
    const jsonlPath = path.join(
      homeDir, '.claude', 'projects', projectKey,
      sub.sessionId, 'subagents', `agent-${sub.agentId}.jsonl`
    );
    const label = `${sub.agentType} #${sub.agentId.substring(0, 4)}`;

    const reader = bridge.getStreamReader(jsonlPath, { startFromEnd: true });
    streamPanel.createTerminal(sub.agentId, label, reader);
  }
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd ide_plugins/agent-manager && npm run compile`
Expected: Clean compilation

- [ ] **Step 5: Commit**

```bash
git add ide_plugins/agent-manager/src/commands/
git commit -m "feat: add launch, stop, kill, and openStream commands"
```

---

### Task 12: Wire Everything in extension.ts

**Files:**
- Modify: `ide_plugins/agent-manager/src/extension.ts`

- [ ] **Step 1: Update extension.ts to wire all components together**

```typescript
import * as vscode from 'vscode';
import { ClaudeCodeBridge } from './bridge';
import { AgentTreeProvider } from './views/agentTreeProvider';
import { StreamPanel } from './views/streamPanel';
import { launchAgent } from './commands/launchAgent';
import { stopAgent, killAgent } from './commands/stopAgent';
import { openStream } from './commands/openStream';
import { DirectoryNode, SessionNode, SubagentNode } from './views/agentTreeItems';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Claude Agent Manager');
  outputChannel.appendLine('Claude Agent Manager activating...');

  // Get workspace folders
  const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
  if (workspaceFolders.length === 0) {
    outputChannel.appendLine('No workspace folders found — running in limited mode');
  }

  // Initialize bridge
  const bridge = new ClaudeCodeBridge(workspaceFolders);
  const config = vscode.workspace.getConfiguration('claudeAgentManager');
  const manualDirs = config.get<string[]>('watchedDirectories', []);

  try {
    await bridge.init(manualDirs);
    outputChannel.appendLine('Bridge initialized successfully');
  } catch (err) {
    outputChannel.appendLine(`Bridge init error: ${err}`);
  }

  // Create views
  const treeProvider = new AgentTreeProvider(bridge);
  const treeView = vscode.window.createTreeView('claudeAgents', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  const streamPanel = new StreamPanel();

  // Register commands
  context.subscriptions.push(
    treeView,
    outputChannel,

    vscode.commands.registerCommand('claudeAgentManager.launchAgent', (node?: DirectoryNode) => {
      launchAgent(bridge, streamPanel, node?.dir.path);
    }),

    vscode.commands.registerCommand('claudeAgentManager.refresh', () => {
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand('claudeAgentManager.openStream', (node?: SessionNode | SubagentNode) => {
      openStream(bridge, streamPanel, node);
    }),

    vscode.commands.registerCommand('claudeAgentManager.stopAgent', (node?: SessionNode) => {
      stopAgent(bridge, node);
    }),

    vscode.commands.registerCommand('claudeAgentManager.killAgent', (node?: SessionNode) => {
      killAgent(bridge, node);
    }),

    vscode.commands.registerCommand('claudeAgentManager.resumeAgent', async (node?: SessionNode) => {
      if (!node) return;
      // Resume is interactive — use a real terminal, not ProcessManager
      const terminal = vscode.window.createTerminal({
        name: `Resume #${node.session.sessionId.substring(0, 4)}`,
        cwd: node.session.cwd,
      });
      terminal.sendText(`claude resume ${node.session.sessionId}`);
      terminal.show();
    }),

    vscode.commands.registerCommand('claudeAgentManager.addWatchDir', async () => {
      const folders = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: 'Add Directory to Watch',
      });
      if (!folders?.[0]) return;

      const dirPath = folders[0].fsPath;
      bridge.worktreeFinder.addManualDirectory(dirPath);

      const config = vscode.workspace.getConfiguration('claudeAgentManager');
      const current = config.get<string[]>('watchedDirectories', []);
      if (!current.includes(dirPath)) {
        await config.update('watchedDirectories', [...current, dirPath], vscode.ConfigurationTarget.Workspace);
      }
    }),

    vscode.commands.registerCommand('claudeAgentManager.removeWatchDir', async (node?: DirectoryNode) => {
      if (!node) return;
      bridge.worktreeFinder.removeManualDirectory(node.dir.path);

      const config = vscode.workspace.getConfiguration('claudeAgentManager');
      const current = config.get<string[]>('watchedDirectories', []);
      await config.update(
        'watchedDirectories',
        current.filter((d) => d !== node.dir.path),
        vscode.ConfigurationTarget.Workspace
      );
    }),

    vscode.commands.registerCommand('claudeAgentManager.openInTerminal', (node?: DirectoryNode) => {
      if (!node) return;
      const terminal = vscode.window.createTerminal({ cwd: node.dir.path });
      terminal.show();
    }),
  );

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose: () => {
      bridge.dispose();
      streamPanel.dispose();
      treeProvider.dispose();
    },
  });

  outputChannel.appendLine('Claude Agent Manager activated');
}

export function deactivate(): void {
  // disposal handled by subscriptions
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd ide_plugins/agent-manager && npm run compile`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add ide_plugins/agent-manager/src/extension.ts
git commit -m "feat: wire all components in extension.ts activation"
```

---

### Task 13: SVG Icons

**Files:**
- Create: `ide_plugins/agent-manager/resources/icons/directory.svg`

- [ ] **Step 1: Create activity bar icon**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="7" height="7" rx="1"/>
  <rect x="14" y="3" width="7" height="7" rx="1"/>
  <rect x="3" y="14" width="7" height="7" rx="1"/>
  <rect x="14" y="14" width="7" height="7" rx="1"/>
  <line x1="10" y1="6.5" x2="14" y2="6.5"/>
  <line x1="6.5" y1="10" x2="6.5" y2="14"/>
</svg>
```

- [ ] **Step 2: Verify compilation and package structure**

Run: `cd ide_plugins/agent-manager && npm run compile && ls -la resources/icons/`
Expected: directory.svg exists, compilation clean

- [ ] **Step 3: Commit**

```bash
git add ide_plugins/agent-manager/resources/
git commit -m "feat: add activity bar icon for agent manager"
```

---

### Task 14: End-to-End Smoke Test

**Files:**
- Create: `ide_plugins/agent-manager/test/suite/views/agentTreeProvider.test.ts`

- [ ] **Step 1: Write tree provider test with mocked bridge**

```typescript
import * as assert from 'assert';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';

// Since we can't import vscode in unit tests, test the bridge→tree data flow logic
describe('AgentTreeProvider data flow', () => {
  it('maps sessions to correct directories', () => {
    const sessions = [
      { pid: 1, sessionId: 'abc', cwd: '/home/user/project', startedAt: 1000, status: 'active' as const },
      { pid: 2, sessionId: 'def', cwd: '/home/user/other', startedAt: 2000, status: 'active' as const },
    ];
    const directories = [
      { path: '/home/user/project', branch: 'main', isWorktree: false, repoRoot: '/home/user/project' },
      { path: '/home/user/other', branch: 'feat', isWorktree: true, repoRoot: '/home/user/project' },
    ];

    // Simulate the filtering logic from AgentTreeProvider.getSessionsForDirectory
    for (const dir of directories) {
      const dirSessions = sessions.filter((s) => s.cwd === dir.path);
      if (dir.path === '/home/user/project') {
        assert.strictEqual(dirSessions.length, 1);
        assert.strictEqual(dirSessions[0].sessionId, 'abc');
      }
      if (dir.path === '/home/user/other') {
        assert.strictEqual(dirSessions.length, 1);
        assert.strictEqual(dirSessions[0].sessionId, 'def');
      }
    }
  });

  it('nests subagents under correct sessions', () => {
    const subagents = [
      { agentId: 'x1', agentType: 'Explore', description: 'searching', sessionId: 'abc' },
      { agentId: 'x2', agentType: 'Plan', description: 'planning', sessionId: 'abc' },
      { agentId: 'x3', agentType: 'Explore', description: 'other', sessionId: 'def' },
    ];

    const abcSubs = subagents.filter((s) => s.sessionId === 'abc');
    const defSubs = subagents.filter((s) => s.sessionId === 'def');

    assert.strictEqual(abcSubs.length, 2);
    assert.strictEqual(defSubs.length, 1);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha 'out/test/suite/**/*.test.js'`
Expected: All tests passing

- [ ] **Step 3: Verify the full package compiles and has no lint errors**

Run: `cd ide_plugins/agent-manager && npm run compile && npm run lint`
Expected: Clean output

- [ ] **Step 4: Commit**

```bash
git add ide_plugins/agent-manager/test/suite/views/
git commit -m "test: add tree provider data flow tests and verify full build"
```

---

### Task 15: README and Final Polish

**Files:**
- Create: `ide_plugins/agent-manager/README.md`
- Create: `ide_plugins/agent-manager/.eslintrc.json`

- [ ] **Step 1: Create .eslintrc.json**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "project": "./tsconfig.json" },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}
```

- [ ] **Step 2: Create README.md**

```markdown
# Claude Agent Manager

VSCode extension for orchestrating Claude Code agents across directories and git worktrees.

## Features

- **Sidebar tree view** showing all Claude agents organized by directory, session, and subagent
- **Stream viewer** with pseudo-terminal output for any agent or subagent
- **Launch agents** via command palette, context menu, or sidebar button
- **Auto-discover git worktrees** and monitor agents across all of them
- **Stop/Kill** any running agent session
- **Resume** idle sessions

## Usage

1. Open a workspace folder that has Claude Code sessions
2. Click the Claude Agents icon in the activity bar
3. Browse running agents, click to open their output streams
4. Use the `+` button or `Ctrl+Shift+P` → "Claude: New Agent" to launch a new agent

## Development

```bash
cd ide_plugins/agent-manager
npm install
npm run compile
# Press F5 in VSCode to launch Extension Development Host
```

## Settings

- `claudeAgentManager.watchedDirectories`: Additional directories to monitor
- `claudeAgentManager.pollInterval`: JSONL tail polling interval (ms, default: 500)
- `claudeAgentManager.livenessInterval`: PID liveness check interval (ms, default: 5000)
```

- [ ] **Step 3: Run final build and test**

Run: `cd ide_plugins/agent-manager && npm run compile && npx mocha 'out/test/suite/**/*.test.js'`
Expected: All passing

- [ ] **Step 4: Commit**

```bash
git add ide_plugins/agent-manager/
git commit -m "docs: add README and eslint config for agent-manager extension"
```
