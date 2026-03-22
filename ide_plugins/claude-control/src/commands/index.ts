import * as vscode from "vscode";
import { Store } from "../model/store";
import { PanelManager } from "../webview/panel-manager";
import { ClaudeTreeProvider } from "../tree/provider";
import { ConfigObject } from "../model/types";

export function registerCommands(
  context: vscode.ExtensionContext,
  store: Store,
  panelManager: PanelManager,
  treeProvider: ClaudeTreeProvider,
  reloadAll: () => void
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("claudeControl.refresh", () => {
      reloadAll();
    }),

    vscode.commands.registerCommand("claudeControl.openEditor", (obj: ConfigObject) => {
      panelManager.openEditor(obj);
    }),

    vscode.commands.registerCommand("claudeControl.showConnections", () => {
      panelManager.openConnectionsView();
    })
  );
}
