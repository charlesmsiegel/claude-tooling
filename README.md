# claude-tooling

A collection of reusable Claude Code extensions: agents, commands, hooks, skills, and a VS Code plugin for managing multi-agent workflows. Install individual pieces into any project with the included installer.

## What's included

### Agents (`agents/`)

Drop-in agent definitions for `.claude/agents/`.

| Agent | Model | Purpose |
|-------|-------|---------|
| `file-reader` | haiku | Fast file analysis, structure extraction, and pattern recognition |
| `maker-agent` | sonnet | Feature creation from requirements using TDD workflow |

### Commands (`commands/`)

Slash commands for `.claude/commands/`.

| Command | Usage |
|---------|-------|
| `brutal-review` | Harsh code review of your current diff |
| `fix-issue` | `/fix-issue <number>` — branch, test, fix, PR |
| `fix-pr` | `/fix-pr <number>` — address all review feedback on a PR |
| `update-docs` | `/update-docs` — regenerate the project documentation skill |

### Hooks (`hooks/`)

Pre/post tool-use hooks with profile support.

| Hook | Type | Description |
|------|------|-------------|
| `branch_check` | PreToolUse | Prevents commits to main/master |
| `check_gitignore` | PreToolUse | Blocks writes to gitignored files |
| `black_format` | PostToolUse | Auto-format Python with Black |
| `ruff_lint` | PostToolUse | Lint and auto-fix Python with Ruff |
| `precommit_run` | PreToolUse | Run pre-commit hooks before git commit |

**Profiles** bundle hooks for common setups:
- `general` — branch protection + gitignore check
- `python` — all of the above plus Black, Ruff, and pre-commit

### Skills (`skills/`)

Full skill directories (with analysis scripts and references) for `.claude/skills/`.

| Skill | Description |
|-------|-------------|
| `django-simplifier` | Simplify Django code, detect anti-patterns, optimize QuerySets |
| `langfuse-strands` | Integrate Langfuse observability with Strands Agents |
| `python-simplifier` | Reduce complexity and improve readability of Python code |
| `strands-agents` | Build AI agents with the AWS Strands Agents SDK |
| `technical-debt-detector` | Find and prioritize tech debt in Python codebases |

### VS Code Extensions (`ide_plugins/`)

#### Agent Manager (`ide_plugins/agent-manager/`)

A VS Code sidebar for orchestrating Claude Code agents across directories and git worktrees. See [its README](ide_plugins/agent-manager/README.md) for full details.

- Tree view of agents organized by directory → session → subagent
- Launch, stop, kill, and resume agent sessions
- Stream viewer with pseudo-terminal output
- Auto-discovers git worktrees
- Toggle to hide finished agents

#### Claude Control (`ide_plugins/claude-control/`)

Graphical management for Claude Code configuration. See [its README](ide_plugins/claude-control/README.md) for full details.

- Tree view of all Claude Code config: settings, hooks, agents, commands, skills, MCP servers, memory
- Scope-aware editing (user, project, workspace)
- Connection graph showing relationships between config items
- Drag-and-drop reordering for hooks

### Templates

| File | Purpose |
|------|---------|
| [`EXAMPLE_CLAUDE.md`](EXAMPLE_CLAUDE.md) | Template for adding a self-updating documentation skill to any project |

## Installation

Use `install.py` to copy items into any project's `.claude/` directory and update `settings.local.json` automatically.

```bash
# List everything available
python install.py --list

# Install specific items
python install.py agents file-reader maker-agent
python install.py commands brutal-review fix-issue
python install.py hooks --profile python
python install.py skills django-simplifier

# Install everything to a target project
python install.py all --target ~/my-project
```

The installer handles file copying, permission bits, hook wiring, and settings merging — you don't need to manually edit `settings.local.json`.

## License

MIT
