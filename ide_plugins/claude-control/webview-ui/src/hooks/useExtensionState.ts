import { useState, useEffect, useCallback } from "react";
import { vscode } from "../vscode";

// These types mirror the extension host types
interface ExtensionMessage {
  type: "update" | "connections" | "scopeList";
  [key: string]: any;
}

interface WebviewMessage {
  type: "save" | "delete" | "connect" | "disconnect" | "ready";
  [key: string]: any;
}

export function useExtensionState<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [allObjects, setAllObjects] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      switch (message.type) {
        case "update":
          if (message.objects?.length === 1) {
            setData(message.objects[0] as T);
          }
          setAllObjects((prev) => ({
            ...prev,
            [message.objectType]: message.objects,
          }));
          break;
        case "connections":
          setConnections(message.connections);
          break;
      }
    };

    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });

    return () => window.removeEventListener("message", handler);
  }, []);

  const sendMessage = useCallback((message: WebviewMessage) => {
    vscode.postMessage(message);
  }, []);

  const save = useCallback((obj: any) => {
    sendMessage({ type: "save", object: obj });
  }, [sendMessage]);

  const deleteObject = useCallback((objectId: string) => {
    sendMessage({ type: "delete", objectId });
  }, [sendMessage]);

  const connect = useCallback((sourceId: string, targetId: string) => {
    sendMessage({ type: "connect", sourceId, targetId });
  }, [sendMessage]);

  const disconnect = useCallback((connectionId: string) => {
    sendMessage({ type: "disconnect", connectionId });
  }, [sendMessage]);

  return { data, connections, allObjects, save, deleteObject, connect, disconnect, sendMessage };
}
