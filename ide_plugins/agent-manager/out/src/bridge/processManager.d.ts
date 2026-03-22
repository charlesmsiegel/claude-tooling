import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
export interface ProcessSpawnOptions {
    cwd: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}
export declare class ProcessManager extends EventEmitter {
    private spawned;
    spawn(options: ProcessSpawnOptions): ChildProcess;
    spawnClaude(options: {
        cwd: string;
        agent?: string;
        prompt?: string;
        sessionId?: string;
    }): ChildProcess;
    getSpawnedPids(): number[];
    getSpawnedProcess(pid: number): ChildProcess | undefined;
    validatePid(pid: number): boolean;
    stop(pid: number): Promise<boolean>;
    kill(pid: number): Promise<boolean>;
    dispose(): void;
}
