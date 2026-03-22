import * as vscode from 'vscode';
import { ClaudeCodeBridge } from '../bridge';
import { SessionNode } from '../views/agentTreeItems';

/**
 * Gracefully stops a Claude agent session (SIGTERM).
 * If no node is provided, prompts the user to pick a running session.
 */
export async function stopAgent(bridge: ClaudeCodeBridge, node?: SessionNode): Promise<void> {
  const session = await resolveSession(bridge, node, 'Stop Agent');
  if (!session) return;

  const { pid, sessionId } = session;
  const stopped = await bridge.processManager.stop(pid);

  if (stopped) {
    vscode.window.showInformationMessage(
      `Agent session ${sessionId.substring(0, 8)} stopped.`
    );
  } else {
    vscode.window.showWarningMessage(
      `Could not stop session ${sessionId.substring(0, 8)} — process may have already exited.`
    );
  }
}

/**
 * Forcibly kills a Claude agent session (SIGKILL) after user confirmation.
 * If no node is provided, prompts the user to pick a running session.
 */
export async function killAgent(bridge: ClaudeCodeBridge, node?: SessionNode): Promise<void> {
  const session = await resolveSession(bridge, node, 'Kill Agent');
  if (!session) return;

  const { pid, sessionId } = session;

  const answer = await vscode.window.showWarningMessage(
    `Force-kill session ${sessionId.substring(0, 8)}? This cannot be undone.`,
    { modal: true },
    'Kill'
  );

  if (answer !== 'Kill') return;

  const killed = await bridge.processManager.kill(pid);

  if (killed) {
    vscode.window.showInformationMessage(
      `Agent session ${sessionId.substring(0, 8)} killed.`
    );
  } else {
    vscode.window.showWarningMessage(
      `Could not kill session ${sessionId.substring(0, 8)} — process may have already exited.`
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SessionRef {
  pid: number;
  sessionId: string;
}

async function resolveSession(
  bridge: ClaudeCodeBridge,
  node: SessionNode | undefined,
  title: string
): Promise<SessionRef | undefined> {
  if (node instanceof SessionNode) {
    return { pid: node.session.pid, sessionId: node.session.sessionId };
  }

  // Fall back to a QuickPick of all known sessions
  const sessions = bridge.sessionStore.getSessions().filter((s) => s.status === 'active');

  if (sessions.length === 0) {
    vscode.window.showInformationMessage('No active agent sessions found.');
    return undefined;
  }

  const items = sessions.map((s) => ({
    label: `Session #${s.sessionId.substring(0, 8)}`,
    description: s.cwd,
    detail: `PID ${s.pid}`,
    session: s,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title,
    placeHolder: 'Select a session',
  });

  if (!picked) return undefined;
  return { pid: picked.session.pid, sessionId: picked.session.sessionId };
}
