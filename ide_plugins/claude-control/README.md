# Claude Control

A VS Code extension for graphical management of Claude Code configuration files.

Instead of hand-editing JSON, YAML, and Markdown scattered across your project, Claude Control gives you a tree view, form editors, and a drag-and-drop connections diagram -- all inside VS Code.

## Features

- **Tree view** in the Activity Bar showing every configuration object grouped by type
- **Form editors** for creating and editing objects without touching raw files
- **Connections view** with drag-and-drop linking between agents, skills, MCP servers, and commands
- **Multi-scope support** -- manages global (`~/.claude/`), project (`.claude/`), and workspace (`.vscode/`) scopes
- **File watching** -- automatically reloads when config files change on disk

## Object Types

| Type | File(s) |
|------|---------|
| Agents | `.claude/agents/*.yml` |
| Skills | `.claude/skills/*.md` |
| Hooks | `.claude/settings.json` `hooks` key |
| Commands | `.claude/commands/*.md` |
| MCP Servers | `.claude/settings.json` `mcpServers` key |
| Settings | `.claude/settings.json` top-level keys |
| CLAUDE.md | `CLAUDE.md` at each scope |
| Memory | `.claude/memory.md` |

## Build and Install

```bash
npm install
npm run build
npm run package      # produces a .vsix file
```

Then install the `.vsix` in VS Code: **Extensions > ... > Install from VSIX**.

## Development

```bash
npm run watch        # rebuild extension + webview on save
npm test             # run tests once
npm run test:watch   # run tests in watch mode
```

## Project Structure

```
src/              Extension host (TypeScript)
  model/          Data types, in-memory store, serializers
  tree/           Tree view provider
  webview/        Webview panel manager
  watchers/       File system watchers
  commands/       Command registrations
webview-ui/       React + Vite frontend
  src/
    editors/      Form editor components
    connections/  React Flow connections diagram
    components/   Shared UI components
```

## License

MIT
