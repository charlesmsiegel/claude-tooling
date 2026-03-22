export interface SessionInfo {
    pid: number;
    sessionId: string;
    cwd: string;
    startedAt: number;
    status: AgentStatus;
}
export interface SubagentInfo {
    agentId: string;
    agentType: string;
    description: string;
    sessionId: string;
    isSidechain?: boolean;
}
export interface AgentDefinition {
    name: string;
    model: string;
    description: string;
    source: 'project' | 'global' | 'plugin' | 'builtin';
    filePath?: string;
}
export type AgentStatus = 'active' | 'idle' | 'errored' | 'completed';
export interface SessionStoreEvents {
    'session-added': (session: SessionInfo) => void;
    'session-removed': (sessionId: string) => void;
    'subagent-spawned': (subagent: SubagentInfo) => void;
    'subagent-completed': (sessionId: string, agentId: string) => void;
    'agent-output': (agentId: string, data: string) => void;
}
export interface SpawnOptions {
    cwd: string;
    agent?: string;
    prompt?: string;
    sessionId?: string;
}
export interface WatchedDirectory {
    path: string;
    branch: string;
    isWorktree: boolean;
    repoRoot: string;
}
