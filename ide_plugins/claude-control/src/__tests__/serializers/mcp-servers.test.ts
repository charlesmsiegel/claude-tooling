import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { McpServersSerializer } from "../../model/serializers/mcp-servers";
import { Scope } from "../../model/types";

describe("McpServersSerializer", () => {
  let tmpDir: string;
  let scope: Scope;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
    scope = { type: "global", label: "Global", path: tmpDir };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("reads mcp.json", () => {
    const mcpPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(mcpPath, JSON.stringify({
      mcpServers: {
        github: {
          type: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: { GITHUB_TOKEN: "abc" }
        },
        remote: {
          type: "sse",
          url: "http://localhost:3000/sse"
        }
      }
    }));

    const results = McpServersSerializer.readAll(mcpPath, scope);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("github");
    expect(results[0].transportType).toBe("stdio");
    expect(results[0].command).toBe("npx");
    expect(results[0].args).toEqual(["-y", "@modelcontextprotocol/server-github"]);
    expect(results[1].name).toBe("remote");
    expect(results[1].transportType).toBe("sse");
    expect(results[1].url).toBe("http://localhost:3000/sse");
  });

  it("writes a new server to mcp.json", () => {
    const mcpPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers: {} }));

    McpServersSerializer.write({
      id: "global:Global:mcpServer:test",
      name: "test",
      type: "mcpServer",
      scope,
      filePath: mcpPath,
      transportType: "stdio",
      command: "node",
      args: ["server.js"],
      env: {},
      enabled: true,
    });

    const written = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    expect(written.mcpServers.test).toBeDefined();
    expect(written.mcpServers.test.command).toBe("node");
  });

  it("removes a server from mcp.json", () => {
    const mcpPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(mcpPath, JSON.stringify({
      mcpServers: { a: { type: "stdio", command: "a" }, b: { type: "stdio", command: "b" } }
    }));

    McpServersSerializer.remove("a", mcpPath);
    const written = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    expect(written.mcpServers.a).toBeUndefined();
    expect(written.mcpServers.b).toBeDefined();
  });
});
