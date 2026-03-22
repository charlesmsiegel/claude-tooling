import React, { useState, useEffect } from "react";
import { FormField } from "../components/FormField";
import { ScopeBadge } from "../components/ScopeBadge";
import { LinkableItems } from "../components/LinkableItems";
import { useExtensionState } from "../hooks/useExtensionState";

interface SkillConfig {
  id: string;
  name: string;
  type: "skill";
  scope: { type: "global" | "project"; label: string; path: string };
  filePath: string;
  description?: string;
  triggerConditions?: string;
  skillType?: string;
  content?: string;
}

const SKILL_TYPE_OPTIONS = [
  { label: "Rigid", value: "rigid" },
  { label: "Flexible", value: "flexible" },
];

export const SkillEditor: React.FC = () => {
  const { data, connections, allObjects, save, connect, disconnect } = useExtensionState<SkillConfig>();
  const [form, setForm] = useState<Partial<SkillConfig>>({});

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  if (!form.id) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  const handleChange = (field: keyof SkillConfig, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    save(updated as SkillConfig);
  };

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

  // Linkable: Commands
  const availableCommands = (allObjects["command"] || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    type: "command",
    scopeLabel: c.scope.label,
  }));
  const linkedCommandIds = connections
    .filter((c: any) => c.sourceId === form.id && c.targetType === "command")
    .map((c: any) => c.targetId);
  const linkedCommands = availableCommands.filter((c) => linkedCommandIds.includes(c.id));

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
        <h2 style={{ margin: 0, fontSize: "18px" }}>Skill: {form.name}</h2>
        <ScopeBadge label={form.scope!.label} type={form.scope!.type} />
      </div>

      <FormField label="Name" fieldType="text" value={form.name} onChange={(v) => handleChange("name", v)} />
      <FormField label="Description" fieldType="text" value={form.description} onChange={(v) => handleChange("description", v)} />
      <FormField label="Trigger Conditions" fieldType="text" value={form.triggerConditions} onChange={(v) => handleChange("triggerConditions", v)} />
      <FormField label="Skill Type" fieldType="dropdown" value={form.skillType} onChange={(v) => handleChange("skillType", v)} options={SKILL_TYPE_OPTIONS} />
      <FormField label="Content" fieldType="textarea" value={form.content} onChange={(v) => handleChange("content", v)} placeholder="Skill content..." />

      <LinkableItems title="Agents" availableItems={availableAgents} linkedItems={linkedAgents} onLink={handleLink} onUnlink={handleUnlink} />
      <LinkableItems title="Commands" availableItems={availableCommands} linkedItems={linkedCommands} onLink={handleLink} onUnlink={handleUnlink} />
    </div>
  );
};
