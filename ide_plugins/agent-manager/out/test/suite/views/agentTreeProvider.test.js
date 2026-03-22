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
describe('AgentTreeProvider data flow', () => {
    it('maps sessions to correct directories', () => {
        const sessions = [
            { pid: 1, sessionId: 'abc', cwd: '/home/user/project', startedAt: 1000, status: 'active' },
            { pid: 2, sessionId: 'def', cwd: '/home/user/other', startedAt: 2000, status: 'active' },
        ];
        const directories = [
            { path: '/home/user/project', branch: 'main', isWorktree: false, repoRoot: '/home/user/project' },
            { path: '/home/user/other', branch: 'feat', isWorktree: true, repoRoot: '/home/user/project' },
        ];
        for (const dir of directories) {
            const dirSessions = sessions.filter((s) => s.cwd === dir.path);
            if (dir.path === '/home/user/project') {
                assert.strictEqual(dirSessions.length, 1);
                assert.strictEqual(dirSessions[0].sessionId, 'abc');
            }
            if (dir.path === '/home/user/other') {
                assert.strictEqual(dirSessions.length, 1);
                assert.strictEqual(dirSessions[0].sessionId, 'def');
            }
        }
    });
    it('nests subagents under correct sessions', () => {
        const subagents = [
            { agentId: 'x1', agentType: 'Explore', description: 'searching', sessionId: 'abc' },
            { agentId: 'x2', agentType: 'Plan', description: 'planning', sessionId: 'abc' },
            { agentId: 'x3', agentType: 'Explore', description: 'other', sessionId: 'def' },
        ];
        const abcSubs = subagents.filter((s) => s.sessionId === 'abc');
        const defSubs = subagents.filter((s) => s.sessionId === 'def');
        assert.strictEqual(abcSubs.length, 2);
        assert.strictEqual(defSubs.length, 1);
    });
});
//# sourceMappingURL=agentTreeProvider.test.js.map