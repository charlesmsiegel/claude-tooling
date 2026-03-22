import React, { useState, useEffect } from "react";
import { FormField } from "../components/FormField";
import { ScopeBadge } from "../components/ScopeBadge";
import { LinkableItems } from "../components/LinkableItems";
import { useExtensionState } from "../hooks/useExtensionState";

interface McpServerConfig {
  id: string;
  name: string;
  type: "mcpServer";
  scope: { type: "global" | "project"; label: string; path: string };
  filePath: string;
  transportType?: string;
  command?: string;
  url?: string;
  args?: string[];
  envVars?: Record<string, string>;
  enabled?: boolean;
}

const TRANSPORT_TYPE_OPTIONS = [
  { label: "stdio", value: "stdio" },
  { label: "SSE", value: "sse" },
];

export const McpServerEditor: React.FC = () => {
  const { data, connections, allObjects, save, connect, disconnect } = useExtensionState<McpServerConfig>();
  const [form, setForm] = useState<Partial<McpServerConfig>>({});

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  if (!form.id) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  const handleChange = (field: keyof McpServerConfig, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    save(updated as McpServerConfig);
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
        <h2 style={{ margin: 0, fontSize: "18px" }}>MCP Server: {form.name}</h2>
        <ScopeBadge label={form.scope!.label} type={form.scope!.type} />
      </div>

      <FormField label="Name" fieldType="text" value={form.name} onChange={(v) => handleChange("name", v)} />
      <FormField label="Transport Type" fieldType="dropdown" value={form.transportType} onChange={(v) => handleChange("transportType", v)} options={TRANSPORT_TYPE_OPTIONS} />
      {form.transportType === "stdio" && (
        <FormField label="Command" fieldType="text" value={form.command} onChange={(v) => handleChange("command", v)} placeholder="e.g., npx -y @modelcontextprotocol/server" />
      )}
      {form.transportType === "sse" && (
        <FormField label="URL" fieldType="text" value={form.url} onChange={(v) => handleChange("url", v)} placeholder="e.g., http://localhost:3000/sse" />
      )}
      <FormField label="Args" fieldType="list" value={form.args} onChange={(v) => handleChange("args", v)} placeholder="Argument" />
      <FormField label="Environment Variables" fieldType="keyvalue" value={form.envVars} onChange={(v) => handleChange("envVars", v)} />
      <FormField label="Enabled" fieldType="toggle" value={form.enabled} onChange={(v) => handleChange("enabled", v)} />

      <LinkableItems title="Agents" availableItems={availableAgents} linkedItems={linkedAgents} onLink={handleLink} onUnlink={handleUnlink} />
    </div>
  );
};
