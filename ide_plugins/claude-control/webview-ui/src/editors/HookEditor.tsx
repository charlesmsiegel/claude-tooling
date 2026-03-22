import React, { useState, useEffect } from "react";
import { FormField } from "../components/FormField";
import { ScopeBadge } from "../components/ScopeBadge";
import { LinkableItems } from "../components/LinkableItems";
import { useExtensionState } from "../hooks/useExtensionState";

interface HookConfig {
  id: string;
  name: string;
  type: "hook";
  scope: { type: "global" | "project"; label: string; path: string };
  filePath: string;
  eventType?: string;
  matcher?: string;
  command?: string;
  timeout?: number;
  enabled?: boolean;
}

const EVENT_TYPE_OPTIONS = [
  { label: "PreToolUse", value: "PreToolUse" },
  { label: "PostToolUse", value: "PostToolUse" },
  { label: "Notification", value: "Notification" },
  { label: "Stop", value: "Stop" },
];

export const HookEditor: React.FC = () => {
  const { data, connections, allObjects, save, connect, disconnect } = useExtensionState<HookConfig>();
  const [form, setForm] = useState<Partial<HookConfig>>({});

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  if (!form.id) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  const handleChange = (field: keyof HookConfig, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    save(updated as HookConfig);
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

  // Linkable: Settings
  const availableSettings = (allObjects["settings"] || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    type: "settings",
    scopeLabel: s.scope.label,
  }));
  const linkedSettingsIds = connections
    .filter((c: any) => c.sourceId === form.id && c.targetType === "settings")
    .map((c: any) => c.targetId);
  const linkedSettings = availableSettings.filter((s) => linkedSettingsIds.includes(s.id));

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
        <h2 style={{ margin: 0, fontSize: "18px" }}>Hook: {form.name}</h2>
        <ScopeBadge label={form.scope!.label} type={form.scope!.type} />
      </div>

      <FormField label="Event Type" fieldType="dropdown" value={form.eventType} onChange={(v) => handleChange("eventType", v)} options={EVENT_TYPE_OPTIONS} />
      <FormField label="Matcher" fieldType="text" value={form.matcher} onChange={(v) => handleChange("matcher", v)} placeholder="Pattern to match against..." />
      <FormField label="Command" fieldType="text" value={form.command} onChange={(v) => handleChange("command", v)} placeholder="Command to execute..." />
      <FormField label="Timeout" fieldType="number" value={form.timeout} onChange={(v) => handleChange("timeout", v)} placeholder="Timeout in ms" />
      <FormField label="Enabled" fieldType="toggle" value={form.enabled} onChange={(v) => handleChange("enabled", v)} />

      <LinkableItems title="Agents" availableItems={availableAgents} linkedItems={linkedAgents} onLink={handleLink} onUnlink={handleUnlink} />
      <LinkableItems title="Settings" availableItems={availableSettings} linkedItems={linkedSettings} onLink={handleLink} onUnlink={handleUnlink} />
    </div>
  );
};
