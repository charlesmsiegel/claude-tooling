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
exports.AgentDiscovery = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class AgentDiscovery {
    static scanAgentDir(dirPath, source) {
        const agents = [];
        try {
            const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'));
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const parsed = AgentDiscovery.parseFrontmatter(content);
                if (parsed) {
                    agents.push({
                        name: parsed.name ?? path.basename(file, '.md'),
                        model: parsed.model ?? 'inherit',
                        description: parsed.description ?? '',
                        source,
                        filePath,
                    });
                }
            }
        }
        catch {
            // directory doesn't exist
        }
        return agents;
    }
    static parseFrontmatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match)
            return null;
        const fields = {};
        const lines = match[1].split('\n');
        for (const line of lines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1)
                continue;
            const key = line.substring(0, colonIdx).trim();
            const value = line.substring(colonIdx + 1).trim();
            fields[key] = value;
        }
        return fields;
    }
    static parseCLIOutput(output) {
        const agents = [];
        let currentSource = 'builtin';
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.startsWith('Plugin agents:')) {
                currentSource = 'plugin';
                continue;
            }
            if (line.startsWith('Built-in agents:')) {
                currentSource = 'builtin';
                continue;
            }
            const agentMatch = line.match(/^\s+(.+?)\s+·\s+(.+)$/);
            if (agentMatch) {
                agents.push({
                    name: agentMatch[1].trim(),
                    model: agentMatch[2].trim(),
                    description: '',
                    source: currentSource,
                });
            }
        }
        return agents;
    }
    static discoverAll(projectDir, homeDir) {
        const agents = [];
        const projectAgentsDir = path.join(projectDir, '.claude', 'agents');
        agents.push(...AgentDiscovery.scanAgentDir(projectAgentsDir, 'project'));
        const globalAgentsDir = path.join(homeDir, '.claude', 'agents');
        agents.push(...AgentDiscovery.scanAgentDir(globalAgentsDir, 'global'));
        try {
            const output = (0, child_process_1.execSync)('claude agents', {
                encoding: 'utf-8',
                timeout: 10000,
                cwd: projectDir,
            });
            agents.push(...AgentDiscovery.parseCLIOutput(output));
        }
        catch {
            // claude CLI not available
        }
        return agents;
    }
}
exports.AgentDiscovery = AgentDiscovery;
//# sourceMappingURL=agentDiscovery.js.map