"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStore = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SessionStore extends events_1.EventEmitter {
    sessionsDir;
    projectsDir;
    livenessIntervalMs;
    sessions = new Map();
    subagents = new Map();
    watchers = [];
    livenessTimer = null;
    constructor(sessionsDir, projectsDir, livenessIntervalMs = 5000) {
        super();
        this.sessionsDir = sessionsDir;
        this.projectsDir = projectsDir;
        this.livenessIntervalMs = livenessIntervalMs;
    }
    async init() {
        await this.scanExistingSessions();
        this.watchSessionsDir();
        this.startLivenessChecks();
    }
    getSessions() {
        return Array.from(this.sessions.values());
    }
    getSubagents(sessionId) {
        return this.subagents.get(sessionId) ?? [];
    }
    getSessionById(sessionId) {
        return this.sessions.get(sessionId);
    }
    dispose() {
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
    async scanExistingSessions() {
        let files;
        try {
            files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
        }
        catch {
            return;
        }
        for (const file of files) {
            this.loadSessionFile(path.join(this.sessionsDir, file));
        }
    }
    loadSessionFile(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            if (!data.pid || !data.sessionId || !data.cwd || !data.startedAt) {
                return;
            }
            const session = {
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
        }
        catch {
            // skip malformed files
        }
    }
    watchSessionsDir() {
        try {
            const watcher = fs.watch(this.sessionsDir, (eventType, filename) => {
                if (!filename?.endsWith('.json'))
                    return;
                const filePath = path.join(this.sessionsDir, filename);
                if (eventType === 'rename') {
                    if (fs.existsSync(filePath)) {
                        this.loadSessionFile(filePath);
                    }
                    else {
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
                }
                else if (eventType === 'change') {
                    this.loadSessionFile(filePath);
                }
            });
            this.watchers.push(watcher);
        }
        catch {
            // directory may not exist yet
        }
    }
    watchSubagents(sessionId) {
        const projectDir = this.findProjectDir(sessionId);
        if (!projectDir)
            return;
        const subagentsDir = path.join(projectDir, sessionId, 'subagents');
        if (!fs.existsSync(subagentsDir))
            return;
        try {
            const watcher = fs.watch(subagentsDir, (eventType, filename) => {
                if (!filename?.endsWith('.meta.json'))
                    return;
                this.loadSubagentMeta(sessionId, path.join(subagentsDir, filename));
            });
            this.watchers.push(watcher);
            const files = fs.readdirSync(subagentsDir).filter((f) => f.endsWith('.meta.json'));
            for (const file of files) {
                this.loadSubagentMeta(sessionId, path.join(subagentsDir, file));
            }
        }
        catch {
            // subagents dir may not exist
        }
    }
    loadSubagentMeta(sessionId, filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            const filename = path.basename(filePath);
            const match = filename.match(/^agent-(.+)\.meta\.json$/);
            if (!match)
                return;
            const agentId = match[1];
            const subagent = {
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
        }
        catch {
            // skip malformed
        }
    }
    findProjectDir(sessionId) {
        try {
            const projects = fs.readdirSync(this.projectsDir);
            for (const proj of projects) {
                const projPath = path.join(this.projectsDir, proj);
                if (!fs.statSync(projPath).isDirectory())
                    continue;
                if (fs.existsSync(path.join(projPath, `${sessionId}.jsonl`))) {
                    return projPath;
                }
            }
        }
        catch {
            // projectsDir may not exist
        }
        return undefined;
    }
    checkPidAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    startLivenessChecks() {
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
exports.SessionStore = SessionStore;
//# sourceMappingURL=sessionStore.js.map