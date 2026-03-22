import * as path from 'path';
import * as vscode from 'vscode';
import { ClaudeCodeBridge } from './bridge';
import { AgentTreeProvider } from './views/agentTreeProvider';
import { StreamPanel } from './views/streamPanel';
import { DirectoryNode, SessionNode, SubagentNode } from './views/agentTreeItems';
import { launchAgent } from './commands/launchAgent';
import { stopAgent, killAgent } from './commands/stopAgent';
import { openStream } from './commands/openStream';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Claude Agent Manager');
  outputChannel.appendLine('Claude Agent Manager activating...');
  context.subscriptions.push(outputChannel);

  // ── 1. Bridge ───────────────────────────────────────────────────────────────
  const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map(
    (f) => f.uri.fsPath
  );

  const bridge = new ClaudeCodeBridge(workspaceFolders);

  const manualDirs: string[] = vscode.workspace
    .getConfiguration('claudeAgentManager')
    .get<string[]>('watchedDirectories', []);

  bridge.init(manualDirs).catch((err: unknown) => {
    outputChannel.appendLine(`Bridge init error: ${String(err)}`);
  });

  context.subscriptions.push({ dispose: () => bridge.dispose() });

  // ── 2. Views ────────────────────────────────────────────────────────────────
  const treeProvider = new AgentTreeProvider(bridge);
  const streamPanel = new StreamPanel();

  const treeView = vscode.window.registerTreeDataProvider('claudeAgents', treeProvider);

  context.subscriptions.push(treeView);
  context.subscriptions.push({ dispose: () => treeProvider.dispose() });
  context.subscriptions.push({ dispose: () => streamPanel.dispose() });

  // ── 3. Commands ─────────────────────────────────────────────────────────────

  // launchAgent — palette, sidebar button, directory context menu
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeAgentManager.launchAgent',
      (node?: DirectoryNode) => launchAgent(bridge, streamPanel, node)
    )
  );

  // refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeAgentManager.refresh', () => {
      treeProvider.refresh();
    })
  );

  // openStream — session or subagent context menu
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeAgentManager.openStream',
      (node?: SessionNode | SubagentNode) => openStream(bridge, streamPanel, node)
    )
  );

  // stopAgent
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeAgentManager.stopAgent',
      (node?: SessionNode) => stopAgent(bridge, node)
    )
  );

  // killAgent
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeAgentManager.killAgent',
      (node?: SessionNode) => killAgent(bridge, node)
    )
  );

  // resumeAgent — terminal only (no spawnClaude)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeAgentManager.resumeAgent',
      (node?: SessionNode) => {
        if (!node) {
          vscode.window.showErrorMessage('Select a session node to resume.');
          return;
        }
        const { session } = node;
        const terminalName = `Claude — resume #${session.sessionId.substring(0, 8)}`;
        const terminal = vscode.window.createTerminal({
          name: terminalName,
          cwd: session.cwd,
          iconPath: new vscode.ThemeIcon('hubot'),
        });
        terminal.sendText(`claude resume ${session.sessionId}`);
        terminal.show();
      }
    )
  );

  // addWatchDir
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeAgentManager.addWatchDir', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Add Directory',
      });
      if (!uris || uris.length === 0) return;
      const dirPath = uris[0].fsPath;
      bridge.worktreeFinder.addManualDirectory(dirPath);

      // Persist to settings
      const config = vscode.workspace.getConfiguration('claudeAgentManager');
      const existing = config.get<string[]>('watchedDirectories', []);
      if (!existing.includes(dirPath)) {
        await config.update(
          'watchedDirectories',
          [...existing, dirPath],
          vscode.ConfigurationTarget.Global
        );
      }
    })
  );

  // removeWatchDir — from directory context menu
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeAgentManager.removeWatchDir',
      async (node?: DirectoryNode) => {
        let dirPath: string | undefined;

        if (node instanceof DirectoryNode) {
          dirPath = node.dir.path;
        } else {
          const dirs = bridge.worktreeFinder.getDirectories();
          const items = dirs.map((d) => ({
            label: d.path.replace(process.env.HOME ?? '', '~'),
            description: d.branch,
            dir: d,
          }));
          const picked = await vscode.window.showQuickPick(items, {
            title: 'Remove Watch Directory',
            placeHolder: 'Select a directory to remove',
          });
          if (!picked) return;
          dirPath = picked.dir.path;
        }

        if (!dirPath) return;
        bridge.worktreeFinder.removeManualDirectory(dirPath);

        // Persist to settings
        const config = vscode.workspace.getConfiguration('claudeAgentManager');
        const existing = config.get<string[]>('watchedDirectories', []);
        await config.update(
          'watchedDirectories',
          existing.filter((d) => d !== dirPath),
          vscode.ConfigurationTarget.Global
        );
      }
    )
  );

  // openInTerminal — directory context menu
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeAgentManager.openInTerminal',
      (node?: DirectoryNode) => {
        const dirPath = node instanceof DirectoryNode
          ? node.dir.path
          : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (!dirPath) return;

        const terminal = vscode.window.createTerminal({
          name: path.basename(dirPath),
          cwd: dirPath,
        });
        terminal.show();
      }
    )
  );

  outputChannel.appendLine('Claude Agent Manager activated.');
}

export function deactivate(): void {
  // All disposables pushed to context.subscriptions are cleaned up automatically.
}
