import React from "react";

interface ScopeBadgeProps {
  label: string;
  type: "global" | "project";
}

export const ScopeBadge: React.FC<ScopeBadgeProps> = ({ label, type }) => {
  const colors = {
    global: { bg: "var(--vscode-badge-background)", fg: "var(--vscode-badge-foreground)" },
    project: { bg: "var(--vscode-statusBarItem-prominentBackground, #007acc)", fg: "#fff" },
  };

  const { bg, fg } = colors[type];

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 600,
        borderRadius: "10px",
        backgroundColor: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
};
