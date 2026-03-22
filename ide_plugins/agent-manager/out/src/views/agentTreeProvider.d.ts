import * as vscode from 'vscode';
import { ClaudeCodeBridge } from '../bridge';
import { DirectoryNode, SessionNode, SubagentNode } from './agentTreeItems';
type AgentTreeNode = DirectoryNode | SessionNode | SubagentNode;
export declare class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeNode> {
    private readonly bridge;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<AgentTreeNode | undefined>;
    constructor(bridge: ClaudeCodeBridge);
    refresh(): void;
    getTreeItem(element: AgentTreeNode): vscode.TreeItem;
    getChildren(element?: AgentTreeNode): AgentTreeNode[];
    private getSessionsForDirectory;
    dispose(): void;
}
export {};
