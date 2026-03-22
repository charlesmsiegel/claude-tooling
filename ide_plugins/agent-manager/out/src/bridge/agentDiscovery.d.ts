import { AgentDefinition } from '../types';
export declare class AgentDiscovery {
    static scanAgentDir(dirPath: string, source: 'project' | 'global'): AgentDefinition[];
    static parseFrontmatter(content: string): Record<string, string> | null;
    static parseCLIOutput(output: string): AgentDefinition[];
    static discoverAll(projectDir: string, homeDir: string): AgentDefinition[];
}
