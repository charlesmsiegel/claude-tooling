import React, { useState, useEffect } from "react";
import { FormField } from "../components/FormField";
import { ScopeBadge } from "../components/ScopeBadge";
import { useExtensionState } from "../hooks/useExtensionState";

interface MemoryConfig {
  id: string;
  name: string;
  type: "memory";
  scope: { type: "global" | "project"; label: string; path: string };
  filePath: string;
  topic?: string;
  content?: string;
}

export const MemoryEditor: React.FC = () => {
  const { data, save } = useExtensionState<MemoryConfig>();
  const [form, setForm] = useState<Partial<MemoryConfig>>({});

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  if (!form.id) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  const handleChange = (field: keyof MemoryConfig, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    save(updated as MemoryConfig);
  };

  return (
    <div style={{ padding: "16px", maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "18px" }}>Memory: {form.name}</h2>
        <ScopeBadge label={form.scope!.label} type={form.scope!.type} />
      </div>

      <FormField label="Topic" fieldType="text" value={form.topic || form.name} onChange={() => {}} />
      <FormField label="Content" fieldType="textarea" value={form.content} onChange={(v) => handleChange("content", v)} placeholder="Memory content..." />
    </div>
  );
};
