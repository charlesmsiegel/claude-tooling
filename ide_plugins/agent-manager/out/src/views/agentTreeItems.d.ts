import * as vscode from 'vscode';
import { SessionInfo, SubagentInfo, WatchedDirectory } from '../types';
export declare class DirectoryNode extends vscode.TreeItem {
    readonly dir: WatchedDirectory;
    constructor(dir: WatchedDirectory);
}
export declare class SessionNode extends vscode.TreeItem {
    readonly session: SessionInfo;
    constructor(session: SessionInfo, subagentCount: number);
    private static statusIcon;
}
export declare class SubagentNode extends vscode.TreeItem {
    readonly subagent: SubagentInfo;
    constructor(subagent: SubagentInfo);
}
