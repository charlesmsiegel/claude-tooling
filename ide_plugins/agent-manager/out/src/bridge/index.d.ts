import { SessionStore } from './sessionStore';
import { ProcessManager } from './processManager';
import { WorktreeFinder } from './worktreeFinder';
import { StreamReader } from './streamReader';
import { AgentDefinition } from '../types';
export declare class ClaudeCodeBridge {
    readonly sessionStore: SessionStore;
    readonly processManager: ProcessManager;
    readonly worktreeFinder: WorktreeFinder;
    private streamReaders;
    constructor(workspaceFolders: string[]);
    init(manualDirs?: string[]): Promise<void>;
    discoverAgents(projectDir: string): AgentDefinition[];
    getStreamReader(filePath: string, options?: {
        startFromEnd?: boolean;
    }): StreamReader;
    removeStreamReader(filePath: string): void;
    dispose(): void;
}
export { SessionStore } from './sessionStore';
export { ProcessManager } from './processManager';
export { WorktreeFinder } from './worktreeFinder';
export { StreamReader } from './streamReader';
export { AgentDiscovery } from './agentDiscovery';
