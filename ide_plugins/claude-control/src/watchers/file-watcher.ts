import * as vscode from "vscode";
import { Scope } from "../model/types";

export class ClaudeFileWatcher implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private onChange: () => void;

  constructor(scopes: Scope[], onChange: () => void) {
    this.onChange = onChange;

    for (const scope of scopes) {
      const pattern = new vscode.RelativePattern(scope.path, "**/*");
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidChange(() => this.onChange());
      watcher.onDidCreate(() => this.onChange());
      watcher.onDidDelete(() => this.onChange());
      this.watchers.push(watcher);
    }
  }

  dispose(): void {
    this.watchers.forEach((w) => w.dispose());
  }
}
