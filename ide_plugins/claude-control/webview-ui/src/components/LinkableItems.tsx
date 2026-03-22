import React from "react";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

interface LinkableItem {
  id: string;
  name: string;
  type: string;
  scopeLabel: string;
}

interface LinkableItemsProps {
  title: string;
  availableItems: LinkableItem[];
  linkedItems: LinkableItem[];
  onLink: (itemId: string) => void;
  onUnlink: (itemId: string) => void;
}

const DraggableItem: React.FC<{ item: LinkableItem }> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    padding: "6px 10px",
    margin: "2px 0",
    background: "var(--vscode-list-hoverBackground)",
    borderRadius: "3px",
    cursor: "grab",
    fontSize: "13px",
    opacity: isDragging ? 0.5 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <span>{item.name}</span>
      <span style={{ fontSize: "11px", opacity: 0.7 }}>[{item.scopeLabel}]</span>
    </div>
  );
};

const DroppableZone: React.FC<{
  id: string;
  title: string;
  children: React.ReactNode;
}> = ({ id, title, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        padding: "8px",
        border: `1px dashed ${isOver ? "var(--vscode-focusBorder)" : "var(--vscode-panel-border)"}`,
        borderRadius: "4px",
        minHeight: "60px",
        background: isOver ? "var(--vscode-list-hoverBackground)" : "transparent",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px", opacity: 0.8 }}>
        {title}
      </div>
      {children}
    </div>
  );
};

export const LinkableItems: React.FC<LinkableItemsProps> = ({
  title,
  availableItems,
  linkedItems,
  onLink,
  onUnlink,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (over.id === "linked-zone") {
      // Dragged from available to linked
      const isAlreadyLinked = linkedItems.some((item) => item.id === active.id);
      if (!isAlreadyLinked) {
        onLink(active.id as string);
      }
    }
  };

  return (
    <div style={{ marginTop: "16px" }}>
      <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>{title}</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
              Available
            </div>
            {availableItems
              .filter((item) => !linkedItems.some((l) => l.id === item.id))
              .map((item) => (
                <DraggableItem key={item.id} item={item} />
              ))}
          </div>

          <DroppableZone id="linked-zone" title="Linked">
            {linkedItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px",
                  margin: "2px 0",
                  background: "var(--vscode-badge-background)",
                  borderRadius: "3px",
                  fontSize: "13px",
                }}
              >
                <span>{item.name} [{item.scopeLabel}]</span>
                <button
                  onClick={() => onUnlink(item.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--vscode-errorForeground)",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  x
                </button>
              </div>
            ))}
            {linkedItems.length === 0 && (
              <div style={{ opacity: 0.5, fontSize: "12px", textAlign: "center" }}>
                Drag items here to link
              </div>
            )}
          </DroppableZone>
        </div>
      </DndContext>
    </div>
  );
};
