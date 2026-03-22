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
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const sessionStore_1 = require("../../../src/bridge/sessionStore");
describe('SessionStore', () => {
    let tmpDir;
    let sessionsDir;
    let projectsDir;
    let store;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-manager-test-'));
        sessionsDir = path.join(tmpDir, 'sessions');
        projectsDir = path.join(tmpDir, 'projects');
        fs.mkdirSync(sessionsDir, { recursive: true });
        fs.mkdirSync(projectsDir, { recursive: true });
    });
    afterEach(() => {
        store?.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it('discovers existing sessions on init', async () => {
        fs.writeFileSync(path.join(sessionsDir, '12345.json'), JSON.stringify({ pid: 12345, sessionId: 'abc-123', cwd: '/home/user/project', startedAt: 1774000000000 }));
        store = new sessionStore_1.SessionStore(sessionsDir, projectsDir);
        await store.init();
        const sessions = store.getSessions();
        assert.strictEqual(sessions.length, 1);
        assert.strictEqual(sessions[0].sessionId, 'abc-123');
        assert.strictEqual(sessions[0].pid, 12345);
    });
    it('emits session-added when new session file appears', async () => {
        store = new sessionStore_1.SessionStore(sessionsDir, projectsDir);
        await store.init();
        const added = new Promise((resolve) => store.on('session-added', resolve));
        fs.writeFileSync(path.join(sessionsDir, '99999.json'), JSON.stringify({ pid: 99999, sessionId: 'new-session', cwd: '/tmp/test', startedAt: Date.now() }));
        const session = await added;
        assert.strictEqual(session.sessionId, 'new-session');
    });
    it('skips malformed session files gracefully', async () => {
        fs.writeFileSync(path.join(sessionsDir, 'bad.json'), 'not json');
        fs.writeFileSync(path.join(sessionsDir, 'good.json'), JSON.stringify({ pid: 111, sessionId: 'good', cwd: '/tmp', startedAt: 1774000000000 }));
        store = new sessionStore_1.SessionStore(sessionsDir, projectsDir);
        await store.init();
        const sessions = store.getSessions();
        assert.strictEqual(sessions.length, 1);
        assert.strictEqual(sessions[0].sessionId, 'good');
    });
    it('discovers subagents under session directories', async () => {
        fs.writeFileSync(path.join(sessionsDir, '12345.json'), JSON.stringify({ pid: 12345, sessionId: 'abc-123', cwd: '/home/user/project', startedAt: 1774000000000 }));
        const projDir = path.join(projectsDir, '-home-user-project');
        const subagentsDir = path.join(projDir, 'abc-123', 'subagents');
        fs.mkdirSync(subagentsDir, { recursive: true });
        fs.writeFileSync(path.join(projDir, 'abc-123.jsonl'), '');
        fs.writeFileSync(path.join(subagentsDir, 'agent-x1y2z3.meta.json'), JSON.stringify({ agentType: 'Explore', description: 'Searching files' }));
        store = new sessionStore_1.SessionStore(sessionsDir, projectsDir);
        await store.init();
        const subagents = store.getSubagents('abc-123');
        assert.strictEqual(subagents.length, 1);
        assert.strictEqual(subagents[0].agentType, 'Explore');
        assert.strictEqual(subagents[0].agentId, 'x1y2z3');
        assert.strictEqual(subagents[0].sessionId, 'abc-123');
    });
});
//# sourceMappingURL=sessionStore.test.js.map