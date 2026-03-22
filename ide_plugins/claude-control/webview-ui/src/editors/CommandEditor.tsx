import React, { useState, useEffect } from "react";
import { FormField } from "../components/FormField";
import { ScopeBadge } from "../components/ScopeBadge";
import { LinkableItems } from "../components/LinkableItems";
import { useExtensionState } from "../hooks/useExtensionState";

interface CommandConfig {
  id: string;
  name: string;
  type: "command";
  scope: { type: "global" | "project"; label: string; path: string };
  filePath: string;
  description?: string;
  template?: string;
  arguments?: string;
}

export const CommandEditor: React.FC = () => {
  const { data, connections, allObjects, save, connect, disconnect } = useExtensionState<CommandConfig>();
  const [form, setForm] = useState<Partial<CommandConfig>>({});

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  if (!form.id) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  const handleChange = (field: keyof CommandConfig, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    save(updated as CommandConfig);
  };

  // Linkable: Skills
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

  // Linkable: Agents
  const availableAgents = (allObjects["agent"] || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    type: "agent",
    scopeLabel: a.scope.label,
  }));
  const linkedAgentIds = connections
    .filter((c: any) => c.sourceId === form.id && c.targetType === "agent")
    .map((c: any) => c.targetId);
  const linkedAgents = availableAgents.filter((a) => linkedAgentIds.includes(a.id));

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
        <h2 style={{ margin: 0, fontSize: "18px" }}>Command: {form.name}</h2>
        <ScopeBadge label={form.scope!.label} type={form.scope!.type} />
      </div>

      <FormField label="Name" fieldType="text" value={form.name} onChange={(v) => handleChange("name", v)} />
      <FormField label="Description" fieldType="text" value={form.description} onChange={(v) => handleChange("description", v)} />
      <FormField label="Template" fieldType="textarea" value={form.template} onChange={(v) => handleChange("template", v)} placeholder="Command template..." />
      <FormField label="Arguments" fieldType="text" value={form.arguments} onChange={(v) => handleChange("arguments", v)} placeholder="e.g., $PROMPT" />

      <LinkableItems title="Skills" availableItems={availableSkills} linkedItems={linkedSkills} onLink={handleLink} onUnlink={handleUnlink} />
      <LinkableItems title="Agents" availableItems={availableAgents} linkedItems={linkedAgents} onLink={handleLink} onUnlink={handleUnlink} />
    </div>
  );
};
