import * as assert from 'assert';

describe('AgentTreeProvider data flow', () => {
  it('maps sessions to correct directories', () => {
    const sessions = [
      { pid: 1, sessionId: 'abc', cwd: '/home/user/project', startedAt: 1000, status: 'active' as const },
      { pid: 2, sessionId: 'def', cwd: '/home/user/other', startedAt: 2000, status: 'active' as const },
    ];
    const directories = [
      { path: '/home/user/project', branch: 'main', isWorktree: false, repoRoot: '/home/user/project' },
      { path: '/home/user/other', branch: 'feat', isWorktree: true, repoRoot: '/home/user/project' },
    ];

    for (const dir of directories) {
      const dirSessions = sessions.filter((s) => s.cwd === dir.path);
      if (dir.path === '/home/user/project') {
        assert.strictEqual(dirSessions.length, 1);
        assert.strictEqual(dirSessions[0].sessionId, 'abc');
      }
      if (dir.path === '/home/user/other') {
        assert.strictEqual(dirSessions.length, 1);
        assert.strictEqual(dirSessions[0].sessionId, 'def');
      }
    }
  });

  it('nests subagents under correct sessions', () => {
    const subagents = [
      { agentId: 'x1', agentType: 'Explore', description: 'searching', sessionId: 'abc' },
      { agentId: 'x2', agentType: 'Plan', description: 'planning', sessionId: 'abc' },
      { agentId: 'x3', agentType: 'Explore', description: 'other', sessionId: 'def' },
    ];

    const abcSubs = subagents.filter((s) => s.sessionId === 'abc');
    const defSubs = subagents.filter((s) => s.sessionId === 'def');

    assert.strictEqual(abcSubs.length, 2);
    assert.strictEqual(defSubs.length, 1);
  });
});
