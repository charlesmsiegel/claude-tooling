import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { StreamReader } from '../../../src/bridge/streamReader';

describe('StreamReader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits data events for existing lines in a JSONL file', async () => {
    const filePath = path.join(tmpDir, 'test.jsonl');
    fs.writeFileSync(filePath, '{"type":"assistant","message":"hello"}\n{"type":"tool","name":"Read"}\n');

    const reader = new StreamReader(filePath, { pollInterval: 100 });
    const lines: any[] = [];

    reader.on('data', (line: any) => lines.push(line));
    reader.start();

    await new Promise((resolve) => setTimeout(resolve, 300));
    reader.stop();

    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[0].type, 'assistant');
    assert.strictEqual(lines[1].type, 'tool');
  });

  it('detects new lines appended to file', async () => {
    const filePath = path.join(tmpDir, 'growing.jsonl');
    fs.writeFileSync(filePath, '');

    const reader = new StreamReader(filePath, { pollInterval: 100 });
    const lines: any[] = [];

    reader.on('data', (line: any) => lines.push(line));
    reader.start();

    await new Promise((resolve) => setTimeout(resolve, 150));
    fs.appendFileSync(filePath, '{"type":"new","data":"appended"}\n');
    await new Promise((resolve) => setTimeout(resolve, 300));

    reader.stop();

    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].type, 'new');
  });

  it('handles malformed JSON lines gracefully', async () => {
    const filePath = path.join(tmpDir, 'bad.jsonl');
    fs.writeFileSync(filePath, 'not json\n{"type":"good"}\n');

    const reader = new StreamReader(filePath, { pollInterval: 100 });
    const lines: any[] = [];

    reader.on('data', (line: any) => lines.push(line));
    reader.start();

    await new Promise((resolve) => setTimeout(resolve, 300));
    reader.stop();

    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].type, 'good');
  });
});
