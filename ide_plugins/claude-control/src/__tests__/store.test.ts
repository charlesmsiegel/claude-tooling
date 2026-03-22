import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../model/store";
import { SkillConfig, AgentConfig, Scope } from "../model/types";

const globalScope: Scope = { type: "global", label: "Global", path: "/home/user/.claude" };

function makeSkill(name: string): SkillConfig {
  return {
    id: `global:skill:${name}`,
    name,
    scope: globalScope,
    filePath: `/home/user/.claude/skills/${name}.md`,
    type: "skill",
    content: "test",
  };
}

function makeAgent(name: string): AgentConfig {
  return {
    id: `global:agent:${name}`,
    name,
    scope: globalScope,
    filePath: `/home/user/.claude/agents/${name}.yml`,
    type: "agent",
  };
}

describe("Store", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it("adds and retrieves objects", () => {
    const skill = makeSkill("tdd");
    store.set(skill);
    expect(store.get("global:skill:tdd")).toEqual(skill);
  });

  it("lists objects by type", () => {
    store.set(makeSkill("tdd"));
    store.set(makeSkill("debug"));
    store.set(makeAgent("dev"));
    expect(store.listByType("skill")).toHaveLength(2);
    expect(store.listByType("agent")).toHaveLength(1);
  });

  it("deletes objects", () => {
    store.set(makeSkill("tdd"));
    store.delete("global:skill:tdd");
    expect(store.get("global:skill:tdd")).toBeUndefined();
  });

  it("manages connections", () => {
    store.set(makeSkill("tdd"));
    store.set(makeAgent("dev"));
    store.connect("global:agent:dev", "agent", "global:skill:tdd", "skill");
    const conns = store.getConnections();
    expect(conns).toHaveLength(1);
    expect(conns[0].sourceId).toBe("global:agent:dev");
    expect(conns[0].targetId).toBe("global:skill:tdd");
  });

  it("removes connections", () => {
    store.set(makeSkill("tdd"));
    store.set(makeAgent("dev"));
    store.connect("global:agent:dev", "agent", "global:skill:tdd", "skill");
    const conn = store.getConnections()[0];
    store.disconnect(conn.id);
    expect(store.getConnections()).toHaveLength(0);
  });

  it("gets connections for a specific object", () => {
    store.set(makeSkill("tdd"));
    store.set(makeSkill("debug"));
    store.set(makeAgent("dev"));
    store.connect("global:agent:dev", "agent", "global:skill:tdd", "skill");
    store.connect("global:agent:dev", "agent", "global:skill:debug", "skill");
    expect(store.getConnectionsFor("global:agent:dev")).toHaveLength(2);
    expect(store.getConnectionsFor("global:skill:tdd")).toHaveLength(1);
  });
});
