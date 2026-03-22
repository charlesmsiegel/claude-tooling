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
exports.openStream = openStream;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const agentTreeItems_1 = require("../views/agentTreeItems");
/**
 * Opens an agent stream panel for the given session or subagent.
 * If no node is passed, prompts the user to pick a session.
 *
 * JSONL path encoding:
 *   project-key  = session.cwd.replace(/\//g, '-')
 *                  e.g. /home/user/project  →  -home-user-project
 *
 * Session JSONL:
 *   ~/.claude/projects/<project-key>/<sessionId>.jsonl
 *
 * Subagent JSONL:
 *   ~/.claude/projects/<project-key>/<sessionId>/subagents/agent-<agentId>.jsonl
 */
async function openStream(bridge, streamPanel, node) {
    const target = await resolveTarget(bridge, node);
    if (!target)
        return;
    const { agentId, label, jsonlPath } = target;
    const reader = bridge.getStreamReader(jsonlPath, { startFromEnd: false });
    streamPanel.createTerminal(agentId, label, reader);
}
async function resolveTarget(bridge, node) {
    const homeDir = os.homedir();
    const projectsDir = path.join(homeDir, '.claude', 'projects');
    if (node instanceof agentTreeItems_1.SubagentNode) {
        const { subagent } = node;
        const session = bridge.sessionStore.getSessionById(subagent.sessionId);
        if (!session) {
            vscode.window.showErrorMessage(`Session not found for subagent ${subagent.agentId.substring(0, 8)}.`);
            return undefined;
        }
        const projectKey = session.cwd.replace(/\//g, '-');
        const jsonlPath = path.join(projectsDir, projectKey, subagent.sessionId, 'subagents', `agent-${subagent.agentId}.jsonl`);
        return {
            agentId: subagent.agentId,
            label: `${subagent.agentType} #${subagent.agentId.substring(0, 4)}`,
            jsonlPath,
        };
    }
    if (node instanceof agentTreeItems_1.SessionNode) {
        const { session } = node;
        const projectKey = session.cwd.replace(/\//g, '-');
        const jsonlPath = path.join(projectsDir, projectKey, `${session.sessionId}.jsonl`);
        return {
            agentId: session.sessionId,
            label: `Session #${session.sessionId.substring(0, 4)} — ${path.basename(session.cwd)}`,
            jsonlPath,
        };
    }
    // No node — prompt the user to select a session
    const sessions = bridge.sessionStore.getSessions();
    if (sessions.length === 0) {
        vscode.window.showInformationMessage('No agent sessions found.');
        return undefined;
    }
    const items = sessions.map((s) => ({
        label: `Session #${s.sessionId.substring(0, 8)}`,
        description: s.cwd,
        detail: `Status: ${s.status}`,
        session: s,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: 'Open Agent Stream',
        placeHolder: 'Select a session',
    });
    if (!picked)
        return undefined;
    const s = picked.session;
    const projectKey = s.cwd.replace(/\//g, '-');
    const jsonlPath = path.join(projectsDir, projectKey, `${s.sessionId}.jsonl`);
    return {
        agentId: s.sessionId,
        label: `Session #${s.sessionId.substring(0, 4)} — ${path.basename(s.cwd)}`,
        jsonlPath,
    };
}
//# sourceMappingURL=openStream.js.map