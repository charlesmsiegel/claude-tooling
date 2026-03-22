import React, { useState, useEffect } from "react";
import { FormField } from "../components/FormField";
import { ScopeBadge } from "../components/ScopeBadge";
import { LinkableItems } from "../components/LinkableItems";
import { useExtensionState } from "../hooks/useExtensionState";

interface ClaudeMdSection {
  heading: string;
  content: string;
}

interface ClaudeMdConfig {
  id: string;
  name: string;
  type: "claudeMd";
  scope: { type: "global" | "project"; label: string; path: string };
  filePath: string;
  sections?: ClaudeMdSection[];
}

const buttonStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "12px",
  background: "var(--vscode-button-secondaryBackground)",
  color: "var(--vscode-button-secondaryForeground)",
  border: "none",
  borderRadius: "2px",
  cursor: "pointer",
};

export const ClaudeMdEditor: React.FC = () => {
  const { data, connections, allObjects, save, connect, disconnect } = useExtensionState<ClaudeMdConfig>();
  const [form, setForm] = useState<Partial<ClaudeMdConfig>>({});

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  if (!form.id) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  const handleChange = (updated: Partial<ClaudeMdConfig>) => {
    const next = { ...form, ...updated };
    setForm(next);
    save(next as ClaudeMdConfig);
  };

  const sections = form.sections || [];

  const updateSection = (index: number, field: keyof ClaudeMdSection, value: string) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    handleChange({ sections: updated });
  };

  const addSection = () => {
    handleChange({ sections: [...sections, { heading: "", content: "" }] });
  };

  const removeSection = (index: number) => {
    handleChange({ sections: sections.filter((_, i) => i !== index) });
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
        <h2 style={{ margin: 0, fontSize: "18px" }}>CLAUDE.md: {form.name}</h2>
        <ScopeBadge label={form.scope!.label} type={form.scope!.type} />
      </div>

      {sections.map((section, index) => (
        <div key={index} style={{ marginBottom: "16px", padding: "12px", border: "1px solid var(--vscode-panel-border)", borderRadius: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Section {index + 1}</span>
            <button onClick={() => removeSection(index)} style={buttonStyle}>
              Remove
            </button>
          </div>
          <FormField label="Heading" fieldType="text" value={section.heading} onChange={(v) => updateSection(index, "heading", v)} />
          <FormField label="Content" fieldType="textarea" value={section.content} onChange={(v) => updateSection(index, "content", v)} />
        </div>
      ))}

      <button onClick={addSection} style={{ ...buttonStyle, marginBottom: "16px" }}>
        + Add Section
      </button>

      <LinkableItems title="Agents" availableItems={availableAgents} linkedItems={linkedAgents} onLink={handleLink} onUnlink={handleUnlink} />
    </div>
  );
};
