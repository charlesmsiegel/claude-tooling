import * as vscode from "vscode";
import { ConfigObject, ConfigObjectType } from "../model/types";

export class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly category: ConfigObjectType,
    public readonly label: string,
    public readonly count: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `(${count})`;
    this.contextValue = "category";
    this.iconPath = CategoryTreeItem.getIcon(category);
  }

  static getIcon(category: ConfigObjectType): vscode.ThemeIcon {
    const icons: Record<ConfigObjectType, string> = {
      agent: "person",
      skill: "lightbulb",
      hook: "zap",
      command: "terminal",
      mcpServer: "server",
      settings: "gear",
      claudeMd: "book",
      memory: "database",
    };
    return new vscode.ThemeIcon(icons[category]);
  }
}

export class ConfigObjectTreeItem extends vscode.TreeItem {
  constructor(public readonly configObject: ConfigObject) {
    super(configObject.name, vscode.TreeItemCollapsibleState.None);
    this.description = `[${configObject.scope.label}]`;
    this.contextValue = "configObject";
    this.tooltip = `${configObject.name} (${configObject.scope.label})`;
    this.command = {
      command: "claudeControl.openEditor",
      title: "Open Editor",
      arguments: [configObject],
    };
  }
}
