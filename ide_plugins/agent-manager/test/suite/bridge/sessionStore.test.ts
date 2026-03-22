import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SessionStore } from '../../../src/bridge/sessionStore';

describe('SessionStore', () => {
  let tmpDir: string;
  let sessionsDir: string;
  let projectsDir: string;
  let store: SessionStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-manager-test-'));
    sessionsDir = path.join(tmpDir, 'sessions');
    projectsDir = path.join(tmpDir, 'projects');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(projectsDir, { recursive: true });
  });

  afterEach(() => {
    store?.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers existing sessions on init', async () => {
    fs.writeFileSync(
      path.join(sessionsDir, '12345.json'),
      JSON.stringify({ pid: 12345, sessionId: 'abc-123', cwd: '/home/user/project', startedAt: 1774000000000 })
    );

    store = new SessionStore(sessionsDir, projectsDir);
    await store.init();

    const sessions = store.getSessions();
    assert.strictEqual(sessions.length, 1);
    assert.strictEqual(sessions[0].sessionId, 'abc-123');
    assert.strictEqual(sessions[0].pid, 12345);
  });

  it('emits session-added when new session file appears', async () => {
    store = new SessionStore(sessionsDir, projectsDir);
    await store.init();

    const added = new Promise<any>((resolve) => store.on('session-added', resolve));

    fs.writeFileSync(
      path.join(sessionsDir, '99999.json'),
      JSON.stringify({ pid: 99999, sessionId: 'new-session', cwd: '/tmp/test', startedAt: Date.now() })
    );

    const session = await added;
    assert.strictEqual(session.sessionId, 'new-session');
  });

  it('skips malformed session files gracefully', async () => {
    fs.writeFileSync(path.join(sessionsDir, 'bad.json'), 'not json');
    fs.writeFileSync(
      path.join(sessionsDir, 'good.json'),
      JSON.stringify({ pid: 111, sessionId: 'good', cwd: '/tmp', startedAt: 1774000000000 })
    );

    store = new SessionStore(sessionsDir, projectsDir);
    await store.init();

    const sessions = store.getSessions();
    assert.strictEqual(sessions.length, 1);
    assert.strictEqual(sessions[0].sessionId, 'good');
  });

  it('discovers subagents under session directories', async () => {
    fs.writeFileSync(
      path.join(sessionsDir, '12345.json'),
      JSON.stringify({ pid: 12345, sessionId: 'abc-123', cwd: '/home/user/project', startedAt: 1774000000000 })
    );

    const projDir = path.join(projectsDir, '-home-user-project');
    const subagentsDir = path.join(projDir, 'abc-123', 'subagents');
    fs.mkdirSync(subagentsDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, 'abc-123.jsonl'), '');
    fs.writeFileSync(
      path.join(subagentsDir, 'agent-x1y2z3.meta.json'),
      JSON.stringify({ agentType: 'Explore', description: 'Searching files' })
    );
    fs.writeFileSync(path.join(subagentsDir, 'agent-x1y2z3.jsonl'), '{"type":"assistant","message":{"content":"working..."}}\n');

    store = new SessionStore(sessionsDir, projectsDir);
    await store.init();

    const subagents = store.getSubagents('abc-123');
    assert.strictEqual(subagents.length, 1);
    assert.strictEqual(subagents[0].agentType, 'Explore');
    assert.strictEqual(subagents[0].agentId, 'x1y2z3');
    assert.strictEqual(subagents[0].sessionId, 'abc-123');
    assert.strictEqual(subagents[0].status, 'active');
  });
});
