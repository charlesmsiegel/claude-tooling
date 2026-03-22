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
    this.iconPath = SubagentNode.statusIcon(subagent.status);
    this.description = subagent.description;
    this.tooltip = `Agent ID: ${subagent.agentId}\nType: ${subagent.agentType}\n${subagent.description}`;
  }

  private static statusIcon(status: AgentStatus): vscode.ThemeIcon {
    switch (status) {
      case 'active': return new vscode.ThemeIcon('circle-small-filled', new vscode.ThemeColor('textLink.foreground'));
      case 'completed': return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
      case 'errored': return new vscode.ThemeIcon('circle-small-filled', new vscode.ThemeColor('errorForeground'));
      case 'idle': return new vscode.ThemeIcon('circle-small-filled', new vscode.ThemeColor('editorWarning.foreground'));
    }
  }
}
