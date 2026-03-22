import * as assert from 'assert';
import { ProcessManager } from '../../../src/bridge/processManager';

describe('ProcessManager', () => {
  let manager: ProcessManager;

  beforeEach(() => {
    manager = new ProcessManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('spawns a process and tracks it', async () => {
    const child = manager.spawn({
      cwd: '/tmp',
      command: 'echo',
      args: ['hello'],
    });

    assert.ok(child.pid);
    assert.ok(manager.getSpawnedPids().includes(child.pid!));
  });

  it('removes process from tracked list on exit', async () => {
    const child = manager.spawn({
      cwd: '/tmp',
      command: 'echo',
      args: ['hello'],
    });

    const pid = child.pid!;
    await new Promise<void>((resolve) => child.on('exit', () => resolve()));
    assert.ok(!manager.getSpawnedPids().includes(pid));
  });

  it('validates PID belongs to a claude process', () => {
    const result = manager.validatePid(process.pid);
    assert.strictEqual(result, false);
  });
});
