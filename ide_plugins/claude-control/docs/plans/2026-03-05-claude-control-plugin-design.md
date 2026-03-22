# Claude Control Plugin — Design Document

A VS Code extension providing a graphical tree view and form-based UI for managing Claude Code's `.claude/` configuration ecosystem.

## Object Types

Eight object types, each with a dedicated form-based editor panel:

| Object | Storage | Key Editor Fields |
|---|---|---|
| Agents | `.claude/agents/*.yml` | Model, instructions, permissions, tool access |
| Skills | `.claude/skills/*.md` | Name, triggers, type, structured content body |
| Hooks | `settings.json` hooks section | Event type, matcher, shell command, timeout, enabled toggle |
| Commands | `.claude/commands/*.md` | Slash-command name, template, arguments |
| MCP Servers | `.claude/mcp.json` | Transport type, command/URL, args, env vars, enabled toggle |
| Settings | `.claude/settings.json` | Permissions, model preference, custom instructions |
| CLAUDE.md | `CLAUDE.md` / `.claude/CLAUDE.md` | Structured section editor (project description, style rules, build commands) |
| Memory | `~/.claude/projects/<path>/memory/` | Topic, content, links to other memory files |

## Three-Scope Model

| Scope | Path | Notes |
|---|---|---|
| Global | `~/.claude/` | Shared across all projects |
| Project | `<workspace-folder>/.claude/` | One per workspace folder in multi-root workspaces |
| Memory | `~/.claude/projects/<project-path>/memory/` | Per-project memory under global directory |

All scopes discovered on extension activation and watched for external changes via `FileSystemWatcher`.

## Architecture: Hybrid (Approach C)

### Three UI Layers

1. **Tree View (VS Code sidebar)** — Grouped by object type. Items tagged by scope (Global, Project A, etc.). Right-click context menus for create, delete, duplicate, move-to-scope. Clicking an item opens its editor panel.

2. **Editor Panels (webview, one per object type)** — Form-based editing at top. Linkable items list at bottom with drag-and-drop to create/remove connections. Each panel is a small React app.

3. **Connections View (webview)** — Interactive graph (React Flow) showing all objects as nodes and connections as edges. Full drag-and-drop to create connections. Click edges to remove. Filter by scope and object type.

### Connections = File Writes

Every visual connection in the UI corresponds to a real change in the underlying files. Creating or removing a link writes to disk immediately.

| Connection | File Change |
|---|---|
| Skill → Agent | Agent YAML gets `skills: [...]` entry |
| Hook → Agent | Agent YAML gets `hooks: [...]` entry |
| Hook → Settings | Hook definition added to `settings.json` hooks section |
| MCP Server → Agent | Agent YAML gets `mcpServers: [...]` reference |
| Skill → Command | Command file updated to reference the skill |
| CLAUDE.md → Agent | Agent YAML gets `instructions: [...]` path |

Both editor panels and the connections view use the same extension host serialization logic.

## Data Flow

```
Webview (React) <--postMessage--> Extension Host (TS) <--fs--> Files (.claude/)
                                        |
                                        v
                                  In-Memory Model
                                  (single source of truth)
                                        |
                                        v
                                  Tree View (refresh)
```

- Extension host owns the in-memory model containing all parsed objects and connections.
- Webviews never read files directly — they receive state via `postMessage`.
- File watchers keep the model in sync with disk.
- On external edit conflict with unsaved webview changes: notification prompts user to reload or keep their changes.

## Tech Stack

| Layer | Technology |
|---|---|
| Extension host | TypeScript, VS Code Extension API, esbuild |
| Webview UI | React 18, Vite, `@vscode/webview-ui-toolkit/react` |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Graph view | `@xyflow/react` (React Flow) |
| Testing | Vitest (unit + component), React Testing Library, `@vscode/test-electron` (integration) |
| Build/publish | npm scripts, `vsce` |

## Project Structure

```
claude-control-plugin/
├── src/                          # Extension host (Node.js)
│   ├── extension.ts              # activate/deactivate
│   ├── model/
│   │   ├── types.ts              # Shared types for all object types
│   │   ├── store.ts              # In-memory model
│   │   └── serializers/          # One per object type
│   │       ├── agents.ts
│   │       ├── skills.ts
│   │       ├── hooks.ts
│   │       ├── commands.ts
│   │       ├── mcp-servers.ts
│   │       ├── settings.ts
│   │       ├── claude-md.ts
│   │       └── memory.ts
│   ├── tree/
│   │   ├── provider.ts           # TreeDataProvider
│   │   └── items.ts              # TreeItem definitions per type
│   ├── watchers/
│   │   └── file-watcher.ts       # FileSystemWatcher setup
│   ├── webview/
│   │   └── panel-manager.ts      # Create/manage webview panels
│   └── commands/
│       └── index.ts              # VS Code command registrations
├── webview-ui/                   # Separate Vite + React app
│   ├── src/
│   │   ├── App.tsx
│   │   ├── editors/              # One editor component per object type
│   │   │   ├── AgentEditor.tsx
│   │   │   ├── SkillEditor.tsx
│   │   │   ├── HookEditor.tsx
│   │   │   ├── CommandEditor.tsx
│   │   │   ├── McpServerEditor.tsx
│   │   │   ├── SettingsEditor.tsx
│   │   │   ├── ClaudeMdEditor.tsx
│   │   │   └── MemoryEditor.tsx
│   │   ├── connections/
│   │   │   └── ConnectionsView.tsx
│   │   ├── components/
│   │   │   ├── LinkableItems.tsx  # Drag-and-drop linkable items panel
│   │   │   ├── ScopeBadge.tsx
│   │   │   └── FormField.tsx
│   │   └── hooks/
│   │       └── useExtensionState.ts
│   └── vite.config.ts
├── package.json                  # Extension manifest + npm scripts
├── tsconfig.json
├── .vscodeignore
└── README.md
```

### Pattern for Adding New Object Types

Each object type follows the same pattern:
1. Add types to `src/model/types.ts`
2. Create a serializer in `src/model/serializers/`
3. Add a tree item definition in `src/tree/items.ts`
4. Create an editor component in `webview-ui/src/editors/`
5. Register in the store, tree provider, and panel manager

## Testing Strategy

| Level | Tool | Coverage |
|---|---|---|
| Unit | Vitest | Serializers (parse/write each file format), store logic, connection validation |
| Component | Vitest + React Testing Library | Editor forms render, drag-and-drop interactions |
| Integration | `@vscode/test-electron` | Extension activation, tree view population, webview lifecycle, file write round-trips |

Serializer tests are highest priority — incorrect serialization corrupts user configs.

## Future Work

### v2: External Sources

Pull skills, commands, agent configs, and other objects from external GitHub repositories. Would involve:

- Git clone/fetch logic for remote repos
- Version pinning and update notifications
- Conflict resolution between external and local objects
- UI for browsing and importing from external sources
- Registry/marketplace concept for discovering shared configurations

This is explicitly out of scope for v1. Local management must be solid first.
