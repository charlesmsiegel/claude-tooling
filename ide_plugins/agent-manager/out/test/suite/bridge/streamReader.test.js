"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const streamReader_1 = require("../../../src/bridge/streamReader");
describe('StreamReader', () => {
    let tmpDir;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-test-'));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it('emits data events for existing lines in a JSONL file', async () => {
        const filePath = path.join(tmpDir, 'test.jsonl');
        fs.writeFileSync(filePath, '{"type":"assistant","message":"hello"}\n{"type":"tool","name":"Read"}\n');
        const reader = new streamReader_1.StreamReader(filePath, { pollInterval: 100 });
        const lines = [];
        reader.on('data', (line) => lines.push(line));
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
        const reader = new streamReader_1.StreamReader(filePath, { pollInterval: 100 });
        const lines = [];
        reader.on('data', (line) => lines.push(line));
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
        const reader = new streamReader_1.StreamReader(filePath, { pollInterval: 100 });
        const lines = [];
        reader.on('data', (line) => lines.push(line));
        reader.start();
        await new Promise((resolve) => setTimeout(resolve, 300));
        reader.stop();
        assert.strictEqual(lines.length, 1);
        assert.strictEqual(lines[0].type, 'good');
    });
});
//# sourceMappingURL=streamReader.test.js.map