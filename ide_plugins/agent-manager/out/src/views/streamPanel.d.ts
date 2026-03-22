import * as vscode from 'vscode';
import { StreamReader } from '../bridge/streamReader';
export declare class StreamPanel {
    private terminals;
    createTerminal(agentId: string, label: string, reader: StreamReader): vscode.Terminal;
    static formatStreamData(data: any): string | null;
    disposeTerminal(agentId: string): void;
    dispose(): void;
}
