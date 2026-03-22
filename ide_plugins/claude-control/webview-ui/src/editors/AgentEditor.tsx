import React, { useState, useEffect } from "react";
import { FormField } from "../components/FormField";
import { ScopeBadge } from "../components/ScopeBadge";
import { LinkableItems } from "../components/LinkableItems";
import { useExtensionState } from "../hooks/useExtensionState";

interface AgentConfig {
  id: string;
  name: string;
  type: "agent";
  scope: { type: "global" | "project"; label: string; path: string };
  filePath: string;
  model?: string;
  description?: string;
  color?: string;
  instructions?: string;
  permissions?: string[];
  skills?: string[];
  hooks?: string[];
  mcpServers?: string[];
  claudeMdFiles?: string[];
}

const MODEL_OPTIONS = [
  { label: "Claude Opus 4.6", value: "claude-opus-4-6" },
  { label: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" },
  { label: "Claude Haiku 4.5", value: "claude-haiku-4-5-20251001" },
  { label: "opus", value: "opus" },
  { label: "sonnet", value: "sonnet" },
  { label: "haiku", value: "haiku" },
];

const COLOR_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Red", value: "red" },
  { label: "Green", value: "green" },
  { label: "Blue", value: "blue" },
  { label: "Cyan", value: "cyan" },
  { label: "Yellow", value: "yellow" },
  { label: "Purple", value: "purple" },
  { label: "Orange", value: "orange" },
];

export const AgentEditor: React.FC = () => {
  const { data, connections, allObjects, save, connect, disconnect } = useExtensionState<AgentConfig>();
  const [form, setForm] = useState<Partial<AgentConfig>>({});

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  if (!form.id) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  const handleChange = (field: keyof AgentConfig, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    save(updated as AgentConfig);
  };

  // Prepare linkable items for skills
  const availableSkills = (allObjects["skill"] || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    type: "skill",
    scopeLabel: s.scope.label,
  }));

  const linkedSkillIds = connections
    .filter((c: any) => c.sourceId === form.id && c.targetType === "skill")
    .map((c: any) => c.targetId);
  const linkedSkills = availableSkills.filter((s) => linkedSkillIds.includes(s.id));

  // Same pattern for hooks, MCP servers, CLAUDE.md
  const availableHooks = (allObjects["hook"] || []).map((h: any) => ({
    id: h.id,
    name: h.name,
    type: "hook",
    scopeLabel: h.scope.label,
  }));
  const linkedHookIds = connections
    .filter((c: any) => c.sourceId === form.id && c.targetType === "hook")
    .map((c: any) => c.targetId);
  const linkedHooks = availableHooks.filter((h) => linkedHookIds.includes(h.id));

  const availableMcp = (allObjects["mcpServer"] || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    type: "mcpServer",
    scopeLabel: m.scope.label,
  }));
  const linkedMcpIds = connections
    .filter((c: any) => c.sourceId === form.id && c.targetType === "mcpServer")
    .map((c: any) => c.targetId);
  const linkedMcp = availableMcp.filter((m) => linkedMcpIds.includes(m.id));

  const availableClaudeMd = (allObjects["claudeMd"] || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    type: "claudeMd",
    scopeLabel: c.scope.label,
  }));
  const linkedClaudeMdIds = connections
    .filter((c: any) => c.sourceId === form.id && c.targetType === "claudeMd")
    .map((c: any) => c.targetId);
  const linkedClaudeMd = availableClaudeMd.filter((c) => linkedClaudeMdIds.includes(c.id));

  const handleLink = (targetId: string) => connect(form.id!, targetId);
  const handleUnlink = (targetId: string) => {
    const conn = connections.find(
      (c: any) => c.sourceId === form.id && c.targetId === targetId
    );
    if (conn) disconnect(conn.id);
  };

  return (
    <div style={{ padding: "16px", maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "18px" }}>Agent: {form.name}</h2>
        <ScopeBadge label={form.scope!.label} type={form.scope!.type} />
      </div>

      <FormField label="Name" fieldType="text" value={form.name} onChange={(v) => handleChange("name", v)} />
      <FormField label="Description" fieldType="text" value={form.description} onChange={(v) => handleChange("description", v)} placeholder="Brief description of the agent's role" />
      <FormField label="Model" fieldType="dropdown" value={form.model} onChange={(v) => handleChange("model", v)} options={MODEL_OPTIONS} />
      <FormField label="Color" fieldType="dropdown" value={form.color} onChange={(v) => handleChange("color", v)} options={COLOR_OPTIONS} />
      <FormField label="Instructions" fieldType="textarea" value={form.instructions} onChange={(v) => handleChange("instructions", v)} placeholder="System instructions for this agent (markdown)..." />
      <FormField label="Permissions" fieldType="list" value={form.permissions} onChange={(v) => handleChange("permissions", v)} placeholder="e.g., Read, Write, Bash" />

      <LinkableItems title="Skills" availableItems={availableSkills} linkedItems={linkedSkills} onLink={handleLink} onUnlink={handleUnlink} />
      <LinkableItems title="Hooks" availableItems={availableHooks} linkedItems={linkedHooks} onLink={handleLink} onUnlink={handleUnlink} />
      <LinkableItems title="MCP Servers" availableItems={availableMcp} linkedItems={linkedMcp} onLink={handleLink} onUnlink={handleUnlink} />
      <LinkableItems title="CLAUDE.md Files" availableItems={availableClaudeMd} linkedItems={linkedClaudeMd} onLink={handleLink} onUnlink={handleUnlink} />
    </div>
  );
};
