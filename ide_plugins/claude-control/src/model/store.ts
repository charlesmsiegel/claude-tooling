import { ConfigObject, ConfigObjectType, Connection } from "./types";

export class Store {
  private objects = new Map<string, ConfigObject>();
  private connections: Connection[] = [];

  set(obj: ConfigObject): void {
    this.objects.set(obj.id, obj);
  }

  get(id: string): ConfigObject | undefined {
    return this.objects.get(id);
  }

  delete(id: string): void {
    this.objects.delete(id);
    this.connections = this.connections.filter(
      (c) => c.sourceId !== id && c.targetId !== id
    );
  }

  listByType(type: ConfigObjectType): ConfigObject[] {
    return Array.from(this.objects.values()).filter((o) => o.type === type);
  }

  listAll(): ConfigObject[] {
    return Array.from(this.objects.values());
  }

  connect(
    sourceId: string,
    sourceType: ConfigObjectType,
    targetId: string,
    targetType: ConfigObjectType
  ): Connection {
    const conn: Connection = {
      id: `${sourceId}->${targetId}`,
      sourceId,
      sourceType,
      targetId,
      targetType,
    };
    this.connections.push(conn);
    return conn;
  }

  disconnect(connectionId: string): void {
    this.connections = this.connections.filter((c) => c.id !== connectionId);
  }

  getConnections(): Connection[] {
    return [...this.connections];
  }

  getConnectionsFor(objectId: string): Connection[] {
    return this.connections.filter(
      (c) => c.sourceId === objectId || c.targetId === objectId
    );
  }

  clear(): void {
    this.objects.clear();
    this.connections = [];
  }
}
