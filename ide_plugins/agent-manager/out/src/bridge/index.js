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
exports.AgentDiscovery = exports.StreamReader = exports.WorktreeFinder = exports.ProcessManager = exports.SessionStore = exports.ClaudeCodeBridge = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const sessionStore_1 = require("./sessionStore");
const processManager_1 = require("./processManager");
const worktreeFinder_1 = require("./worktreeFinder");
const streamReader_1 = require("./streamReader");
const agentDiscovery_1 = require("./agentDiscovery");
class ClaudeCodeBridge {
    sessionStore;
    processManager;
    worktreeFinder;
    streamReaders = new Map();
    constructor(workspaceFolders) {
        const homeDir = os.homedir();
        const sessionsDir = path.join(homeDir, '.claude', 'sessions');
        const projectsDir = path.join(homeDir, '.claude', 'projects');
        this.sessionStore = new sessionStore_1.SessionStore(sessionsDir, projectsDir);
        this.processManager = new processManager_1.ProcessManager();
        this.worktreeFinder = new worktreeFinder_1.WorktreeFinder(workspaceFolders);
    }
    async init(manualDirs = []) {
        await this.sessionStore.init();
        await this.worktreeFinder.init(manualDirs);
    }
    discoverAgents(projectDir) {
        return agentDiscovery_1.AgentDiscovery.discoverAll(projectDir, os.homedir());
    }
    getStreamReader(filePath, options) {
        const existing = this.streamReaders.get(filePath);
        if (existing)
            return existing;
        const reader = new streamReader_1.StreamReader(filePath, {
            startFromEnd: options?.startFromEnd,
        });
        this.streamReaders.set(filePath, reader);
        return reader;
    }
    removeStreamReader(filePath) {
        const reader = this.streamReaders.get(filePath);
        if (reader) {
            reader.stop();
            this.streamReaders.delete(filePath);
        }
    }
    dispose() {
        this.sessionStore.dispose();
        this.processManager.dispose();
        this.worktreeFinder.dispose();
        for (const [, reader] of this.streamReaders) {
            reader.stop();
        }
        this.streamReaders.clear();
    }
}
exports.ClaudeCodeBridge = ClaudeCodeBridge;
var sessionStore_2 = require("./sessionStore");
Object.defineProperty(exports, "SessionStore", { enumerable: true, get: function () { return sessionStore_2.SessionStore; } });
var processManager_2 = require("./processManager");
Object.defineProperty(exports, "ProcessManager", { enumerable: true, get: function () { return processManager_2.ProcessManager; } });
var worktreeFinder_2 = require("./worktreeFinder");
Object.defineProperty(exports, "WorktreeFinder", { enumerable: true, get: function () { return worktreeFinder_2.WorktreeFinder; } });
var streamReader_2 = require("./streamReader");
Object.defineProperty(exports, "StreamReader", { enumerable: true, get: function () { return streamReader_2.StreamReader; } });
var agentDiscovery_2 = require("./agentDiscovery");
Object.defineProperty(exports, "AgentDiscovery", { enumerable: true, get: function () { return agentDiscovery_2.AgentDiscovery; } });
//# sourceMappingURL=index.js.map