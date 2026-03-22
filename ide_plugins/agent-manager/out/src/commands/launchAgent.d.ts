import { ClaudeCodeBridge } from '../bridge';
import { StreamPanel } from '../views/streamPanel';
import { DirectoryNode } from '../views/agentTreeItems';
/**
 * Multi-step QuickPick flow: where → how → what.
 * Entry points: command palette, context menu (DirectoryNode), sidebar button.
 */
export declare function launchAgent(bridge: ClaudeCodeBridge, streamPanel: StreamPanel, node?: DirectoryNode): Promise<void>;
