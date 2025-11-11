import React, { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { JsonPatchOperation } from "../hooks/useDiagramSync";
import "./css/ConnectionStatusBar.css";

interface User {
  id: string;
  name: string;
  connectedAt: Date;
}

interface OperationWithStatus extends JsonPatchOperation {
  status?: "valid" | "invalid" | "pending";
  errorMessage?: string;
}

interface ConnectionStatusBarProps {
  className?: string;
  operations?: JsonPatchOperation[];
  socket?: Socket;
}

const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  className = "",
  operations = [],
  socket: externalSocket,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(externalSocket || null);
  const [showDiagramInfo, setShowDiagramInfo] = useState(false);
  const [operationsWithStatus, setOperationsWithStatus] = useState<
    OperationWithStatus[]
  >([]);

  // Validar datos de operaciones
  const validateOperationData = useCallback(
    (operation: OperationWithStatus): boolean => {
      // Validaciones básicas de integridad de datos
      if (!operation.op || !operation.path || !operation.timestamp) {
        console.warn("Operación con datos incompletos:", operation);
        return false;
      }

      // Validar formato del path
      if (!operation.path.startsWith("/")) {
        console.warn("Path inválido en operación:", operation.path);
        return false;
      }

      // Validar timestamp razonable (no en el futuro, no muy antiguo)
      const now = Date.now();
      const opTime = new Date(operation.timestamp).getTime();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const oneHourFromNow = now + 60 * 60 * 1000;

      if (opTime < fiveMinutesAgo || opTime > oneHourFromNow) {
        console.warn("Timestamp inválido en operación:", operation.timestamp);
        return false;
      }

      return true;
    },
    []
  );

  // Limpiar operaciones antiguas y no válidas
  const cleanupOperations = useCallback(() => {
    setOperationsWithStatus((prev) => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      return prev.filter((op) => {
        // Remover operaciones muy antiguas
        if (new Date(op.timestamp).getTime() < fiveMinutesAgo) {
          return false;
        }

        // Remover operaciones con datos inválidos
        if (!validateOperationData(op)) {
          return false;
        }

        return true;
      });
    });
  }, [validateOperationData]);

  // Manejar acciones automáticas basadas en el estado de las operaciones
  const handleOperationStatusChange = useCallback(
    (
      operation: OperationWithStatus,
      newStatus: "valid" | "invalid" | "pending"
    ) => {
      // Acciones para operaciones válidas
      if (newStatus === "valid") {
        // Podríamos agregar feedback visual positivo
        console.log(
          `✅ Operación validada exitosamente: ${operation.op} en ${operation.path}`
        );
      }

      // Acciones para operaciones inválidas
      if (newStatus === "invalid") {
        // Mostrar notificación de error
        console.error(
          `❌ Operación rechazada: ${
            operation.errorMessage || "Error desconocido"
          }`
        );

        // Podríamos mostrar una notificación visual al usuario
        // Por ahora, solo logueamos
      }

      // Acciones para operaciones pendientes
      if (newStatus === "pending") {
        // Verificar si la operación lleva mucho tiempo pendiente
        const pendingTime =
          Date.now() - new Date(operation.timestamp).getTime();
        const timeoutThreshold = 10000; // 10 segundos

        if (pendingTime > timeoutThreshold) {
          console.warn(
            `⏰ Operación pendiente por mucho tiempo: ${operation.op} en ${operation.path}`
          );

          // Podríamos marcar como timeout o intentar reenviar
          // Por ahora, solo logueamos la advertencia
        }
      }
    },
    []
  );

  useEffect(() => {
    // Escuchar eventos de operaciones del socket
    if (socket) {
      const handleOperationConfirmed = (data: {
        operation: JsonPatchOperation;
      }) => {
        console.log(
          "🔄 ConnectionStatusBar recibió operation:confirmed:",
          data.operation.sequenceNumber
        );
        setOperationsWithStatus((prev) =>
          prev.map((op) =>
            op.sequenceNumber === data.operation.sequenceNumber
              ? (() => {
                  console.log(
                    "✅ Actualizando operación a 'valid':",
                    op.sequenceNumber
                  );
                  const updatedOp = { ...op, status: "valid" as const };
                  handleOperationStatusChange(updatedOp, "valid");
                  return updatedOp;
                })()
              : op
          )
        );
      };

      const handleOperationRejected = (data: {
        operation: JsonPatchOperation;
        reason: string;
      }) => {
        console.log(
          "❌ ConnectionStatusBar recibió operation:rejected:",
          data.operation.sequenceNumber,
          "razón:",
          data.reason
        );
        setOperationsWithStatus((prev) =>
          prev.map((op) =>
            op.sequenceNumber === data.operation.sequenceNumber
              ? (() => {
                  console.log(
                    "❌ Actualizando operación a 'invalid':",
                    data.operation.sequenceNumber
                  );
                  const updatedOp = {
                    ...op,
                    status: "invalid" as const,
                    errorMessage: data.reason,
                  };
                  handleOperationStatusChange(updatedOp, "invalid");
                  return updatedOp;
                })()
              : op
          )
        );
      };

      socket.on("operation:confirmed", handleOperationConfirmed);
      socket.on("operation:rejected", handleOperationRejected);

      return () => {
        socket.off("operation:confirmed", handleOperationConfirmed);
        socket.off("operation:rejected", handleOperationRejected);
      };
    }
  }, [socket, handleOperationStatusChange]);

  // Sincronizar operaciones entrantes con el estado
  useEffect(() => {
    console.log(
      "🔄 Sincronizando operaciones en ConnectionStatusBar:",
      operations.length,
      "operaciones"
    );
    setOperationsWithStatus((prev) => {
      const newOps = operations
        .filter(validateOperationData) // Filtrar operaciones inválidas
        .map((op) => {
          const existing = prev.find(
            (p) => p.sequenceNumber === op.sequenceNumber
          );
          const operationWithStatus = existing || {
            ...op,
            status: "pending" as const,
          };

          // Si es una nueva operación, manejar el cambio de estado
          if (!existing) {
            console.log(
              "🆕 Nueva operación pendiente:",
              op.sequenceNumber,
              op.op,
              op.path
            );
            handleOperationStatusChange(operationWithStatus, "pending");
          }

          return operationWithStatus;
        });
      console.log(
        "📊 Estado final de operaciones:",
        newOps.map((op) => ({ seq: op.sequenceNumber, status: op.status }))
      );
      return newOps;
    });
  }, [operations, handleOperationStatusChange, validateOperationData]);

  // Limpiar operaciones periódicamente
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupOperations, 30000); // Cada 30 segundos

    return () => clearInterval(cleanupInterval);
  }, [cleanupOperations]);

  // Manejar la tecla ESC para cerrar el dropdown
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showDiagramInfo) {
        setShowDiagramInfo(false);
      }
    };

    if (showDiagramInfo) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDiagramInfo]);

  useEffect(() => {
    // Usar socket externo si está disponible, o crear uno nuevo
    let socketInstance: Socket;

    if (externalSocket) {
      socketInstance = externalSocket;
      // Establecer estado inicial basado en la conexión actual
      setIsConnected(externalSocket.connected);

      // Configurar event listeners para socket externo
      socketInstance.on("connect", () => {
        console.log(
          "ConnectionStatusBar: Connected to server (external socket)"
        );
        setIsConnected(true);
      });

      socketInstance.on("disconnect", () => {
        console.log(
          "ConnectionStatusBar: Disconnected from server (external socket)"
        );
        setIsConnected(false);
        setUsers([]);
        setTotalUsers(0);
      });
    } else {
      // Conectar al servidor Socket.IO
      socketInstance = io("http://localhost:3001", {
        transports: ["websocket", "polling"],
      });

      socketInstance.on("connect", () => {
        console.log(
          "ConnectionStatusBar: Connected to server (internal socket)"
        );
        setIsConnected(true);
      });

      socketInstance.on("disconnect", () => {
        console.log(
          "ConnectionStatusBar: Disconnected from server (internal socket)"
        );
        setIsConnected(false);
        setUsers([]);
        setTotalUsers(0);
      });
    }

    // Configurar eventos comunes
    socketInstance.on("user:joined", (data: { userId: string }) => {
      console.log("User joined:", data.userId);
    });

    socketInstance.on("user:left", (data: { userId: string }) => {
      console.log("User left:", data.userId);
    });

    socketInstance.on(
      "users:update",
      (data: { connectedUsers: User[]; totalUsers: number }) => {
        setUsers(data.connectedUsers);
        setTotalUsers(data.totalUsers);
      }
    );

    socketInstance.on(
      "welcome",
      (data: { message: string; userId: string; userName: string }) => {
        console.log(data.message);
      }
    );

    setSocket(socketInstance);

    // Solo desconectar si creamos el socket nosotros mismos
    return () => {
      if (!externalSocket) {
        socketInstance.disconnect();
      }
    };
  }, [externalSocket]);

  const handleTestConnection = () => {
    if (socket && isConnected) {
      socket.emit("ping", { timestamp: new Date() });
      socket.once("pong", (data) => {
        console.log("Pong received:", data);
      });
    }
  };

  return (
    <>
      {/* Botón flotante para mostrar información del diagrama */}
      <button
        className="diagram-info-floating-btn"
        onClick={() => setShowDiagramInfo(!showDiagramInfo)}
        title="Ver cómo se ensambla el diagrama"
      >
        📋
      </button>

      <div className={`connection-status-bar ${className}`}>
        <div className="status-indicator">
          <div
            className={`status-dot ${
              isConnected ? "connected" : "disconnected"
            }`}
          ></div>
          <span className="status-text">
            {isConnected ? "Conectado" : "Desconectado"}
          </span>
        </div>

        <div className="users-info">
          <span className="users-icon">👥</span>
          <span className="users-count">
            {totalUsers} usuario{totalUsers !== 1 ? "s" : ""} conectado
            {totalUsers !== 1 ? "s" : ""}
          </span>
          {users.length > 0 && (
            <div className="users-list">
              {users.slice(0, 3).map((user) => (
                <div
                  key={user.id}
                  className="user-avatar"
                  title={`${user.name} - Conectado ${new Date(
                    user.connectedAt
                  ).toLocaleTimeString()}`}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {users.length > 3 && (
                <div
                  className="user-avatar more"
                  title={`${users.length - 3} más...`}
                >
                  +{users.length - 3}
                </div>
              )}
            </div>
          )}
        </div>

        {isConnected && (
          <button
            className="test-connection-btn"
            onClick={handleTestConnection}
            title="Probar conexión"
          >
            🧪
          </button>
        )}
      </div>

      {showDiagramInfo && (
        <div className="diagram-operations-dropdown">
          <div className="dropdown-header">
            <h4>📋 Estado de Operaciones en Tiempo Real</h4>
            <div className="operations-summary">
              <span className="operations-count">
                Total: {operationsWithStatus.length}
              </span>
              {operationsWithStatus.length > 0 && (
                <div className="operations-breakdown">
                  <span className="count-valid">
                    ✅{" "}
                    {
                      operationsWithStatus.filter((op) => op.status === "valid")
                        .length
                    }{" "}
                    válidas
                  </span>
                  <span className="count-invalid">
                    ❌{" "}
                    {
                      operationsWithStatus.filter(
                        (op) => op.status === "invalid"
                      ).length
                    }{" "}
                    inválidas
                  </span>
                  <span className="count-pending">
                    ⏳{" "}
                    {
                      operationsWithStatus.filter(
                        (op) => op.status === "pending"
                      ).length
                    }{" "}
                    pendientes
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="operations-list">
            {operationsWithStatus.length === 0 ? (
              <div className="no-operations">
                <span>📝</span>
                <p>No hay operaciones recientes</p>
                <small>
                  Las operaciones aparecerán aquí cuando edites el diagrama
                </small>
              </div>
            ) : (
              operationsWithStatus.map((operation, index) => (
                <div
                  key={`${operation.timestamp}-${index}`}
                  className={`operation-item operation-${
                    operation.status || "pending"
                  }`}
                >
                  <div className="operation-icon">
                    {operation.op === "add" && "➕"}
                    {operation.op === "remove" && "🗑️"}
                    {operation.op === "replace" && "🔄"}
                    {operation.op === "move" && "📍"}
                    {operation.op === "copy" && "📋"}
                    {operation.op === "test" && "✅"}
                  </div>
                  <div className="operation-status">
                    {operation.status === "valid" && (
                      <span className="status-valid">✅ Válida</span>
                    )}
                    {operation.status === "invalid" && (
                      <span className="status-invalid">❌ Inválida</span>
                    )}
                    {operation.status === "pending" && (
                      <span className="status-pending">⏳ Pendiente</span>
                    )}
                  </div>
                  <div className="operation-details">
                    <div className="operation-description">
                      {operation.description}
                    </div>
                    {operation.status === "invalid" &&
                      operation.errorMessage && (
                        <div className="operation-error">
                          <small>💡 {operation.errorMessage}</small>
                        </div>
                      )}
                    <div className="operation-code">
                      <code>
                        {JSON.stringify(
                          {
                            op: operation.op,
                            path: operation.path,
                            timestamp: new Date(
                              operation.timestamp
                            ).toISOString(),
                            ...(operation.value
                              ? { value: operation.value }
                              : {}),
                            ...(operation.from ? { from: operation.from } : {}),
                          },
                          null,
                          0
                        )}
                      </code>
                    </div>
                    <div className="operation-timestamp">
                      {new Date(operation.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="dropdown-footer">
            <small>
              💡 Cada cambio en el diagrama genera una operación JSON Patch
            </small>
          </div>
        </div>
      )}
    </>
  );
};

export default ConnectionStatusBar;
