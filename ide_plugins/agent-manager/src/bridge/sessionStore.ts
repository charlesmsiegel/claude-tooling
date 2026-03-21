import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { SessionInfo, SubagentInfo, AgentStatus } from '../types';

export class SessionStore extends EventEmitter {
  private sessions = new Map<string, SessionInfo>();
  private subagents = new Map<string, SubagentInfo[]>();
  private watchers: fs.FSWatcher[] = [];
  private livenessTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sessionsDir: string,
    private readonly projectsDir: string,
    private readonly livenessIntervalMs: number = 5000
  ) {
    super();
  }

  async init(): Promise<void> {
    await this.scanExistingSessions();
    this.watchSessionsDir();
    this.startLivenessChecks();
  }

  getSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  getSubagents(sessionId: string): SubagentInfo[] {
    return this.subagents.get(sessionId) ?? [];
  }

  getSessionById(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  dispose(): void {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
    if (this.livenessTimer) {
      clearInterval(this.livenessTimer);
      this.livenessTimer = null;
    }
    this.removeAllListeners();
  }

  private async scanExistingSessions(): Promise<void> {
    let files: string[];
    try {
      files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
    } catch {
      return;
    }

    for (const file of files) {
      this.loadSessionFile(path.join(this.sessionsDir, file));
    }
  }

  private loadSessionFile(filePath: string): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.pid || !data.sessionId || !data.cwd || !data.startedAt) {
        return;
      }
      const session: SessionInfo = {
        pid: data.pid,
        sessionId: data.sessionId,
        cwd: data.cwd,
        startedAt: data.startedAt,
        status: this.checkPidAlive(data.pid) ? 'active' : 'completed',
      };
      const isNew = !this.sessions.has(session.sessionId);
      this.sessions.set(session.sessionId, session);

      if (isNew) {
        this.emit('session-added', session);
        this.watchSubagents(session.sessionId);
      }
    } catch {
      // skip malformed files
    }
  }

  private watchSessionsDir(): void {
    try {
      const watcher = fs.watch(this.sessionsDir, (eventType, filename) => {
        if (!filename?.endsWith('.json')) return;
        const filePath = path.join(this.sessionsDir, filename);

        if (eventType === 'rename') {
          if (fs.existsSync(filePath)) {
            this.loadSessionFile(filePath);
          } else {
            const pidStr = path.basename(filename, '.json');
            for (const [sid, s] of this.sessions) {
              if (s.pid.toString() === pidStr) {
                this.sessions.delete(sid);
                this.subagents.delete(sid);
                this.emit('session-removed', sid);
                break;
              }
            }
          }
        } else if (eventType === 'change') {
          this.loadSessionFile(filePath);
        }
      });
      this.watchers.push(watcher);
    } catch {
      // directory may not exist yet
    }
  }

  private watchSubagents(sessionId: string): void {
    const projectDir = this.findProjectDir(sessionId);
    if (!projectDir) return;

    const subagentsDir = path.join(projectDir, sessionId, 'subagents');
    if (!fs.existsSync(subagentsDir)) return;

    try {
      const watcher = fs.watch(subagentsDir, (eventType, filename) => {
        if (!filename?.endsWith('.meta.json')) return;
        this.loadSubagentMeta(sessionId, path.join(subagentsDir, filename));
      });
      this.watchers.push(watcher);

      const files = fs.readdirSync(subagentsDir).filter((f) => f.endsWith('.meta.json'));
      for (const file of files) {
        this.loadSubagentMeta(sessionId, path.join(subagentsDir, file));
      }
    } catch {
      // subagents dir may not exist
    }
  }

  private loadSubagentMeta(sessionId: string, filePath: string): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      const filename = path.basename(filePath);
      const match = filename.match(/^agent-(.+)\.meta\.json$/);
      if (!match) return;

      const agentId = match[1];
      const subagent: SubagentInfo = {
        agentId,
        agentType: data.agentType ?? 'unknown',
        description: data.description ?? '',
        sessionId,
        isSidechain: data.isSidechain,
      };

      const existing = this.subagents.get(sessionId) ?? [];
      if (!existing.find((s) => s.agentId === agentId)) {
        existing.push(subagent);
        this.subagents.set(sessionId, existing);
        this.emit('subagent-spawned', subagent);
      }
    } catch {
      // skip malformed
    }
  }

  private findProjectDir(sessionId: string): string | undefined {
    try {
      const projects = fs.readdirSync(this.projectsDir);
      for (const proj of projects) {
        const projPath = path.join(this.projectsDir, proj);
        if (!fs.statSync(projPath).isDirectory()) continue;
        if (fs.existsSync(path.join(projPath, `${sessionId}.jsonl`))) {
          return projPath;
        }
      }
    } catch {
      // projectsDir may not exist
    }
    return undefined;
  }

  private checkPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private startLivenessChecks(): void {
    this.livenessTimer = setInterval(() => {
      for (const [sid, session] of this.sessions) {
        if (session.status === 'active' && !this.checkPidAlive(session.pid)) {
          session.status = 'completed';
          this.emit('session-removed', sid);
        }
      }
    }, this.livenessIntervalMs);
  }
}
