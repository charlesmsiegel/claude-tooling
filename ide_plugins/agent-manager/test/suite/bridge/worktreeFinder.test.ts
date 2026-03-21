import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorktreeFinder } from '../../../src/bridge/worktreeFinder';

describe('WorktreeFinder', () => {
  let tmpDir: string;
  let finder: WorktreeFinder | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worktree-test-'));
  });

  afterEach(() => {
    finder?.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses git worktree list --porcelain output', () => {
    const output = [
      'worktree /home/user/myproject',
      'HEAD abc123def456',
      'branch refs/heads/main',
      '',
      'worktree /home/user/myproject-feat',
      'HEAD def456abc123',
      'branch refs/heads/feat/auth',
      '',
    ].join('\n');

    const result = WorktreeFinder.parseWorktreeOutput(output, '/home/user/myproject');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].path, '/home/user/myproject');
    assert.strictEqual(result[0].branch, 'main');
    assert.strictEqual(result[0].isWorktree, false);
    assert.strictEqual(result[1].path, '/home/user/myproject-feat');
    assert.strictEqual(result[1].branch, 'feat/auth');
    assert.strictEqual(result[1].isWorktree, true);
  });

  it('merges manual directories with discovered worktrees', () => {
    const discovered = [
      { path: '/home/user/project', branch: 'main', isWorktree: false, repoRoot: '/home/user/project' },
    ];
    const manual = ['/home/user/other-dir'];

    const result = WorktreeFinder.mergeDirectories(discovered, manual);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].path, '/home/user/other-dir');
    assert.strictEqual(result[1].branch, 'unknown');
  });
});
