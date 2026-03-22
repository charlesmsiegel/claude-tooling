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
exports.stopAgent = stopAgent;
exports.killAgent = killAgent;
const vscode = __importStar(require("vscode"));
const agentTreeItems_1 = require("../views/agentTreeItems");
/**
 * Gracefully stops a Claude agent session (SIGTERM).
 * If no node is provided, prompts the user to pick a running session.
 */
async function stopAgent(bridge, node) {
    const session = await resolveSession(bridge, node, 'Stop Agent');
    if (!session)
        return;
    const { pid, sessionId } = session;
    const stopped = await bridge.processManager.stop(pid);
    if (stopped) {
        vscode.window.showInformationMessage(`Agent session ${sessionId.substring(0, 8)} stopped.`);
    }
    else {
        vscode.window.showWarningMessage(`Could not stop session ${sessionId.substring(0, 8)} — process may have already exited.`);
    }
}
/**
 * Forcibly kills a Claude agent session (SIGKILL) after user confirmation.
 * If no node is provided, prompts the user to pick a running session.
 */
async function killAgent(bridge, node) {
    const session = await resolveSession(bridge, node, 'Kill Agent');
    if (!session)
        return;
    const { pid, sessionId } = session;
    const answer = await vscode.window.showWarningMessage(`Force-kill session ${sessionId.substring(0, 8)}? This cannot be undone.`, { modal: true }, 'Kill');
    if (answer !== 'Kill')
        return;
    const killed = await bridge.processManager.kill(pid);
    if (killed) {
        vscode.window.showInformationMessage(`Agent session ${sessionId.substring(0, 8)} killed.`);
    }
    else {
        vscode.window.showWarningMessage(`Could not kill session ${sessionId.substring(0, 8)} — process may have already exited.`);
    }
}
async function resolveSession(bridge, node, title) {
    if (node instanceof agentTreeItems_1.SessionNode) {
        return { pid: node.session.pid, sessionId: node.session.sessionId };
    }
    // Fall back to a QuickPick of all known sessions
    const sessions = bridge.sessionStore.getSessions().filter((s) => s.status === 'active');
    if (sessions.length === 0) {
        vscode.window.showInformationMessage('No active agent sessions found.');
        return undefined;
    }
    const items = sessions.map((s) => ({
        label: `Session #${s.sessionId.substring(0, 8)}`,
        description: s.cwd,
        detail: `PID ${s.pid}`,
        session: s,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title,
        placeHolder: 'Select a session',
    });
    if (!picked)
        return undefined;
    return { pid: picked.session.pid, sessionId: picked.session.sessionId };
}
//# sourceMappingURL=stopAgent.js.map