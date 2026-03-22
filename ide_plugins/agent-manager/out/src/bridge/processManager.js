"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessManager = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
class ProcessManager extends events_1.EventEmitter {
    spawned = new Map();
    spawn(options) {
        const child = (0, child_process_1.spawn)(options.command, options.args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (child.pid) {
            this.spawned.set(child.pid, child);
            child.on('exit', (code) => {
                if (child.pid) {
                    this.spawned.delete(child.pid);
                }
                this.emit('process-exit', child.pid, code);
            });
        }
        return child;
    }
    spawnClaude(options) {
        const args = [];
        if (options.sessionId) {
            // 'claude resume <id>' is a subcommand, not a flag
            args.unshift('resume');
            args.push(options.sessionId);
        }
        if (options.prompt) {
            args.push('-p', options.prompt);
            args.push('--output-format', 'stream-json');
        }
        if (options.agent) {
            args.push('--agent', options.agent);
        }
        return this.spawn({
            cwd: options.cwd,
            command: 'claude',
            args,
        });
    }
    getSpawnedPids() {
        return Array.from(this.spawned.keys());
    }
    getSpawnedProcess(pid) {
        return this.spawned.get(pid);
    }
    validatePid(pid) {
        try {
            process.kill(pid, 0);
            try {
                const cmdline = (0, child_process_1.execSync)(`ps -p ${pid} -o comm=`, {
                    encoding: 'utf-8',
                    timeout: 2000,
                }).trim();
                return cmdline.includes('claude');
            }
            catch {
                return false;
            }
        }
        catch {
            return false;
        }
    }
    async stop(pid) {
        const child = this.spawned.get(pid);
        if (child) {
            child.kill('SIGTERM');
            return true;
        }
        if (!this.validatePid(pid)) {
            return false;
        }
        try {
            process.kill(pid, 'SIGTERM');
            await new Promise((resolve) => {
                const check = setInterval(() => {
                    try {
                        process.kill(pid, 0);
                    }
                    catch {
                        clearInterval(check);
                        resolve();
                    }
                }, 500);
                setTimeout(() => {
                    clearInterval(check);
                    try {
                        process.kill(pid, 'SIGKILL');
                    }
                    catch {
                        // already dead
                    }
                    resolve();
                }, 5000);
            });
            return true;
        }
        catch {
            return false;
        }
    }
    async kill(pid) {
        const child = this.spawned.get(pid);
        if (child) {
            child.kill('SIGKILL');
            return true;
        }
        if (!this.validatePid(pid)) {
            return false;
        }
        try {
            process.kill(pid, 'SIGKILL');
            return true;
        }
        catch {
            return false;
        }
    }
    dispose() {
        for (const [, child] of this.spawned) {
            child.kill('SIGTERM');
        }
        this.spawned.clear();
        this.removeAllListeners();
    }
}
exports.ProcessManager = ProcessManager;
//# sourceMappingURL=processManager.js.map