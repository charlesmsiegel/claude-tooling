# Claude Agent Manager — VSCode Extension Design

## Overview

A VSCode extension that provides full orchestration of Claude Code agents: visibility into running sessions and their subagents, real-time stream viewing, and the ability to launch, stop, and manage agents across directories and git worktrees.

**Location:** `ide_plugins/agent-manager/`
**Target:** VSCode and VSCode forks (Cursor, Windsurf, etc.)
**Language:** TypeScript

## Problem

When working with multiple Claude Code agents — especially across git worktrees — the current experience has three sharp pain points:

1. **No visibility into subagents.** When a main session spawns Explore, Plan, or general-purpose subagents, there's no way to see what they're doing without reading JSONL files manually.
2. **Terminal sprawl.** Managing a dozen terminal tabs to monitor multiple agents is tedious and error-prone.
3. **Manual worktree agent setup.** Launching an agent on a worktree requires opening a new terminal, navigating to the worktree directory, starting Claude, and typing the prompt.

## Architecture

### Approach: Service Layer (Internal Bridge Module)

A `ClaudeCodeBridge` module encapsulates all interaction with Claude Code internals. The extension UI never touches files or processes directly — it talks to the bridge. This provides:

- Testability: mock the bridge for UI tests, test the bridge against real files independently
- Isolation: when Claude Code changes internal file formats, only the bridge breaks
- Extractability: the bridge could become a standalone npm package for other editors later

```
┌─────────────────────────────────────────────────┐
│                  VSCode Extension                │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │  Sidebar      │    │  Bottom Panel          │  │
│  │  Tree View    │───▶│  Terminal / Webview     │  │
│  │  (navigation) │    │  (agent streams)        │  │
│  └──────┬───────┘    └────────────┬───────────┘  │
│         │                         │               │
│  ┌──────▼─────────────────────────▼───────────┐  │
│  │         Extension Controller                │  │
│  │  (commands, menus, launch flow, state)      │  │
│  └──────────────────┬─────────────────────────┘  │
│                     │                             │
│  ┌──────────────────▼─────────────────────────┐  │
│  │           ClaudeCodeBridge                  │  │
│  │                                             │  │
│  │  ┌─────────────┐  ┌──────────────────────┐ │  │
│  │  │ SessionStore │  │ ProcessManager       │ │  │
│  │  │ (file watch, │  │ (spawn, kill, signal │ │  │
│  │  │  parse JSONL)│  │  via CLI + process)  │ │  │
│  │  └─────────────┘  └──────────────────────┘ │  │
│  │  ┌─────────────┐  ┌──────────────────────┐ │  │
│  │  │WorktreeFinder│ │ StreamReader         │ │  │
│  │  │ (git worktree│ │ (stream-json output, │ │  │
│  │  │  + manual)   │ │  JSONL tailing)      │ │  │
│  │  └─────────────┘  └──────────────────────┘ │  │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
         │               │              │
         ▼               ▼              ▼
   ~/.claude/        claude CLI      git worktree
   sessions/         (spawn,          .git/worktrees/
   projects/          resume)
```

### Bridge Components

**SessionStore** — watches `~/.claude/sessions/*.json` and `~/.claude/projects/` for live session/subagent state. Emits events when agents appear, change, or disappear.

**ProcessManager** — spawns new `claude` processes (with `--output-format stream-json`), kills/stops existing ones by PID, handles process lifecycle.

**WorktreeFinder** — watches `.git/worktrees/` directories for instant worktree detection. Merges with manually-added directories from extension settings.

**StreamReader** — tails JSONL output from running agents and subagent log files. Provides an EventEmitter interface for real-time updates.

## UI Layout: Hybrid (Sidebar + Bottom Panel)

### Sidebar Tree View

Dedicated icon in the activity bar. Three-level tree hierarchy:

```
CLAUDE AGENTS
├── 📁 ~/claude-tooling (main)
│   ├── 🟢 Session #85cc — "brainstorming vscode plugin"
│   │   ├── 🔵 Explore #a2f3 — "Research Claude Code APIs"
│   │   ├── 🔵 Plan #b7c1 — "Design auth module"
│   │   └── 🔵 general-purpose #c4d2 — "Write unit tests"
│   └── 🟡 Session #7a1b — idle (resumed 2h ago)
├── 📁 ~/claude-tooling (feat/auth) [worktree]
│   └── 🟢 Session #f2e9 — "Implementing OAuth flow"
└── 📁 ~/other-project (main)
    └── (no active agents)
```

**Status indicators:**
- 🟢 Active — agent is running, producing output
- 🔵 Subagent — child of a session, shows type (Explore, Plan, etc.)
- 🟡 Idle — session exists but no recent activity
- 🔴 Errored — process exited with error
- ⚪ Completed — finished successfully

**Context menu actions:**

| Node Type | Actions |
|-----------|---------|
| Directory | New Agent, Open in Terminal, Remove from Watch |
| Session   | Open Stream, Stop, Resume (if idle), Kill |
| Subagent  | Open Stream |

**Toolbar buttons:** + (New Agent), ⟳ (Refresh), ⚙ (Settings)

### Bottom Panel: Stream Viewer

Clicking an agent in the sidebar opens its stream in the bottom panel.

**Terminal Mode (v1):**
- VSCode pseudo-terminal (`vscode.Pseudoterminal`) connected to the agent's output stream
- For new agents: pipes `claude --output-format stream-json` stdout, parsed and rendered as readable terminal output
- For already-running agents: tails the JSONL session file and renders updates as they arrive
- Multiple tabs supported — open several agent streams side by side
- Tab label: agent type + short ID (e.g., `Explore #a2f3`)

**Rich Webview Mode (v1.1 — deferred):**
- Activated via icon button in the terminal tab bar, or right-click → "Open Rich View"
- Renders: tool calls with syntax-highlighted arguments, file diffs inline, markdown-rendered reasoning, task progress bars, cost/token usage
- Both modes stay synced to the same underlying StreamReader instance
- Deferred because it's a substantial rendering engine; terminal mode covers the core need

## Agent Launch Flow

All entry points (command palette, context menu, sidebar "+") converge on one multi-step quick-pick flow.

### Step 1 — Where?

```
Select target directory
┌─────────────────────────────────────────┐
│ ● ~/claude-tooling (main)               │
│ ● ~/claude-tooling (feat/auth) worktree │
│ ● ~/other-project (main)                │
│ ─────────────────────────────────        │
│ ○ Browse for directory...                │
│ ○ Create new worktree...                 │
└─────────────────────────────────────────┘
```

Skipped when launched from context menu on a folder.

"Create new worktree" sub-flow: branch name → base branch → auto-suggested path → `git worktree add`.

### Step 2 — How?

```
How should this agent run?
┌─────────────────────────────────────────┐
│ ● New session — start fresh              │
│ ● Resume session — pick from recent      │
│ ─────────────────────────────────        │
│ ● Use agent: file-reader (haiku)         │
│ ● Use agent: maker-agent (sonnet)        │
│ ● Default (no agent override)            │
└─────────────────────────────────────────┘
```

Agent list populated from multiple sources (see Agent Discovery below).

### Step 3 — What?

```
┌─────────────────────────────────────────┐
│ Enter prompt (or leave blank for REPL)   │
│                                          │
│ > Implement the OAuth callback handler   │
│   using the design in docs/auth-spec.md  │
└─────────────────────────────────────────┘
```

Blank prompt → interactive terminal session. Non-blank → `--print` mode with `stream-json` output piped to stream viewer.

**Underlying CLI invocation:**
```bash
claude --agent maker-agent \
  --output-format stream-json \
  -p "Implement the OAuth callback handler..."
```

### Agent Discovery

The launch flow discovers agents from four sources:

1. **Project-local:** `<target-dir>/.claude/agents/*.md` — parse YAML frontmatter for name, model, description
2. **User-global:** `~/.claude/agents/*.md` — same parsing
3. **Plugin agents:** parsed from `claude agents` CLI output
4. **Built-in agents:** also from `claude agents` CLI output

Displayed grouped by source:
```
Select agent (optional)
┌──────────────────────────────────────────┐
│ ● Default (no agent override)            │
│ ─── Project agents ───                   │
│ ● file-reader (haiku)                    │
│ ● maker-agent (sonnet)                   │
│ ─── Plugin agents ───                    │
│ ● superpowers:code-reviewer (inherit)    │
│ ─── Built-in ───                         │
│ ● Explore (haiku)                        │
│ ● Plan (inherit)                         │
└──────────────────────────────────────────┘
```

## Data Flow and State Management

### Event Sources

| What | Mechanism | Latency |
|------|-----------|---------|
| Session add/remove | `fs.watch` on `~/.claude/sessions/` | Instant |
| Subagent spawning | `fs.watch` on `<session>/subagents/` | Instant |
| Worktree changes | `fs.watch` on `.git/worktrees/` | Instant |
| Live output tailing | Poll JSONL file tail | 500ms |
| PID liveness | `process.kill(pid, 0)` | 5s poll |

### State Model

```
SessionStore emits:
  'session-added'     → { pid, sessionId, cwd, startedAt }
  'session-removed'   → { sessionId }
  'subagent-spawned'  → { sessionId, agentId, agentType, description }
  'subagent-completed'→ { sessionId, agentId }
  'agent-output'      → { agentId, data }
```

### Process Liveness and Stop/Kill Semantics

Session files in `~/.claude/sessions/` contain a PID. Liveness is validated by `process.kill(pid, 0)` every 5 seconds. If a PID is dead but the session file remains, the agent is marked completed or errored based on the JSONL tail.

**PID staleness guard:** Before signaling a PID, verify the process is actually a `claude` process by checking `/proc/<pid>/cmdline` (Linux) or `ps -p <pid> -o comm=` (cross-platform). If the process name doesn't match, treat the session as stale and remove it from the tree.

**Signal semantics:**
- **Stop** → `SIGTERM` — allows Claude Code to clean up gracefully (save session state, flush JSONL)
- **Kill** → `SIGKILL` — immediate termination, used only if SIGTERM doesn't work within 5 seconds
- Both actions are available for any session, including ones the extension didn't spawn. The PID staleness guard prevents signaling wrong processes.

**For agents the extension spawned:** ProcessManager holds a direct `ChildProcess` reference, so it can use `child.kill()` without PID concerns.

**For pre-existing agents:** The extension reads the PID from the session JSON, validates it's a claude process, then signals. This is inherently best-effort — if the user lacks permission to signal the process, the UI shows an error.

### No Persisted State

Extension state is ephemeral — everything is derived from Claude Code's files on disk. Closing and reopening VSCode rebuilds the tree from current file state. The only persisted configuration is `claudeAgentManager.watchedDirectories` in VSCode settings.

## Worktree Management

### Auto-Discovery

Watch `.git/worktrees/` directory for each workspace folder's repo root. When a subdirectory is created or removed, re-read worktree metadata (gitdir file contains the worktree path). No polling required.

### Manual Directory Addition

"Add Directory to Watch" command available from command palette and sidebar toolbar. Stored in extension settings (`claudeAgentManager.watchedDirectories`). Persists across sessions.

### Tree Grouping

For each monitored directory:
1. Resolve to absolute path
2. Detect if it's a git worktree (`.git` file vs `.git` directory)
3. Find repo root and branch name
4. Label: `~/path (branch)` + `[worktree]` tag if not main working tree
5. Scan sessions where `cwd` matches this path
6. Nest subagents under their parent session

## Claude Code Integration Points

### Project Path Convention

Claude Code encodes project paths as hyphen-delimited absolute paths in `~/.claude/projects/`. For example, a project at `/home/user/my-project` is stored under `~/.claude/projects/-home-user-my-project/`. The bridge derives this by replacing `/` with `-` in the absolute path of the working directory.

### Stability Warning

Claude Code does not document a stable public API for its file-based state. The paths and schemas below were observed against Claude Code as of March 2026. They may change without notice in future versions.

**Validation strategy:** The bridge layer must validate file schemas on read rather than assuming structure. If a session JSON file lacks expected fields, skip it gracefully. The bridge should log warnings when encountering unexpected formats so we can detect breakage early. Consider a `CLAUDE_CODE_VERSION` check on activation to warn when running against an untested version.

### File-Based State (read-only)

| Path | Contents | Purpose | Verified |
|------|----------|---------|----------|
| `~/.claude/sessions/*.json` | `{ pid, sessionId, cwd, startedAt }` | Session discovery | Yes — observed directly |
| `~/.claude/projects/<project>/<sessionId>.jsonl` | Full message history | Output tailing | Yes — observed directly |
| `~/.claude/projects/<project>/<sessionId>/subagents/agent-<id>.meta.json` | `{ agentType, description }` | Subagent metadata | Yes — observed directly |
| `~/.claude/projects/<project>/<sessionId>/subagents/agent-<id>.jsonl` | Subagent message log | Subagent output | Yes — observed directly |
| `<target-dir>/.claude/agents/*.md` | Agent definitions (YAML frontmatter) | Agent discovery | Yes — documented pattern |

### Subagent-to-Session Linking

Subagent files live under `~/.claude/projects/<project>/<sessionId>/subagents/`. The parent session ID is encoded in the directory path — the `<sessionId>` path segment. The bridge resolves this by:

1. Watching `~/.claude/projects/<project>/` for new session directories
2. For each known session directory, watching the `subagents/` subdirectory for new `agent-*.meta.json` files
3. Extracting the session ID from the path: `.../<sessionId>/subagents/agent-<agentId>.meta.json` → parent is `<sessionId>`

This means the tree nesting (subagents under sessions) is derived directly from the file hierarchy. If Claude Code changes this structure, the bridge's path-parsing logic is the single point to update.

### CLI Commands (invoked by extension)

| Command | Purpose |
|---------|---------|
| `claude -p "<prompt>" --output-format stream-json` | Launch agent with streaming output |
| `claude --agent <name> ...` | Launch with specific agent |
| `claude resume <sessionId>` | Resume an idle session |
| `claude agents` | List plugin and built-in agents |
| `git worktree list --porcelain` | Initial worktree enumeration |
| `git worktree add <path> -b <branch>` | Create new worktree from launch flow |

## Package Structure

```
ide_plugins/agent-manager/
├── package.json              ← VSCode extension manifest
├── tsconfig.json
├── src/
│   ├── extension.ts          ← activation, command registration
│   ├── bridge/
│   │   ├── index.ts          ← ClaudeCodeBridge facade
│   │   ├── sessionStore.ts   ← file watchers, session/subagent state
│   │   ├── processManager.ts ← spawn/kill claude processes
│   │   ├── worktreeFinder.ts ← git worktree discovery + manual dirs
│   │   └── streamReader.ts   ← JSONL tailing, EventEmitter interface
│   ├── views/
│   │   ├── agentTreeProvider.ts  ← TreeDataProvider for sidebar
│   │   ├── agentTreeItems.ts     ← tree node types (dir, session, subagent)
│   │   └── streamPanel.ts        ← terminal + webview stream viewer
│   ├── commands/
│   │   ├── launchAgent.ts    ← multi-step quick-pick launch flow
│   │   ├── stopAgent.ts
│   │   └── openStream.ts
│   └── types.ts              ← shared interfaces
├── resources/
│   ├── icons/                ← status icons for tree view
│   └── webview/              ← rich view HTML/CSS/JS
└── test/
    ├── bridge/               ← unit tests against mock file state
    └── views/                ← UI tests with mock bridge
```

**Key boundary:** `bridge/` has zero `vscode` imports — pure Node.js, testable in isolation. `views/` depends on both `vscode` API and `bridge/`. `commands/` orchestrates between them.

## Testing Strategy

- **Bridge unit tests:** create mock file structures in `/tmp`, verify SessionStore emits correct events, ProcessManager spawns/kills correctly, WorktreeFinder discovers worktrees
- **View tests:** mock the bridge, verify tree items render correctly, stream panel connects to the right StreamReader
- **Integration tests:** launch a real `claude` process in `--print` mode, verify end-to-end flow from spawn to stream viewer

## Out of Scope (v1)

- Multi-window VSCode support (single window assumed)
- Remote development (SSH/containers) — agents must be local
- Agent-to-agent messaging from the UI
- Cost tracking dashboard (though cost data is available in JSONL for the rich view)
- Notifications/alerts when agents complete or error
- Rich webview mode — deferred to v1.1. Terminal-based stream viewing is the v1 deliverable. The webview toggle (syntax-highlighted tool calls, inline diffs, markdown rendering, progress bars, cost display) is a substantial rendering engine that should be designed and built separately.
