import * as vscode from 'vscode';
import { StreamReader } from '../bridge/streamReader';

export class StreamPanel {
  private terminals = new Map<string, vscode.Terminal>();

  createTerminal(agentId: string, label: string, reader: StreamReader): vscode.Terminal {
    const existing = this.terminals.get(agentId);
    if (existing) {
      existing.show();
      return existing;
    }

    const writeEmitter = new vscode.EventEmitter<string>();
    const closeEmitter = new vscode.EventEmitter<void>();

    const pty: vscode.Pseudoterminal = {
      onDidWrite: writeEmitter.event,
      onDidClose: closeEmitter.event,
      open: () => {
        writeEmitter.fire(`\x1b[36m[${label}]\x1b[0m Connected to agent stream\r\n\r\n`);

        reader.on('data', (data: any) => {
          const formatted = StreamPanel.formatStreamData(data);
          if (formatted) {
            writeEmitter.fire(formatted);
          }
        });

        reader.on('raw', (line: string) => {
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

  static formatStreamData(data: any): string | null {
    if (!data || typeof data !== 'object') return null;

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

  disposeTerminal(agentId: string): void {
    const terminal = this.terminals.get(agentId);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(agentId);
    }
  }

  dispose(): void {
    for (const [, terminal] of this.terminals) {
      terminal.dispose();
    }
    this.terminals.clear();
  }
}
