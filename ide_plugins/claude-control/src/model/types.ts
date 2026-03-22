// Scopes
export type Scope = {
  type: "global" | "project";
  label: string;
  path: string; // absolute path to the .claude/ directory
};

// Base for all managed objects
export interface BaseObject {
  id: string; // unique identifier (scope + type + name)
  name: string;
  scope: Scope;
  filePath: string; // absolute path to the backing file
}

// Agents
export interface AgentConfig extends BaseObject {
  type: "agent";
  model?: string;
  description?: string;
  color?: string;
  instructions?: string;
  permissions?: string[];
  skills?: string[]; // IDs of linked skills
  hooks?: string[]; // IDs of linked hooks
  mcpServers?: string[]; // IDs of linked MCP servers
  claudeMdFiles?: string[]; // IDs of linked CLAUDE.md files
}

// Skills
export interface SkillConfig extends BaseObject {
  type: "skill";
  description?: string;
  triggerConditions?: string;
  skillType?: "rigid" | "flexible";
  content: string;
}

// Hooks
export interface HookConfig extends BaseObject {
  type: "hook";
  event: string; // PreToolUse, PostToolUse, Notification, etc.
  matcher?: string;
  command: string;
  timeout?: number;
  enabled: boolean;
}

// Commands
export interface CommandConfig extends BaseObject {
  type: "command";
  description?: string;
  template: string;
  arguments?: string;
}

// MCP Servers
export interface McpServerConfig extends BaseObject {
  type: "mcpServer";
  transportType: "stdio" | "sse";
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

// Settings
export interface SettingsConfig extends BaseObject {
  type: "settings";
  permissions?: Record<string, string[]>;
  model?: string;
  customInstructions?: string;
  enabledPlugins?: string[]; // plugin identifiers from global settings
  hooks?: string[]; // IDs of linked hooks
  raw: Record<string, unknown>; // full raw JSON
}

// CLAUDE.md
export interface ClaudeMdConfig extends BaseObject {
  type: "claudeMd";
  content: string;
  sections: ClaudeMdSection[];
}

export interface ClaudeMdSection {
  heading: string;
  content: string;
}

// Memory
export interface MemoryConfig extends BaseObject {
  type: "memory";
  topic: string;
  content: string;
}

// Union type
export type ConfigObject =
  | AgentConfig
  | SkillConfig
  | HookConfig
  | CommandConfig
  | McpServerConfig
  | SettingsConfig
  | ClaudeMdConfig
  | MemoryConfig;

export type ConfigObjectType = ConfigObject["type"];

// Connections
export interface Connection {
  id: string;
  sourceId: string;
  sourceType: ConfigObjectType;
  targetId: string;
  targetType: ConfigObjectType;
}

// Messages between extension host and webview
export type ExtensionMessage =
  | { type: "update"; objectType: ConfigObjectType; objects: ConfigObject[] }
  | { type: "connections"; connections: Connection[] }
  | { type: "scopeList"; scopes: Scope[] };

export type WebviewMessage =
  | { type: "save"; object: ConfigObject }
  | { type: "delete"; objectId: string }
  | { type: "connect"; sourceId: string; targetId: string }
  | { type: "disconnect"; connectionId: string }
  | { type: "ready" };
