import * as vscode from 'vscode';
import { ClaudeCodeBridge } from '../bridge';
import { DirectoryNode, SessionNode, SubagentNode } from './agentTreeItems';
import { WatchedDirectory } from '../types';

type AgentTreeNode = DirectoryNode | SessionNode | SubagentNode;

export class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AgentTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private _hideFinished = true;

  get hideFinished(): boolean {
    return this._hideFinished;
  }

  set hideFinished(value: boolean) {
    this._hideFinished = value;
    this.refresh();
  }

  constructor(private readonly bridge: ClaudeCodeBridge) {
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
      return this.bridge.worktreeFinder.getDirectories().map((dir) => new DirectoryNode(dir));
    }

    if (element instanceof DirectoryNode) {
      return this.getSessionsForDirectory(element.dir);
    }

    if (element instanceof SessionNode) {
      return this.bridge.sessionStore
        .getSubagents(element.session.sessionId)
        .filter((sub) => !this._hideFinished || sub.status !== 'completed')
        .map((sub) => new SubagentNode(sub));
    }

    return [];
  }

  private getSessionsForDirectory(dir: WatchedDirectory): SessionNode[] {
    return this.bridge.sessionStore
      .getSessions()
      .filter((s) => s.cwd === dir.path)
      .filter((s) => !this._hideFinished || (s.status !== 'completed' && s.status !== 'errored'))
      .map((s) => {
        const subagentCount = this.bridge.sessionStore.getSubagents(s.sessionId).length;
        return new SessionNode(s, subagentCount);
      });
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
