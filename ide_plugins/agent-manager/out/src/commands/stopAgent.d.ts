import { ClaudeCodeBridge } from '../bridge';
import { SessionNode } from '../views/agentTreeItems';
/**
 * Gracefully stops a Claude agent session (SIGTERM).
 * If no node is provided, prompts the user to pick a running session.
 */
export declare function stopAgent(bridge: ClaudeCodeBridge, node?: SessionNode): Promise<void>;
/**
 * Forcibly kills a Claude agent session (SIGKILL) after user confirmation.
 * If no node is provided, prompts the user to pick a running session.
 */
export declare function killAgent(bridge: ClaudeCodeBridge, node?: SessionNode): Promise<void>;
