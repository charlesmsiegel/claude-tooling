import * as fs from "fs";
import * as path from "path";
import { McpServerConfig, Scope } from "../types";

export class McpServersSerializer {
  static readAll(mcpPath: string, scope: Scope): McpServerConfig[] {
    if (!fs.existsSync(mcpPath)) return [];

    const raw = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    if (!raw.mcpServers) return [];

    return Object.entries(raw.mcpServers).map(([name, config]: [string, any]) => ({
      id: `${scope.type}:${scope.label}:mcpServer:${name}`,
      name,
      type: "mcpServer" as const,
      scope,
      filePath: mcpPath,
      transportType: config.type === "sse" ? "sse" : "stdio",
      command: config.command,
      url: config.url,
      args: config.args,
      env: config.env,
      enabled: config.disabled !== true,
    }));
  }

  static write(server: McpServerConfig): void {
    let raw: Record<string, any> = {};
    if (fs.existsSync(server.filePath)) {
      raw = JSON.parse(fs.readFileSync(server.filePath, "utf-8"));
    }
    if (!raw.mcpServers) raw.mcpServers = {};

    const entry: Record<string, any> = { type: server.transportType };
    if (server.command) entry.command = server.command;
    if (server.url) entry.url = server.url;
    if (server.args?.length) entry.args = server.args;
    if (server.env && Object.keys(server.env).length) entry.env = server.env;
    if (!server.enabled) entry.disabled = true;

    raw.mcpServers[server.name] = entry;

    const dir = path.dirname(server.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(server.filePath, JSON.stringify(raw, null, 2) + "\n");
  }

  static remove(name: string, mcpPath: string): void {
    if (!fs.existsSync(mcpPath)) return;

    const raw = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    if (raw.mcpServers) {
      delete raw.mcpServers[name];
      fs.writeFileSync(mcpPath, JSON.stringify(raw, null, 2) + "\n");
    }
  }
}
