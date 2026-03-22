import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
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
export async function openStream(
  bridge: ClaudeCodeBridge,
  streamPanel: StreamPanel,
  node?: SessionNode | SubagentNode
): Promise<void> {
  const target = await resolveTarget(bridge, node);
  if (!target) return;

  const { agentId, label, jsonlPath } = target;

  const reader = bridge.getStreamReader(jsonlPath, { startFromEnd: false });
  streamPanel.createTerminal(agentId, label, reader);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface StreamTarget {
  agentId: string;
  label: string;
  jsonlPath: string;
}

async function resolveTarget(
  bridge: ClaudeCodeBridge,
  node: SessionNode | SubagentNode | undefined
): Promise<StreamTarget | undefined> {
  const homeDir = os.homedir();
  const projectsDir = path.join(homeDir, '.claude', 'projects');

  if (node instanceof SubagentNode) {
    const { subagent } = node;
    const session = bridge.sessionStore.getSessionById(subagent.sessionId);
    if (!session) {
      vscode.window.showErrorMessage(
        `Session not found for subagent ${subagent.agentId.substring(0, 8)}.`
      );
      return undefined;
    }

    const projectKey = session.cwd.replace(/\//g, '-');
    const jsonlPath = path.join(
      projectsDir,
      projectKey,
      subagent.sessionId,
      'subagents',
      `agent-${subagent.agentId}.jsonl`
    );

    return {
      agentId: subagent.agentId,
      label: `${subagent.agentType} #${subagent.agentId.substring(0, 4)}`,
      jsonlPath,
    };
  }

  if (node instanceof SessionNode) {
    const { session } = node;
    const projectKey = session.cwd.replace(/\//g, '-');
    const jsonlPath = path.join(projectsDir, projectKey, `${session.sessionId}.jsonl`);

    return {
      agentId: session.sessionId,
      label: `Session #${session.sessionId.substring(0, 4)} — ${path.basename(session.cwd)}`,
      jsonlPath,
    };
  }

  // No node — prompt the user to select a session
  const sessions = bridge.sessionStore.getSessions();
  if (sessions.length === 0) {
    vscode.window.showInformationMessage('No agent sessions found.');
    return undefined;
  }

  const items = sessions.map((s) => ({
    label: `Session #${s.sessionId.substring(0, 8)}`,
    description: s.cwd,
    detail: `Status: ${s.status}`,
    session: s,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Open Agent Stream',
    placeHolder: 'Select a session',
  });

  if (!picked) return undefined;

  const s = picked.session;
  const projectKey = s.cwd.replace(/\//g, '-');
  const jsonlPath = path.join(projectsDir, projectKey, `${s.sessionId}.jsonl`);

  return {
    agentId: s.sessionId,
    label: `Session #${s.sessionId.substring(0, 4)} — ${path.basename(s.cwd)}`,
    jsonlPath,
  };
}
