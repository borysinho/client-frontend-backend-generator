// src/utils/operationTracker.ts
export class OperationTracker {
  private static clientId = Math.random().toString(36).substr(2, 9);
  private static sequenceNumber = 0;

  static createOperation(
    op: "add" | "remove" | "replace" | "move" | "copy" | "test",
    path: string,
    value?: unknown,
    from?: string,
    description?: string
  ): JsonPatchOperation {
    return {
      op,
      path,
      value,
      from,
      description: description || "",
      clientId: this.clientId,
      timestamp: Date.now(),
      sequenceNumber: ++this.sequenceNumber,
    };
  }

  static getClientId(): string {
    return this.clientId;
  }
}

// Re-export para compatibilidad
export interface JsonPatchOperation {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
  from?: string;
  clientId: string;
  timestamp: number;
  sequenceNumber: number;
  description: string;
}

// Función para crear la operación inversa
export const createInverseOperation = (
  operation: JsonPatchOperation
): JsonPatchOperation => {
  switch (operation.op) {
    case "add":
      return {
        ...operation,
        op: "remove",
        value: undefined,
        description: `Deshacer: ${operation.description}`,
      };
    case "remove":
      return {
        ...operation,
        op: "add",
        description: `Deshacer: ${operation.description}`,
      };
    case "replace":
      // Para replace necesitamos el valor anterior, pero no lo tenemos
      // Por simplicidad, devolver la operación como está
      return {
        ...operation,
        description: `Deshacer: ${operation.description}`,
      };
    default:
      return operation;
  }
};
