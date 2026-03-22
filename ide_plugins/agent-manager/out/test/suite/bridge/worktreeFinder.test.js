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
const worktreeFinder_1 = require("../../../src/bridge/worktreeFinder");
describe('WorktreeFinder', () => {
    let tmpDir;
    let finder;
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
        const result = worktreeFinder_1.WorktreeFinder.parseWorktreeOutput(output, '/home/user/myproject');
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
        const result = worktreeFinder_1.WorktreeFinder.mergeDirectories(discovered, manual);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[1].path, '/home/user/other-dir');
        assert.strictEqual(result[1].branch, 'unknown');
    });
});
//# sourceMappingURL=worktreeFinder.test.js.map