import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  addEdge,
  MarkerType,
  NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { useExtensionState } from "../hooks/useExtensionState";
import { ScopeBadge } from "../components/ScopeBadge";
import { vscode } from "../vscode";

const CONFIG_TYPES = ["agent", "skill", "hook", "command", "mcpServer", "settings", "claudeMd", "memory"];

const TYPE_COLORS: Record<string, string> = {
  agent: "#4fc3f7",
  skill: "#fff176",
  hook: "#ff8a65",
  command: "#81c784",
  mcpServer: "#ce93d8",
  settings: "#90a4ae",
  claudeMd: "#a1887f",
  memory: "#80deea",
};

// Custom node component
const ConfigNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: "6px",
        border: `2px solid ${TYPE_COLORS[data.objectType as string] || "#666"}`,
        background: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        fontSize: "12px",
        minWidth: "120px",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#555" }} />
      <div style={{ fontWeight: 600, marginBottom: "4px" }}>{data.label as string}</div>
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <span style={{
          fontSize: "10px",
          padding: "1px 6px",
          borderRadius: "8px",
          background: TYPE_COLORS[data.objectType as string] || "#666",
          color: "#000",
        }}>
          {data.objectType as string}
        </span>
        <span style={{ fontSize: "10px", opacity: 0.7 }}>
          [{data.scopeLabel as string}]
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "#555" }} />
    </div>
  );
};

const nodeTypes = { configNode: ConfigNode };

// Dagre layout
function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 150 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 160, height: 60 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 80,
        y: nodeWithPosition.y - 30,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export const ConnectionsView: React.FC = () => {
  const { allObjects, connections: rawConnections, connect, disconnect } = useExtensionState();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Collect all unique scopes
  const allScopes = useMemo(() => {
    const scopes = new Set<string>();
    for (const objects of Object.values(allObjects)) {
      (objects as any[]).forEach((obj) => scopes.add(obj.scope.label));
    }
    return ["all", ...Array.from(scopes)];
  }, [allObjects]);

  // Build nodes and edges from state
  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    for (const type of CONFIG_TYPES) {
      const objects = (allObjects[type] || []) as any[];
      for (const obj of objects) {
        // Apply filters
        if (scopeFilter !== "all" && obj.scope.label !== scopeFilter) continue;
        if (typeFilter !== "all" && type !== typeFilter) continue;

        newNodes.push({
          id: obj.id,
          type: "configNode",
          position: { x: 0, y: 0 },
          data: {
            label: obj.name,
            objectType: type,
            scopeLabel: obj.scope.label,
            scopeType: obj.scope.type,
          },
        });
      }
    }

    for (const conn of rawConnections) {
      // Only show edges for visible nodes
      if (newNodes.some((n) => n.id === conn.sourceId) && newNodes.some((n) => n.id === conn.targetId)) {
        newEdges.push({
          id: conn.id,
          source: conn.sourceId,
          target: conn.targetId,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "var(--vscode-focusBorder)" },
        });
      }
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [allObjects, rawConnections, scopeFilter, typeFilter]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        connect(params.source, params.target);
      }
    },
    [connect]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (confirm(`Remove connection?`)) {
        disconnect(edge.id);
      }
    },
    [disconnect]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Open the editor for this node
    vscode.postMessage({
      type: "openEditor",
      objectId: node.id,
    });
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{
        padding: "8px 16px",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        borderBottom: "1px solid var(--vscode-panel-border)",
      }}>
        <label style={{ fontSize: "13px" }}>
          Scope:
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            style={{
              marginLeft: "6px",
              padding: "4px",
              background: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border, transparent)",
            }}
          >
            {allScopes.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All Scopes" : s}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "13px" }}>
          Type:
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              marginLeft: "6px",
              padding: "4px",
              background: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border, transparent)",
            }}
          >
            <option value="all">All Types</option>
            {CONFIG_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};
