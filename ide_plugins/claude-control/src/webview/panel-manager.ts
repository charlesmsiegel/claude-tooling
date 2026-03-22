import * as vscode from "vscode";
import { ConfigObject, ConfigObjectType, ExtensionMessage, WebviewMessage } from "../model/types";
import { Store } from "../model/store";

export class PanelManager {
  private panels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private extensionUri: vscode.Uri,
    private store: Store,
    private onSave: (obj: ConfigObject) => void,
    private onDelete: (objectId: string) => void,
    private onConnect: (sourceId: string, targetId: string) => void,
    private onDisconnect: (connectionId: string) => void
  ) {}

  openEditor(obj: ConfigObject): void {
    const existingPanel = this.panels.get(obj.id);
    if (existingPanel) {
      existingPanel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "claudeControl.editor",
      `${obj.name} [${obj.scope.label}]`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "webview-ui", "dist"),
        ],
      }
    );

    panel.webview.html = this.getWebviewHtml(panel.webview, obj.type);
    this.panels.set(obj.id, panel);

    // Send initial data once webview signals ready
    panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      switch (message.type) {
        case "ready":
          this.sendObjectData(panel, obj);
          break;
        case "save":
          this.onSave(message.object);
          break;
        case "delete":
          this.onDelete(message.objectId);
          break;
        case "connect":
          this.onConnect(message.sourceId, message.targetId);
          break;
        case "disconnect":
          this.onDisconnect(message.connectionId);
          break;
      }
    });

    panel.onDidDispose(() => {
      this.panels.delete(obj.id);
    });
  }

  openConnectionsView(): void {
    const existingPanel = this.panels.get("__connections__");
    if (existingPanel) {
      existingPanel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "claudeControl.connections",
      "Connections",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "webview-ui", "dist"),
        ],
      }
    );

    panel.webview.html = this.getWebviewHtml(panel.webview, "connections");
    this.panels.set("__connections__", panel);

    panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      switch (message.type) {
        case "ready":
          this.sendConnectionsData(panel);
          break;
        case "connect":
          this.onConnect(message.sourceId, message.targetId);
          break;
        case "disconnect":
          this.onDisconnect(message.connectionId);
          break;
      }
    });

    panel.onDidDispose(() => {
      this.panels.delete("__connections__");
    });
  }

  updateAll(): void {
    for (const [id, panel] of this.panels) {
      if (id === "__connections__") {
        this.sendConnectionsData(panel);
      } else {
        const obj = this.store.get(id);
        if (obj) {
          this.sendObjectData(panel, obj);
        }
      }
    }
  }

  private sendObjectData(panel: vscode.WebviewPanel, obj: ConfigObject): void {
    const message: ExtensionMessage = {
      type: "update",
      objectType: obj.type,
      objects: [obj],
    };
    panel.webview.postMessage(message);

    // Also send connections for this object
    const connections = this.store.getConnectionsFor(obj.id);
    panel.webview.postMessage({
      type: "connections",
      connections,
    } as ExtensionMessage);
  }

  private sendConnectionsData(panel: vscode.WebviewPanel): void {
    // Send all objects grouped by type
    const types: ConfigObjectType[] = [
      "agent", "skill", "hook", "command", "mcpServer", "settings", "claudeMd", "memory",
    ];
    for (const t of types) {
      const message: ExtensionMessage = {
        type: "update",
        objectType: t,
        objects: this.store.listByType(t),
      };
      panel.webview.postMessage(message);
    }

    // Send all connections
    panel.webview.postMessage({
      type: "connections",
      connections: this.store.getConnections(),
    } as ExtensionMessage);
  }

  private getWebviewHtml(webview: vscode.Webview, editorType: string): string {
    const distUri = vscode.Uri.joinPath(this.extensionUri, "webview-ui", "dist");
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distUri, "assets", "index.js")
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
  <title>Claude Control</title>
</head>
<body>
  <div id="root" data-editor-type="${editorType}"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
