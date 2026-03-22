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
exports.SubagentNode = exports.SessionNode = exports.DirectoryNode = void 0;
const vscode = __importStar(require("vscode"));
class DirectoryNode extends vscode.TreeItem {
    dir;
    constructor(dir) {
        const shortPath = dir.path.replace(process.env.HOME ?? '', '~');
        const label = `${shortPath} (${dir.branch})`;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.dir = dir;
        this.contextValue = 'directory';
        this.iconPath = new vscode.ThemeIcon('folder');
        if (dir.isWorktree) {
            this.description = 'worktree';
        }
    }
}
exports.DirectoryNode = DirectoryNode;
class SessionNode extends vscode.TreeItem {
    session;
    constructor(session, subagentCount) {
        const shortId = session.sessionId.substring(0, 4);
        const label = `Session #${shortId}`;
        const collapsible = subagentCount > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None;
        super(label, collapsible);
        this.session = session;
        this.contextValue = session.status === 'idle' ? 'sessionIdle' : 'session';
        this.iconPath = SessionNode.statusIcon(session.status);
        if (subagentCount > 0) {
            this.description = `${subagentCount} subagent${subagentCount > 1 ? 's' : ''}`;
        }
    }
    static statusIcon(status) {
        switch (status) {
            case 'active': return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.runAction'));
            case 'idle': return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('editorWarning.foreground'));
            case 'errored': return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('errorForeground'));
            case 'completed': return new vscode.ThemeIcon('circle-outline');
        }
    }
}
exports.SessionNode = SessionNode;
class SubagentNode extends vscode.TreeItem {
    subagent;
    constructor(subagent) {
        const shortId = subagent.agentId.substring(0, 4);
        super(`${subagent.agentType} #${shortId}`, vscode.TreeItemCollapsibleState.None);
        this.subagent = subagent;
        this.contextValue = 'subagent';
        this.iconPath = new vscode.ThemeIcon('circle-small-filled', new vscode.ThemeColor('textLink.foreground'));
        this.description = subagent.description;
        this.tooltip = `Agent ID: ${subagent.agentId}\nType: ${subagent.agentType}\n${subagent.description}`;
    }
}
exports.SubagentNode = SubagentNode;
//# sourceMappingURL=agentTreeItems.js.map