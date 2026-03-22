import * as vscode from "vscode";
import { Store } from "../model/store";
import { ConfigObjectType } from "../model/types";
import { CategoryTreeItem, ConfigObjectTreeItem } from "./items";

const CATEGORIES: { type: ConfigObjectType; label: string }[] = [
  { type: "agent", label: "Agents" },
  { type: "skill", label: "Skills" },
  { type: "hook", label: "Hooks" },
  { type: "command", label: "Commands" },
  { type: "mcpServer", label: "MCP Servers" },
  { type: "settings", label: "Settings" },
  { type: "claudeMd", label: "CLAUDE.md" },
  { type: "memory", label: "Memory" },
];

export class ClaudeTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private store: Store) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      // Root level: categories
      return CATEGORIES.map(
        (cat) =>
          new CategoryTreeItem(
            cat.type,
            cat.label,
            this.store.listByType(cat.type).length
          )
      );
    }

    if (element instanceof CategoryTreeItem) {
      // Category children: config objects
      return this.store
        .listByType(element.category)
        .map((obj) => new ConfigObjectTreeItem(obj));
    }

    return [];
  }
}
