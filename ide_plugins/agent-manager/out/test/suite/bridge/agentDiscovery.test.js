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
const agentDiscovery_1 = require("../../../src/bridge/agentDiscovery");
describe('AgentDiscovery', () => {
    let tmpDir;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-disc-test-'));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it('parses agent definitions from .md files with YAML frontmatter', () => {
        const agentsDir = path.join(tmpDir, '.claude', 'agents');
        fs.mkdirSync(agentsDir, { recursive: true });
        fs.writeFileSync(path.join(agentsDir, 'file-reader.md'), '---\nname: file-reader\nmodel: haiku\ndescription: File analysis specialist\n---\nYou are a file reader.');
        const agents = agentDiscovery_1.AgentDiscovery.scanAgentDir(agentsDir, 'project');
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
        const agents = agentDiscovery_1.AgentDiscovery.parseCLIOutput(output);
        assert.strictEqual(agents.length, 3);
        assert.strictEqual(agents[0].name, 'superpowers:code-reviewer');
        assert.strictEqual(agents[0].source, 'plugin');
        assert.strictEqual(agents[1].name, 'Explore');
        assert.strictEqual(agents[1].source, 'builtin');
    });
    it('handles missing agents directory gracefully', () => {
        const agents = agentDiscovery_1.AgentDiscovery.scanAgentDir('/nonexistent/path', 'project');
        assert.strictEqual(agents.length, 0);
    });
});
//# sourceMappingURL=agentDiscovery.test.js.map