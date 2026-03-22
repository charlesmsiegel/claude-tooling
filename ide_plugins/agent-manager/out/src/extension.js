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
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const bridge_1 = require("./bridge");
const agentTreeProvider_1 = require("./views/agentTreeProvider");
const streamPanel_1 = require("./views/streamPanel");
const agentTreeItems_1 = require("./views/agentTreeItems");
const launchAgent_1 = require("./commands/launchAgent");
const stopAgent_1 = require("./commands/stopAgent");
const openStream_1 = require("./commands/openStream");
function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('Claude Agent Manager');
    outputChannel.appendLine('Claude Agent Manager activating...');
    context.subscriptions.push(outputChannel);
    // ── 1. Bridge ───────────────────────────────────────────────────────────────
    const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
    const bridge = new bridge_1.ClaudeCodeBridge(workspaceFolders);
    const manualDirs = vscode.workspace
        .getConfiguration('claudeAgentManager')
        .get('watchedDirectories', []);
    bridge.init(manualDirs).catch((err) => {
        outputChannel.appendLine(`Bridge init error: ${String(err)}`);
    });
    context.subscriptions.push({ dispose: () => bridge.dispose() });
    // ── 2. Views ────────────────────────────────────────────────────────────────
    const treeProvider = new agentTreeProvider_1.AgentTreeProvider(bridge);
    const streamPanel = new streamPanel_1.StreamPanel();
    const treeView = vscode.window.registerTreeDataProvider('claudeAgents', treeProvider);
    context.subscriptions.push(treeView);
    context.subscriptions.push({ dispose: () => treeProvider.dispose() });
    context.subscriptions.push({ dispose: () => streamPanel.dispose() });
    // ── 3. Commands ─────────────────────────────────────────────────────────────
    // launchAgent — palette, sidebar button, directory context menu
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.launchAgent', (node) => (0, launchAgent_1.launchAgent)(bridge, streamPanel, node)));
    // refresh
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.refresh', () => {
        treeProvider.refresh();
    }));
    // openStream — session or subagent context menu
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.openStream', (node) => (0, openStream_1.openStream)(bridge, streamPanel, node)));
    // stopAgent
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.stopAgent', (node) => (0, stopAgent_1.stopAgent)(bridge, node)));
    // killAgent
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.killAgent', (node) => (0, stopAgent_1.killAgent)(bridge, node)));
    // resumeAgent — terminal only (no spawnClaude)
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.resumeAgent', (node) => {
        if (!node) {
            vscode.window.showErrorMessage('Select a session node to resume.');
            return;
        }
        const { session } = node;
        const terminalName = `Claude — resume #${session.sessionId.substring(0, 8)}`;
        const terminal = vscode.window.createTerminal({
            name: terminalName,
            cwd: session.cwd,
            iconPath: new vscode.ThemeIcon('hubot'),
        });
        terminal.sendText(`claude resume ${session.sessionId}`);
        terminal.show();
    }));
    // addWatchDir
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.addWatchDir', async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Add Directory',
        });
        if (!uris || uris.length === 0)
            return;
        const dirPath = uris[0].fsPath;
        bridge.worktreeFinder.addManualDirectory(dirPath);
        // Persist to settings
        const config = vscode.workspace.getConfiguration('claudeAgentManager');
        const existing = config.get('watchedDirectories', []);
        if (!existing.includes(dirPath)) {
            await config.update('watchedDirectories', [...existing, dirPath], vscode.ConfigurationTarget.Global);
        }
    }));
    // removeWatchDir — from directory context menu
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.removeWatchDir', async (node) => {
        let dirPath;
        if (node instanceof agentTreeItems_1.DirectoryNode) {
            dirPath = node.dir.path;
        }
        else {
            const dirs = bridge.worktreeFinder.getDirectories();
            const items = dirs.map((d) => ({
                label: d.path.replace(process.env.HOME ?? '', '~'),
                description: d.branch,
                dir: d,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                title: 'Remove Watch Directory',
                placeHolder: 'Select a directory to remove',
            });
            if (!picked)
                return;
            dirPath = picked.dir.path;
        }
        if (!dirPath)
            return;
        bridge.worktreeFinder.removeManualDirectory(dirPath);
        // Persist to settings
        const config = vscode.workspace.getConfiguration('claudeAgentManager');
        const existing = config.get('watchedDirectories', []);
        await config.update('watchedDirectories', existing.filter((d) => d !== dirPath), vscode.ConfigurationTarget.Global);
    }));
    // openInTerminal — directory context menu
    context.subscriptions.push(vscode.commands.registerCommand('claudeAgentManager.openInTerminal', (node) => {
        const dirPath = node instanceof agentTreeItems_1.DirectoryNode
            ? node.dir.path
            : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!dirPath)
            return;
        const terminal = vscode.window.createTerminal({
            name: path.basename(dirPath),
            cwd: dirPath,
        });
        terminal.show();
    }));
    outputChannel.appendLine('Claude Agent Manager activated.');
}
function deactivate() {
    // All disposables pushed to context.subscriptions are cleaned up automatically.
}
//# sourceMappingURL=extension.js.map