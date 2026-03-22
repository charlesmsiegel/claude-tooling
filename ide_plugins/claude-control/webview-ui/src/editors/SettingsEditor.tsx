import React, { useState, useEffect } from "react";
import { FormField } from "../components/FormField";
import { ScopeBadge } from "../components/ScopeBadge";
import { LinkableItems } from "../components/LinkableItems";
import { useExtensionState } from "../hooks/useExtensionState";

interface SettingsConfig {
  id: string;
  name: string;
  type: "settings";
  scope: { type: "global" | "project"; label: string; path: string };
  filePath: string;
  model?: string;
  customInstructions?: string;
  permissions?: Record<string, string>;
}

const MODEL_OPTIONS = [
  { label: "Claude Opus 4.6", value: "claude-opus-4-6" },
  { label: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" },
  { label: "Claude Haiku 4.5", value: "claude-haiku-4-5-20251001" },
];

export const SettingsEditor: React.FC = () => {
  const { data, connections, allObjects, save, connect, disconnect } = useExtensionState<SettingsConfig>();
  const [form, setForm] = useState<Partial<SettingsConfig>>({});

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  if (!form.id) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  const handleChange = (field: keyof SettingsConfig, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    save(updated as SettingsConfig);
  };

  // Linkable: Hooks
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
        <h2 style={{ margin: 0, fontSize: "18px" }}>Settings: {form.name}</h2>
        <ScopeBadge label={form.scope!.label} type={form.scope!.type} />
      </div>

      <FormField label="Model" fieldType="dropdown" value={form.model} onChange={(v) => handleChange("model", v)} options={MODEL_OPTIONS} />
      <FormField label="Custom Instructions" fieldType="textarea" value={form.customInstructions} onChange={(v) => handleChange("customInstructions", v)} placeholder="Custom instructions for Claude..." />
      <FormField label="Permissions" fieldType="keyvalue" value={form.permissions} onChange={(v) => handleChange("permissions", v)} />

      <LinkableItems title="Hooks" availableItems={availableHooks} linkedItems={linkedHooks} onLink={handleLink} onUnlink={handleUnlink} />
    </div>
  );
};
