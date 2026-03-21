import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentDiscovery } from '../../../src/bridge/agentDiscovery';

describe('AgentDiscovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-disc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses agent definitions from .md files with YAML frontmatter', () => {
    const agentsDir = path.join(tmpDir, '.claude', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'file-reader.md'),
      '---\nname: file-reader\nmodel: haiku\ndescription: File analysis specialist\n---\nYou are a file reader.'
    );

    const agents = AgentDiscovery.scanAgentDir(agentsDir, 'project');
    assert.strictEqual(agents.length, 1);
    assert.strictEqual(agents[0].name, 'file-reader');
    assert.strictEqual(agents[0].model, 'haiku');
    assert.strictEqual(agents[0].source, 'project');
  });

  it('parses claude agents CLI output', () => {
    const output = [
      '8 active agents',
      '',
      'Plugin agents:',
      '  superpowers:code-reviewer · inherit',
      '',
      'Built-in agents:',
      '  Explore · haiku',
      '  Plan · inherit',
    ].join('\n');

    const agents = AgentDiscovery.parseCLIOutput(output);
    assert.strictEqual(agents.length, 3);
    assert.strictEqual(agents[0].name, 'superpowers:code-reviewer');
    assert.strictEqual(agents[0].source, 'plugin');
    assert.strictEqual(agents[1].name, 'Explore');
    assert.strictEqual(agents[1].source, 'builtin');
  });

  it('handles missing agents directory gracefully', () => {
    const agents = AgentDiscovery.scanAgentDir('/nonexistent/path', 'project');
    assert.strictEqual(agents.length, 0);
  });
});
