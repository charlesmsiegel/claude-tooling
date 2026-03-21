import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AgentDefinition } from '../types';

export class AgentDiscovery {
  static scanAgentDir(dirPath: string, source: 'project' | 'global'): AgentDefinition[] {
    const agents: AgentDefinition[] = [];

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
    } catch {
      // directory doesn't exist
    }

    return agents;
  }

  static parseFrontmatter(content: string): Record<string, string> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const fields: Record<string, string> = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      fields[key] = value;
    }

    return fields;
  }

  static parseCLIOutput(output: string): AgentDefinition[] {
    const agents: AgentDefinition[] = [];
    let currentSource: 'plugin' | 'builtin' = 'builtin';

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

  static discoverAll(projectDir: string, homeDir: string): AgentDefinition[] {
    const agents: AgentDefinition[] = [];

    const projectAgentsDir = path.join(projectDir, '.claude', 'agents');
    agents.push(...AgentDiscovery.scanAgentDir(projectAgentsDir, 'project'));

    const globalAgentsDir = path.join(homeDir, '.claude', 'agents');
    agents.push(...AgentDiscovery.scanAgentDir(globalAgentsDir, 'global'));

    try {
      const output = execSync('claude agents', {
        encoding: 'utf-8',
        timeout: 10000,
        cwd: projectDir,
      });
      agents.push(...AgentDiscovery.parseCLIOutput(output));
    } catch {
      // claude CLI not available
    }

    return agents;
  }
}
