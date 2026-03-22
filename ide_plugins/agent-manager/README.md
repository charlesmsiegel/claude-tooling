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
