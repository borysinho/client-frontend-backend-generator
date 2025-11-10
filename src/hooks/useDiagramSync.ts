import { useState, useCallback, useEffect, useRef } from "react";
import type { CustomElement, UMLRelationship } from "../types";
import { Socket } from "socket.io-client";
import {
  OperationTracker,
  type JsonPatchOperation,
} from "../utils/operationTracker";

// Re-export para compatibilidad
export type { JsonPatchOperation };

export function useDiagramSync(
  socket?: Socket,
  diagramId: string = "default",
  onNotification?: (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string
  ) => void,
  // ✅ MVC: Callback para aplicar operaciones del servidor al estado local
  onServerOperation?: (operation: JsonPatchOperation) => void
) {
  const [_connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");
  const [activeUsers, setActiveUsers] = useState<string[]>([]); // 🔄 Cambiar a activeUsers (sin _)
  const [operations, setOperations] = useState<JsonPatchOperation[]>([]);

  // 🔄 UNDO/REDO: Estados para habilitar/deshabilitar botones
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isSingleUser, setIsSingleUser] = useState(true);

  // Estado para almacenar callbacks de operaciones pendientes
  const operationCallbacks = useRef<
    Map<
      number,
      {
        onConfirmed?: (operation: JsonPatchOperation) => void;
        onRejected?: (operation: JsonPatchOperation, reason: string) => void;
      }
    >
  >(new Map());

  // Conectar al diagrama cuando el socket esté disponible
  useEffect(() => {
    if (socket) {
      // Escuchar eventos del servidor (registrar siempre que socket exista)
      const handleOperationConfirmed = (data: {
        operation: JsonPatchOperation;
      }) => {
        console.log("Operación confirmada:", data.operation);

        // 🔄 UNDO/REDO: Activar canUndo cuando se confirma una operación
        setCanUndo(true);
        setCanRedo(false); // Limpiar redo cuando hay nueva operación

        // ✅ MVC: Aplicar la operación confirmada al estado local
        if (onServerOperation) {
          onServerOperation(data.operation);
        }

        // Ejecutar callback si existe
        const callbacks = operationCallbacks.current.get(
          data.operation.sequenceNumber
        );
        if (callbacks?.onConfirmed) {
          callbacks.onConfirmed(data.operation);
          operationCallbacks.current.delete(data.operation.sequenceNumber);
        }
      };

      const handleOperationRejected = (data: {
        operation: JsonPatchOperation;
        reason: string;
      }) => {
        console.error("Operación rechazada:", data.reason);
        if (onNotification) {
          onNotification("error", "Operación Rechazada", data.reason);
        }

        // Ejecutar callback si existe
        const callbacks = operationCallbacks.current.get(
          data.operation.sequenceNumber
        );
        if (callbacks?.onRejected) {
          callbacks.onRejected(data.operation, data.reason);
          operationCallbacks.current.delete(data.operation.sequenceNumber);
        }
      };

      const handleOperationConflict = (data: {
        operation: JsonPatchOperation;
        conflicts: unknown[];
      }) => {
        console.warn("Conflicto detectado:", data.conflicts);
        if (onNotification) {
          onNotification(
            "warning",
            "Conflicto Detectado",
            "Se detectó un conflicto en la operación. Los cambios pueden no haberse aplicado correctamente."
          );
        }
      };

      const handleRemoteOperation = (data: {
        operation: JsonPatchOperation;
      }) => {
        // ✅ MVC: Aplicar operación remota al estado local
        console.log("📥 Operación recibida del servidor:", data.operation);
        setOperations((prev) => [data.operation, ...prev.slice(0, 19)]);

        // ✅ MVC: Notificar al componente padre para actualizar su estado
        if (onServerOperation) {
          onServerOperation(data.operation);
        }
      };

      const handleUserJoined = (data: { userId: string }) => {
        setActiveUsers((prev) => {
          const newUsers = [...prev, data.userId];
          setIsSingleUser(newUsers.length <= 1);
          return newUsers;
        });
      };

      const handleUserLeft = (data: { userId: string }) => {
        setActiveUsers((prev) => {
          const newUsers = prev.filter((id) => id !== data.userId);
          setIsSingleUser(newUsers.length <= 1);
          return newUsers;
        });
      };

      const handleConnect = () => {
        console.log("Socket conectado en useDiagramSync");
        socket.emit("diagram:join", diagramId);
        setConnectionStatus("connected");
      };

      // 🔄 UNDO/REDO: Event listeners
      const handleUndoSuccess = (data: {
        undoneOperation: JsonPatchOperation;
        inverseOperation: JsonPatchOperation;
        canUndo: boolean;
        canRedo: boolean;
      }) => {
        console.log("✅ Undo exitoso:", data);
        setCanUndo(data.canUndo); // Usar estado del servidor
        setCanRedo(data.canRedo); // Usar estado del servidor

        // ✅ Aplicar la operación inversa al estado local
        if (onServerOperation) {
          console.log(
            "📥 Aplicando operación inversa del undo:",
            data.inverseOperation
          );
          onServerOperation(data.inverseOperation);
        }

        if (onNotification) {
          onNotification(
            "success",
            "Deshacer",
            "Operación deshecha correctamente"
          );
        }
      };

      const handleUndoError = (data: { error: string }) => {
        console.error("❌ Error en undo:", data.error);
        setCanUndo(false);
        if (onNotification) {
          onNotification("error", "Error al Deshacer", data.error);
        }
      };

      const handleUndoBlocked = (data: {
        reason: string;
        userCount: number;
      }) => {
        console.warn("🚫 Undo bloqueado:", data.reason);
        if (onNotification) {
          onNotification(
            "warning",
            "Undo/Redo No Disponible",
            `${data.reason} (${data.userCount} usuarios activos)`
          );
        }
      };

      const handleRedoSuccess = (data: {
        redoneOperation: JsonPatchOperation;
        canUndo: boolean;
        canRedo: boolean;
      }) => {
        console.log("✅ Redo exitoso:", data);
        setCanUndo(data.canUndo); // Usar estado del servidor
        setCanRedo(data.canRedo); // Usar estado del servidor

        // ✅ Aplicar la operación rehecha al estado local
        if (onServerOperation) {
          console.log("📥 Aplicando operación rehecha:", data.redoneOperation);
          onServerOperation(data.redoneOperation);
        }

        if (onNotification) {
          onNotification(
            "success",
            "Rehacer",
            "Operación rehecha correctamente"
          );
        }
      };

      const handleRedoError = (data: { error: string }) => {
        console.error("❌ Error en redo:", data.error);
        setCanRedo(false);
        if (onNotification) {
          onNotification("error", "Error al Rehacer", data.error);
        }
      };

      const handleRedoBlocked = (data: {
        reason: string;
        userCount: number;
      }) => {
        console.warn("🚫 Redo bloqueado:", data.reason);
        if (onNotification) {
          onNotification(
            "warning",
            "Undo/Redo No Disponible",
            `${data.reason} (${data.userCount} usuarios activos)`
          );
        }
      };

      socket.on("operation:confirmed", handleOperationConfirmed);
      socket.on("operation:rejected", handleOperationRejected);
      socket.on("operation:conflict", handleOperationConflict);
      socket.on("diagram:operation", handleRemoteOperation);
      socket.on("user:joined", handleUserJoined);
      socket.on("user:left", handleUserLeft);
      socket.on("connect", handleConnect);
      // 🔄 UNDO/REDO: Registrar listeners
      socket.on("undo:success", handleUndoSuccess);
      socket.on("undo:error", handleUndoError);
      socket.on("undo:blocked", handleUndoBlocked);
      socket.on("redo:success", handleRedoSuccess);
      socket.on("redo:error", handleRedoError);
      socket.on("redo:blocked", handleRedoBlocked);

      return () => {
        socket.off("operation:confirmed", handleOperationConfirmed);
        socket.off("operation:rejected", handleOperationRejected);
        socket.off("operation:conflict", handleOperationConflict);
        socket.off("diagram:operation", handleRemoteOperation);
        socket.off("user:joined", handleUserJoined);
        socket.off("user:left", handleUserLeft);
        socket.off("connect", handleConnect);
        // 🔄 UNDO/REDO: Desregistrar listeners
        socket.off("undo:success", handleUndoSuccess);
        socket.off("undo:error", handleUndoError);
        socket.off("undo:blocked", handleUndoBlocked);
        socket.off("redo:success", handleRedoSuccess);
        socket.off("redo:error", handleRedoError);
        socket.off("redo:blocked", handleRedoBlocked);
      };
    } else {
      setConnectionStatus("disconnected");
    }
  }, [socket, diagramId, onNotification, onServerOperation]);

  const addOperation = useCallback(
    (
      operation: Omit<
        JsonPatchOperation,
        "clientId" | "timestamp" | "sequenceNumber"
      >
    ) => {
      const newOperation = OperationTracker.createOperation(
        operation.op,
        operation.path,
        operation.value,
        operation.from,
        operation.description
      );
      setOperations((prev) => [newOperation, ...prev.slice(0, 19)]); // Mantener últimas 20 operaciones

      // Enviar la operación al servidor si hay socket disponible
      if (socket && socket.connected) {
        socket.emit("diagram:operation", newOperation);
        // 🔄 El servidor maneja el historial, activamos undo después de confirmar
        setCanUndo(true);
        setCanRedo(false); // Nueva operación limpia redo
      }
    },
    [socket]
  );

  // 🔄 UNDO/REDO: Solicitar undo al servidor
  const handleUndo = useCallback(() => {
    if (!socket || !socket.connected) {
      console.warn("No hay conexión para undo");
      return;
    }

    if (!isSingleUser) {
      if (onNotification) {
        onNotification(
          "warning",
          "Undo No Disponible",
          "Undo/Redo solo está disponible cuando trabajas solo en el diagrama"
        );
      }
      return;
    }

    console.log("📤 Solicitando undo al servidor...");
    socket.emit("diagram:undo");
  }, [socket, isSingleUser, onNotification]);

  // 🔄 UNDO/REDO: Solicitar redo al servidor
  const handleRedo = useCallback(() => {
    if (!socket || !socket.connected) {
      console.warn("No hay conexión para redo");
      return;
    }

    if (!isSingleUser) {
      if (onNotification) {
        onNotification(
          "warning",
          "Redo No Disponible",
          "Undo/Redo solo está disponible cuando trabajas solo en el diagrama"
        );
      }
      return;
    }

    console.log("📤 Solicitando redo al servidor...");
    socket.emit("diagram:redo");
  }, [socket, isSingleUser, onNotification]);

  const addOperationWithCallbacks = useCallback(
    (
      operation: Omit<
        JsonPatchOperation,
        "clientId" | "timestamp" | "sequenceNumber"
      >,
      onConfirmed?: (operation: JsonPatchOperation) => void,
      onRejected?: (operation: JsonPatchOperation, reason: string) => void
    ) => {
      const newOperation = OperationTracker.createOperation(
        operation.op,
        operation.path,
        operation.value,
        operation.from,
        operation.description
      );
      setOperations((prev) => [newOperation, ...prev.slice(0, 19)]); // Mantener últimas 20 operaciones

      // Almacenar callbacks para esta operación
      if (onConfirmed || onRejected) {
        operationCallbacks.current.set(newOperation.sequenceNumber, {
          onConfirmed,
          onRejected,
        });
      }

      // Enviar la operación al servidor si hay socket disponible
      if (socket && socket.connected) {
        socket.emit("diagram:operation", newOperation);
      }

      return newOperation;
    },
    [socket]
  );

  const trackElementAddWithCallbacks = useCallback(
    (
      element: CustomElement,
      onConfirmed?: (operation: JsonPatchOperation) => void,
      onRejected?: (operation: JsonPatchOperation, reason: string) => void
    ) => {
      addOperationWithCallbacks(
        {
          op: "add",
          path: "/elements/-",
          value: element,
          description: `Elemento ${element.elementType} "${element.className}" agregado`,
        },
        onConfirmed,
        onRejected
      );
    },
    [addOperationWithCallbacks]
  );

  const trackRelationshipAddWithCallbacks = useCallback(
    (
      relationship: UMLRelationship,
      onConfirmed?: (operation: JsonPatchOperation) => void,
      onRejected?: (operation: JsonPatchOperation, reason: string) => void
    ) => {
      addOperationWithCallbacks(
        {
          op: "add",
          path: "/relationships/-",
          value: relationship,
          description: `Relación ${relationship.relationship} creada`,
        },
        onConfirmed,
        onRejected
      );
    },
    [addOperationWithCallbacks]
  );

  const trackElementRemove = useCallback(
    (elementId: string, elementName: string) => {
      addOperation({
        op: "remove",
        path: `/elements/${elementId}`,
        description: `Elemento "${elementName}" eliminado`,
      });
    },
    [addOperation]
  );

  const trackElementUpdate = useCallback(
    (
      elementId: string,
      elementName: string,
      changes: Partial<CustomElement>
    ) => {
      // Para updates complejos, registramos el cambio más significativo
      if (changes.className) {
        addOperation({
          op: "replace",
          path: `/elements/${elementId}/className`,
          value: changes.className,
          description: `Nombre de "${elementName}" cambiado a "${changes.className}"`,
        });
      }
      if (changes.x !== undefined || changes.y !== undefined) {
        addOperation({
          op: "replace",
          path: `/elements/${elementId}/position`,
          value: { x: changes.x, y: changes.y },
          description: `Elemento "${elementName}" movido`,
        });
      }
      if (changes.attributes) {
        addOperation({
          op: "replace",
          path: `/elements/${elementId}/attributes`,
          value: changes.attributes,
          description: `Atributos de "${elementName}" modificados`,
        });
      }
      if (changes.methods) {
        addOperation({
          op: "replace",
          path: `/elements/${elementId}/methods`,
          value: changes.methods,
          description: `Métodos de "${elementName}" modificados`,
        });
      }
      if (changes.parentPackageId !== undefined) {
        const packageAction = changes.parentPackageId
          ? `asignado al paquete "${changes.parentPackageId}"`
          : "removido del paquete";
        addOperation({
          op: "replace",
          path: `/elements/${elementId}/parentPackageId`,
          value: changes.parentPackageId,
          description: `Elemento "${elementName}" ${packageAction}`,
        });
      }
      if (changes.stereotype !== undefined) {
        const stereotypeAction = changes.stereotype
          ? `cambiado a "${changes.stereotype}"`
          : "removido";
        addOperation({
          op: "replace",
          path: `/elements/${elementId}/stereotype`,
          value: changes.stereotype,
          description: `Estereotipo de "${elementName}" ${stereotypeAction}`,
        });
      }
      if (changes.containedElements) {
        addOperation({
          op: "replace",
          path: `/elements/${elementId}/containedElements`,
          value: changes.containedElements,
          description: `Elementos contenidos de "${elementName}" modificados`,
        });
      }
      if (changes.width !== undefined || changes.height !== undefined) {
        addOperation({
          op: "replace",
          path: `/elements/${elementId}/dimensions`,
          value: { width: changes.width, height: changes.height },
          description: `Dimensiones de "${elementName}" modificadas`,
        });
      }
    },
    [addOperation]
  );

  const trackRelationshipAdd = useCallback(
    (relationship: UMLRelationship) => {
      addOperation({
        op: "add",
        path: "/relationships/-",
        value: relationship,
        description: `Relación ${relationship.relationship} creada`,
      });
    },
    [addOperation]
  );

  const trackRelationshipRemove = useCallback(
    (relationshipId: string) => {
      addOperation({
        op: "remove",
        path: `/relationships/${relationshipId}`,
        description: `Relación eliminada`,
      });
    },
    [addOperation]
  );

  const trackRelationshipUpdate = useCallback(
    (relationshipId: string, changes: Partial<UMLRelationship>) => {
      // Enviar una operación 'replace' por cada campo modificado
      Object.entries(changes).forEach(([field, value]) => {
        addOperation({
          op: "replace",
          path: `/relationships/${relationshipId}/${field}`,
          value: value,
          description: `Campo "${field}" de relación actualizado`,
        });
      });
    },
    [addOperation]
  );

  const clearOperations = useCallback(() => {
    setOperations([]);
  }, []);

  return {
    operations,
    trackElementAddWithCallbacks,
    trackElementRemove,
    trackElementUpdate,
    trackRelationshipAdd,
    trackRelationshipAddWithCallbacks,
    trackRelationshipRemove,
    trackRelationshipUpdate,
    clearOperations,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    isSingleUser,
    activeUsers,
  };
}
