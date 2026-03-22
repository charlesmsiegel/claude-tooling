import React from "react";

type FieldType = "text" | "textarea" | "dropdown" | "toggle" | "number" | "keyvalue" | "list";

interface FormFieldProps {
  label: string;
  fieldType: FieldType;
  value: any;
  onChange: (value: any) => void;
  options?: { label: string; value: string }[]; // for dropdown
  placeholder?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  fieldType,
  value,
  onChange,
  options,
  placeholder,
}) => {
  const inputId = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="form-field" style={{ marginBottom: "12px" }}>
      <label htmlFor={inputId} style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "13px" }}>
        {label}
      </label>
      {renderInput()}
    </div>
  );

  function renderInput() {
    const baseStyle: React.CSSProperties = {
      width: "100%",
      padding: "6px 8px",
      fontSize: "13px",
      background: "var(--vscode-input-background)",
      color: "var(--vscode-input-foreground)",
      border: "1px solid var(--vscode-input-border, transparent)",
      borderRadius: "2px",
      boxSizing: "border-box",
    };

    switch (fieldType) {
      case "text":
        return (
          <input
            id={inputId}
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={baseStyle}
          />
        );

      case "number":
        return (
          <input
            id={inputId}
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            placeholder={placeholder}
            style={baseStyle}
          />
        );

      case "textarea":
        return (
          <textarea
            id={inputId}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={6}
            style={{ ...baseStyle, resize: "vertical", fontFamily: "var(--vscode-editor-font-family)" }}
          />
        );

      case "dropdown":
        return (
          <select
            id={inputId}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            style={baseStyle}
          >
            <option value="">-- Select --</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "toggle":
        return (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span style={{ fontSize: "13px" }}>{value ? "Enabled" : "Disabled"}</span>
          </label>
        );

      case "list":
        return <ListEditor value={value || []} onChange={onChange} placeholder={placeholder} />;

      case "keyvalue":
        return <KeyValueEditor value={value || {}} onChange={onChange} />;

      default:
        return null;
    }
  }
};

// Sub-component for list editing
const ListEditor: React.FC<{
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const addItem = () => onChange([...value, ""]);
  const removeItem = (index: number) => onChange(value.filter((_, i) => i !== index));
  const updateItem = (index: number, newValue: string) => {
    const updated = [...value];
    updated[index] = newValue;
    onChange(updated);
  };

  return (
    <div>
      {value.map((item, index) => (
        <div key={index} style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: "13px",
              background: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border, transparent)",
              borderRadius: "2px",
            }}
          />
          <button onClick={() => removeItem(index)} style={buttonStyle}>
            Remove
          </button>
        </div>
      ))}
      <button onClick={addItem} style={buttonStyle}>
        + Add
      </button>
    </div>
  );
};

// Sub-component for key-value editing
const KeyValueEditor: React.FC<{
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}> = ({ value, onChange }) => {
  const entries = Object.entries(value);
  const addEntry = () => onChange({ ...value, "": "" });
  const removeEntry = (key: string) => {
    const updated = { ...value };
    delete updated[key];
    onChange(updated);
  };
  const updateKey = (oldKey: string, newKey: string) => {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      updated[k === oldKey ? newKey : k] = v;
    }
    onChange(updated);
  };
  const updateValue = (key: string, newValue: string) => {
    onChange({ ...value, [key]: newValue });
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "4px 8px",
    fontSize: "13px",
    background: "var(--vscode-input-background)",
    color: "var(--vscode-input-foreground)",
    border: "1px solid var(--vscode-input-border, transparent)",
    borderRadius: "2px",
  };

  return (
    <div>
      {entries.map(([key, val]) => (
        <div key={key} style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
          <input
            type="text"
            value={key}
            onChange={(e) => updateKey(key, e.target.value)}
            placeholder="Key"
            style={inputStyle}
          />
          <input
            type="text"
            value={val}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder="Value"
            style={inputStyle}
          />
          <button onClick={() => removeEntry(key)} style={buttonStyle}>
            Remove
          </button>
        </div>
      ))}
      <button onClick={addEntry} style={buttonStyle}>
        + Add
      </button>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "12px",
  background: "var(--vscode-button-secondaryBackground)",
  color: "var(--vscode-button-secondaryForeground)",
  border: "none",
  borderRadius: "2px",
  cursor: "pointer",
};
