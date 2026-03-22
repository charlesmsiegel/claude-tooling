import { ClaudeCodeBridge } from '../bridge';
import { StreamPanel } from '../views/streamPanel';
import { SessionNode, SubagentNode } from '../views/agentTreeItems';
/**
 * Opens an agent stream panel for the given session or subagent.
 * If no node is passed, prompts the user to pick a session.
 *
 * JSONL path encoding:
 *   project-key  = session.cwd.replace(/\//g, '-')
 *                  e.g. /home/user/project  →  -home-user-project
 *
 * Session JSONL:
 *   ~/.claude/projects/<project-key>/<sessionId>.jsonl
 *
 * Subagent JSONL:
 *   ~/.claude/projects/<project-key>/<sessionId>/subagents/agent-<agentId>.jsonl
 */
export declare function openStream(bridge: ClaudeCodeBridge, streamPanel: StreamPanel, node?: SessionNode | SubagentNode): Promise<void>;
