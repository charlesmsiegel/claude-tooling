import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ClaudeCodeBridge } from '../bridge';
import { AgentDiscovery } from '../bridge/agentDiscovery';
import { StreamPanel } from '../views/streamPanel';
import { DirectoryNode } from '../views/agentTreeItems';

type LaunchMode = 'non-interactive' | 'interactive';

/**
 * Multi-step QuickPick flow: where → how → what.
 * Entry points: command palette, context menu (DirectoryNode), sidebar button.
 */
export async function launchAgent(
  bridge: ClaudeCodeBridge,
  streamPanel: StreamPanel,
  node?: DirectoryNode
): Promise<void> {
  // ── Step 1: Where ──────────────────────────────────────────────────────────
  let selectedDir: string | undefined;

  if (node instanceof DirectoryNode) {
    selectedDir = node.dir.path;
  } else {
    const dirs = bridge.worktreeFinder.getDirectories();

    const items: vscode.QuickPickItem[] = [
      ...dirs.map((d) => ({
        label: d.path.replace(os.homedir(), '~'),
        description: d.branch,
        detail: d.isWorktree ? 'worktree' : undefined,
      })),
      { label: '$(folder-opened) Browse for directory...', description: '' },
      { label: '$(git-branch) Create new worktree...', description: '' },
    ];

    const picked = await vscode.window.showQuickPick(items, {
      title: 'Launch Claude Agent — Step 1 of 3: Where?',
      placeHolder: 'Select a directory',
    });

    if (!picked) return;

    if (picked.label.startsWith('$(folder-opened)')) {
      const uris = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Directory',
      });
      if (!uris || uris.length === 0) return;
      selectedDir = uris[0].fsPath;
      bridge.worktreeFinder.addManualDirectory(selectedDir);
    } else if (picked.label.startsWith('$(git-branch)')) {
      const branchName = await vscode.window.showInputBox({
        prompt: 'New worktree branch name',
        placeHolder: 'feature/my-branch',
      });
      if (!branchName) return;

      const baseDir = dirs[0]?.repoRoot ?? (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '');
      const worktreePath = path.join(path.dirname(baseDir), branchName.replace(/\//g, '-'));

      const terminal = vscode.window.createTerminal({
        name: 'Create Worktree',
        cwd: baseDir,
      });
      terminal.sendText(`git worktree add "${worktreePath}" -b "${branchName}" && exit`);
      terminal.show();
      vscode.window.showInformationMessage(
        `Creating worktree at ${worktreePath}. Re-run launch after creation.`
      );
      return;
    } else {
      const match = dirs.find((d) => d.path.replace(os.homedir(), '~') === picked.label);
      selectedDir = match?.path;
    }
  }

  if (!selectedDir) return;

  // ── Step 2: How ────────────────────────────────────────────────────────────
  const howItems: vscode.QuickPickItem[] = [
    {
      label: '$(terminal) Interactive',
      description: 'Open in a terminal (full chat mode)',
    },
    {
      label: '$(run-all) Non-interactive',
      description: 'Run with a prompt, stream output to panel',
    },
  ];

  const howPicked = await vscode.window.showQuickPick(howItems, {
    title: 'Launch Claude Agent — Step 2 of 3: How?',
    placeHolder: 'Select launch mode',
  });

  if (!howPicked) return;

  const mode: LaunchMode = howPicked.label.startsWith('$(terminal)')
    ? 'interactive'
    : 'non-interactive';

  // ── Step 3: What ───────────────────────────────────────────────────────────
  const agents = AgentDiscovery.discoverAll(selectedDir, os.homedir());

  const agentItems: vscode.QuickPickItem[] = [
    { label: '$(comment) No specific agent', description: 'Default Claude behaviour' },
    ...agents.map((a) => ({
      label: a.name,
      description: `[${a.source}]`,
      detail: a.description || undefined,
    })),
  ];

  const agentPicked = await vscode.window.showQuickPick(agentItems, {
    title: 'Launch Claude Agent — Step 3 of 3: Which agent?',
    placeHolder: 'Select an agent definition (optional)',
  });

  if (!agentPicked) return;

  const agentName = agentPicked.label.startsWith('$(comment)')
    ? undefined
    : agentPicked.label;

  // ── Launch ─────────────────────────────────────────────────────────────────
  if (mode === 'interactive') {
    const terminalName = `Claude — ${path.basename(selectedDir)}${agentName ? ` [${agentName}]` : ''}`;
    const terminal = vscode.window.createTerminal({
      name: terminalName,
      cwd: selectedDir,
      iconPath: new vscode.ThemeIcon('hubot'),
    });

    const cmd = agentName ? `claude --agent ${agentName}` : 'claude';
    terminal.sendText(cmd);
    terminal.show();
  } else {
    // Non-interactive: ask for a prompt then stream
    const prompt = await vscode.window.showInputBox({
      prompt: 'Enter your prompt for Claude',
      placeHolder: 'Describe the task...',
      ignoreFocusOut: true,
    });

    if (!prompt) return;

    const child = bridge.processManager.spawnClaude({
      cwd: selectedDir,
      agent: agentName,
      prompt,
    });

    if (!child.pid) {
      vscode.window.showErrorMessage('Failed to spawn Claude process.');
      return;
    }

    // Build a synthetic session ID for the stream panel (pid-based until a real session appears)
    const syntheticId = `launch-${child.pid}`;
    const label = `Claude — ${path.basename(selectedDir)}`;

    // Pipe stdout / stderr to a stream reader backed by an in-memory transform
    // We reuse StreamPanel by writing to a tmp JSONL file approach is too heavy;
    // instead we hook the ChildProcess streams directly via EventEmitter conventions
    // by wrapping child output into a StreamReader-compatible object.
    const { EventEmitter } = await import('events');
    const fakeReader = Object.assign(new EventEmitter(), {
      start() {
        /* output was already being piped before start() */
      },
      stop() {
        child.kill('SIGTERM');
      },
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          fakeReader.emit('data', JSON.parse(trimmed));
        } catch {
          fakeReader.emit('raw', trimmed);
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      fakeReader.emit('raw', `\x1b[31m${chunk.toString('utf-8').trimEnd()}\x1b[0m`);
    });

    streamPanel.createTerminal(syntheticId, label, fakeReader as any);
  }
}
