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
exports.StreamPanel = void 0;
const vscode = __importStar(require("vscode"));
class StreamPanel {
    terminals = new Map();
    createTerminal(agentId, label, reader) {
        const existing = this.terminals.get(agentId);
        if (existing) {
            existing.show();
            return existing;
        }
        const writeEmitter = new vscode.EventEmitter();
        const closeEmitter = new vscode.EventEmitter();
        const pty = {
            onDidWrite: writeEmitter.event,
            onDidClose: closeEmitter.event,
            open: () => {
                writeEmitter.fire(`\x1b[36m[${label}]\x1b[0m Connected to agent stream\r\n\r\n`);
                reader.on('data', (data) => {
                    const formatted = StreamPanel.formatStreamData(data);
                    if (formatted) {
                        writeEmitter.fire(formatted);
                    }
                });
                reader.on('raw', (line) => {
                    writeEmitter.fire(line + '\r\n');
                });
                reader.start();
            },
            close: () => {
                reader.stop();
                this.terminals.delete(agentId);
            },
        };
        const terminal = vscode.window.createTerminal({
            name: label,
            pty,
            iconPath: new vscode.ThemeIcon('hubot'),
        });
        terminal.show();
        this.terminals.set(agentId, terminal);
        return terminal;
    }
    static formatStreamData(data) {
        if (!data || typeof data !== 'object')
            return null;
        if (data.type === 'assistant' && data.message?.content) {
            const content = typeof data.message.content === 'string'
                ? data.message.content
                : JSON.stringify(data.message.content);
            return content.replace(/\n/g, '\r\n') + '\r\n';
        }
        if (data.type === 'tool_use') {
            return `\x1b[33m[Tool: ${data.name}]\x1b[0m ${JSON.stringify(data.input ?? {}).substring(0, 200)}\r\n`;
        }
        if (data.type === 'tool_result') {
            const preview = typeof data.content === 'string'
                ? data.content.substring(0, 300)
                : JSON.stringify(data.content ?? '').substring(0, 300);
            return `\x1b[32m[Result]\x1b[0m ${preview.replace(/\n/g, '\r\n')}\r\n`;
        }
        if (data.type) {
            return `\x1b[90m[${data.type}]\x1b[0m\r\n`;
        }
        return null;
    }
    disposeTerminal(agentId) {
        const terminal = this.terminals.get(agentId);
        if (terminal) {
            terminal.dispose();
            this.terminals.delete(agentId);
        }
    }
    dispose() {
        for (const [, terminal] of this.terminals) {
            terminal.dispose();
        }
        this.terminals.clear();
    }
}
exports.StreamPanel = StreamPanel;
//# sourceMappingURL=streamPanel.js.map