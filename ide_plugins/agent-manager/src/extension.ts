import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Claude Agent Manager');
  outputChannel.appendLine('Claude Agent Manager activating...');
  context.subscriptions.push(outputChannel);
}

export function deactivate(): void {
  // cleanup will go here
}
