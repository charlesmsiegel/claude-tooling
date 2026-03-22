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
exports.WorktreeFinder = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class WorktreeFinder extends events_1.EventEmitter {
    workspaceFolders;
    directories = new Map();
    watchers = [];
    manualDirs = [];
    constructor(workspaceFolders) {
        super();
        this.workspaceFolders = workspaceFolders;
    }
    async init(manualDirs = []) {
        this.manualDirs = manualDirs;
        await this.discoverAll();
        this.watchWorktreeDirs();
    }
    getDirectories() {
        return Array.from(this.directories.values());
    }
    addManualDirectory(dirPath) {
        if (this.directories.has(dirPath))
            return;
        const dir = {
            path: dirPath,
            branch: this.detectBranch(dirPath),
            isWorktree: this.isWorktree(dirPath),
            repoRoot: this.findRepoRoot(dirPath) ?? dirPath,
        };
        this.directories.set(dirPath, dir);
        this.manualDirs.push(dirPath);
        this.emit('directories-changed', this.getDirectories());
    }
    removeManualDirectory(dirPath) {
        this.directories.delete(dirPath);
        this.manualDirs = this.manualDirs.filter((d) => d !== dirPath);
        this.emit('directories-changed', this.getDirectories());
    }
    dispose() {
        for (const w of this.watchers) {
            w.close();
        }
        this.watchers = [];
        this.removeAllListeners();
    }
    static parseWorktreeOutput(output, repoRoot) {
        const dirs = [];
        const blocks = output.trim().split('\n\n');
        for (const block of blocks) {
            if (!block.trim())
                continue;
            const lines = block.split('\n');
            let wtPath = '';
            let branch = 'detached';
            for (const line of lines) {
                if (line.startsWith('worktree ')) {
                    wtPath = line.substring('worktree '.length);
                }
                else if (line.startsWith('branch refs/heads/')) {
                    branch = line.substring('branch refs/heads/'.length);
                }
            }
            if (wtPath) {
                dirs.push({
                    path: wtPath,
                    branch,
                    isWorktree: wtPath !== repoRoot,
                    repoRoot,
                });
            }
        }
        return dirs;
    }
    static mergeDirectories(discovered, manualPaths) {
        const merged = [...discovered];
        const existingPaths = new Set(discovered.map((d) => d.path));
        for (const mp of manualPaths) {
            if (!existingPaths.has(mp)) {
                merged.push({
                    path: mp,
                    branch: 'unknown',
                    isWorktree: false,
                    repoRoot: mp,
                });
            }
        }
        return merged;
    }
    async discoverAll() {
        this.directories.clear();
        for (const folder of this.workspaceFolders) {
            const repoRoot = this.findRepoRoot(folder);
            if (!repoRoot)
                continue;
            try {
                const output = (0, child_process_1.execSync)('git worktree list --porcelain', {
                    cwd: repoRoot,
                    encoding: 'utf-8',
                    timeout: 5000,
                });
                const worktrees = WorktreeFinder.parseWorktreeOutput(output, repoRoot);
                for (const wt of worktrees) {
                    this.directories.set(wt.path, wt);
                }
            }
            catch {
                this.directories.set(folder, {
                    path: folder,
                    branch: 'unknown',
                    isWorktree: false,
                    repoRoot: folder,
                });
            }
        }
        for (const mp of this.manualDirs) {
            if (!this.directories.has(mp)) {
                this.directories.set(mp, {
                    path: mp,
                    branch: this.detectBranch(mp),
                    isWorktree: this.isWorktree(mp),
                    repoRoot: this.findRepoRoot(mp) ?? mp,
                });
            }
        }
    }
    watchWorktreeDirs() {
        for (const folder of this.workspaceFolders) {
            const repoRoot = this.findRepoRoot(folder);
            if (!repoRoot)
                continue;
            const worktreesDir = path.join(repoRoot, '.git', 'worktrees');
            if (!fs.existsSync(worktreesDir))
                continue;
            try {
                const watcher = fs.watch(worktreesDir, async () => {
                    await this.discoverAll();
                    this.emit('directories-changed', this.getDirectories());
                });
                this.watchers.push(watcher);
            }
            catch {
                // watch failed
            }
        }
    }
    findRepoRoot(dirPath) {
        try {
            return (0, child_process_1.execSync)('git rev-parse --show-toplevel', {
                cwd: dirPath,
                encoding: 'utf-8',
                timeout: 5000,
            }).trim();
        }
        catch {
            return undefined;
        }
    }
    detectBranch(dirPath) {
        try {
            return (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', {
                cwd: dirPath,
                encoding: 'utf-8',
                timeout: 5000,
            }).trim();
        }
        catch {
            return 'unknown';
        }
    }
    isWorktree(dirPath) {
        const gitPath = path.join(dirPath, '.git');
        try {
            return fs.statSync(gitPath).isFile();
        }
        catch {
            return false;
        }
    }
}
exports.WorktreeFinder = WorktreeFinder;
//# sourceMappingURL=worktreeFinder.js.map