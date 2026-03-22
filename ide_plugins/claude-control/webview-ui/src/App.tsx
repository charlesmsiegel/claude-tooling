import React from "react";
import { AgentEditor } from "./editors/AgentEditor";
import { SkillEditor } from "./editors/SkillEditor";
import { HookEditor } from "./editors/HookEditor";
import { CommandEditor } from "./editors/CommandEditor";
import { McpServerEditor } from "./editors/McpServerEditor";
import { SettingsEditor } from "./editors/SettingsEditor";
import { ClaudeMdEditor } from "./editors/ClaudeMdEditor";
import { MemoryEditor } from "./editors/MemoryEditor";
import { ConnectionsView } from "./connections/ConnectionsView";

const App: React.FC = () => {
  const rootEl = document.getElementById("root");
  const editorType = rootEl?.getAttribute("data-editor-type") || "unknown";

  switch (editorType) {
    case "agent": return <AgentEditor />;
    case "skill": return <SkillEditor />;
    case "hook": return <HookEditor />;
    case "command": return <CommandEditor />;
    case "mcpServer": return <McpServerEditor />;
    case "settings": return <SettingsEditor />;
    case "claudeMd": return <ClaudeMdEditor />;
    case "memory": return <MemoryEditor />;
    case "connections": return <ConnectionsView />;
    default:
      return <div style={{ padding: "16px" }}>Unknown editor type: {editorType}</div>;
  }
};

export default App;
