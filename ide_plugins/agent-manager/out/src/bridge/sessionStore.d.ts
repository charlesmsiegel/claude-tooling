import { EventEmitter } from 'events';
import { SessionInfo, SubagentInfo } from '../types';
export declare class SessionStore extends EventEmitter {
    private readonly sessionsDir;
    private readonly projectsDir;
    private readonly livenessIntervalMs;
    private sessions;
    private subagents;
    private watchers;
    private livenessTimer;
    constructor(sessionsDir: string, projectsDir: string, livenessIntervalMs?: number);
    init(): Promise<void>;
    getSessions(): SessionInfo[];
    getSubagents(sessionId: string): SubagentInfo[];
    getSessionById(sessionId: string): SessionInfo | undefined;
    dispose(): void;
    private scanExistingSessions;
    private loadSessionFile;
    private watchSessionsDir;
    private watchSubagents;
    private loadSubagentMeta;
    private findProjectDir;
    private checkPidAlive;
    private startLivenessChecks;
}
