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
const processManager_1 = require("../../../src/bridge/processManager");
describe('ProcessManager', () => {
    let manager;
    beforeEach(() => {
        manager = new processManager_1.ProcessManager();
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
        assert.ok(manager.getSpawnedPids().includes(child.pid));
    });
    it('removes process from tracked list on exit', async () => {
        const child = manager.spawn({
            cwd: '/tmp',
            command: 'echo',
            args: ['hello'],
        });
        const pid = child.pid;
        await new Promise((resolve) => child.on('exit', () => resolve()));
        assert.ok(!manager.getSpawnedPids().includes(pid));
    });
    it('validates PID belongs to a claude process', () => {
        const result = manager.validatePid(process.pid);
        assert.strictEqual(result, false);
    });
});
//# sourceMappingURL=processManager.test.js.map