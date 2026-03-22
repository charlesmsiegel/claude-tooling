import { EventEmitter } from 'events';
import { WatchedDirectory } from '../types';
export declare class WorktreeFinder extends EventEmitter {
    private readonly workspaceFolders;
    private directories;
    private watchers;
    private manualDirs;
    constructor(workspaceFolders: string[]);
    init(manualDirs?: string[]): Promise<void>;
    getDirectories(): WatchedDirectory[];
    addManualDirectory(dirPath: string): void;
    removeManualDirectory(dirPath: string): void;
    dispose(): void;
    static parseWorktreeOutput(output: string, repoRoot: string): WatchedDirectory[];
    static mergeDirectories(discovered: WatchedDirectory[], manualPaths: string[]): WatchedDirectory[];
    private discoverAll;
    private watchWorktreeDirs;
    private findRepoRoot;
    private detectBranch;
    private isWorktree;
}
