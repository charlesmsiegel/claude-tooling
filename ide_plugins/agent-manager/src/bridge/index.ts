import * as os from 'os';
import * as path from 'path';
import { SessionStore } from './sessionStore';
import { ProcessManager } from './processManager';
import { WorktreeFinder } from './worktreeFinder';
import { StreamReader } from './streamReader';
import { AgentDiscovery } from './agentDiscovery';
import { AgentDefinition } from '../types';

export class ClaudeCodeBridge {
  public readonly sessionStore: SessionStore;
  public readonly processManager: ProcessManager;
  public readonly worktreeFinder: WorktreeFinder;
  private streamReaders = new Map<string, StreamReader>();

  constructor(workspaceFolders: string[]) {
    const homeDir = os.homedir();
    const sessionsDir = path.join(homeDir, '.claude', 'sessions');
    const projectsDir = path.join(homeDir, '.claude', 'projects');

    this.sessionStore = new SessionStore(sessionsDir, projectsDir);
    this.processManager = new ProcessManager();
    this.worktreeFinder = new WorktreeFinder(workspaceFolders);
  }

  async init(manualDirs: string[] = []): Promise<void> {
    await this.sessionStore.init();
    await this.worktreeFinder.init(manualDirs);
  }

  discoverAgents(projectDir: string): AgentDefinition[] {
    return AgentDiscovery.discoverAll(projectDir, os.homedir());
  }

  getStreamReader(filePath: string, options?: { startFromEnd?: boolean }): StreamReader {
    const existing = this.streamReaders.get(filePath);
    if (existing) return existing;

    const reader = new StreamReader(filePath, {
      startFromEnd: options?.startFromEnd,
    });
    this.streamReaders.set(filePath, reader);
    return reader;
  }

  removeStreamReader(filePath: string): void {
    const reader = this.streamReaders.get(filePath);
    if (reader) {
      reader.stop();
      this.streamReaders.delete(filePath);
    }
  }

  dispose(): void {
    this.sessionStore.dispose();
    this.processManager.dispose();
    this.worktreeFinder.dispose();
    for (const [, reader] of this.streamReaders) {
      reader.stop();
    }
    this.streamReaders.clear();
  }
}

export { SessionStore } from './sessionStore';
export { ProcessManager } from './processManager';
export { WorktreeFinder } from './worktreeFinder';
export { StreamReader } from './streamReader';
export { AgentDiscovery } from './agentDiscovery';
