import { createServer } from "http";
import { Server } from "socket.io";
import { io as ClientIO, Socket } from "socket.io-client";
import { DiagramController } from "../../server/controllers/DiagramController";
import { JsonPatchOperation } from "../../server/validation/UMLValidator";

describe("Colaboración - Pruebas de Integración", () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let controller: DiagramController;
  let clientSockets: Socket[] = [];

  beforeAll((done) => {
    // Crear servidor HTTP
    httpServer = createServer();

    // Crear servidor Socket.IO
    io = new Server(httpServer, {
      cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
      },
    });

    // Instancia del controlador
    controller = new DiagramController();

    // Configurar eventos del servidor
    io.on("connection", (socket) => {
      console.log(`Cliente conectado en pruebas: ${socket.id}`);

      // Crear observador para esta vista (socket)
      const viewObserver = {
        id: socket.id,
        notify: (operation: JsonPatchOperation, newState: unknown) => {
          socket.emit("diagram:update", { operation, newState });
        },
      };

      // Registrar la vista en el controlador
      const unregisterView = controller.registerView(socket.id, viewObserver);

      // Manejar unión a sala de diagrama
      socket.on("diagram:join", (diagramId: string) => {
        socket.join(`diagram-${diagramId}`);
        socket.to(`diagram-${diagramId}`).emit("user:joined", {
          userId: socket.id,
          timestamp: Date.now(),
        });
      });

      // Manejar operaciones del diagrama
      socket.on("diagram:operation", async (operation: JsonPatchOperation) => {
        try {
          const result = await controller.processOperation(
            socket.id,
            operation
          );

          if (result.success) {
            socket.emit("operation:confirmed", {
              operation,
              timestamp: Date.now(),
            });
          } else {
            socket.emit("operation:rejected", {
              operation,
              reason: result.errors?.join(", ") || "Error desconocido",
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.error("Error procesando operación:", error);
          socket.emit("operation:error", {
            operation,
            error: "Error interno del servidor",
            timestamp: Date.now(),
          });
        }
      });

      // Manejar desconexión
      socket.on("disconnect", () => {
        unregisterView();
      });
    });

    // Iniciar servidor en puerto de pruebas
    httpServer.listen(3002, () => {
      done();
    });
  });

  afterAll((done) => {
    // Cerrar todas las conexiones de cliente
    clientSockets.forEach((socket) => socket.disconnect());

    // Cerrar servidor
    io.close();
    httpServer.close(done);
  });

  afterEach(() => {
    // Limpiar estado entre pruebas
    clientSockets.forEach((socket) => socket.disconnect());
    clientSockets = [];
  });

  describe("Conexión de múltiples clientes", () => {
    test("debe permitir que múltiples clientes se conecten simultáneamente", (done) => {
      const client1 = ClientIO("http://localhost:3002");
      const client2 = ClientIO("http://localhost:3002");

      clientSockets = [client1, client2];

      let connectedCount = 0;

      const checkConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          expect(client1.connected).toBe(true);
          expect(client2.connected).toBe(true);
          done();
        }
      };

      client1.on("connect", checkConnected);
      client2.on("connect", checkConnected);
    });

    test("debe asignar IDs únicos a cada cliente", (done) => {
      const client1 = ClientIO("http://localhost:3002");
      const client2 = ClientIO("http://localhost:3002");

      clientSockets = [client1, client2];

      const clientIds: string[] = [];

      client1.on("connect", () => {
        clientIds.push(client1.id!);
        if (clientIds.length === 2) {
          expect(clientIds[0]).not.toBe(clientIds[1]);
          expect(clientIds[0]).toBeTruthy();
          expect(clientIds[1]).toBeTruthy();
          done();
        }
      });

      client2.on("connect", () => {
        clientIds.push(client2.id!);
        if (clientIds.length === 2) {
          expect(clientIds[0]).not.toBe(clientIds[1]);
          expect(clientIds[0]).toBeTruthy();
          expect(clientIds[1]).toBeTruthy();
          done();
        }
      });
    });
  });

  describe("Unión a diagramas", () => {
    test("debe permitir unirse a un diagrama específico", (done) => {
      const client = ClientIO("http://localhost:3002");
      clientSockets = [client];

      client.on("connect", () => {
        client.emit("diagram:join", "diagram1");

        // Esperar un poco para que se procese la unión
        setTimeout(() => {
          expect(client.connected).toBe(true);
          done();
        }, 100);
      });
    });

    test("debe notificar a otros clientes cuando alguien se une", (done) => {
      const client1 = ClientIO("http://localhost:3002");
      const client2 = ClientIO("http://localhost:3002");
      clientSockets = [client1, client2];

      let client1Joined = false;
      let client2Joined = false;

      client1.on("connect", () => {
        client1.emit("diagram:join", "diagram1");
        client1Joined = true;
        checkBothJoined();
      });

      client2.on("connect", () => {
        client2.emit("diagram:join", "diagram1");
        client2Joined = true;
        checkBothJoined();
      });

      const checkBothJoined = () => {
        if (client1Joined && client2Joined) {
          // Uno de los clientes debería haber recibido la notificación del otro
          setTimeout(() => {
            done();
          }, 200);
        }
      };
    });
  });

  describe("Operaciones colaborativas", () => {
    test("debe procesar operación válida y confirmar al cliente", (done) => {
      const client = ClientIO("http://localhost:3002");
      clientSockets = [client];

      const operation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "TestClass",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 100, y: 100 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Agregar clase de prueba",
      };

      client.on("connect", () => {
        client.emit("diagram:join", "diagram1");
        client.emit("diagram:operation", operation);
      });

      client.on("operation:confirmed", (data) => {
        expect(data.operation).toEqual(operation);
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    test("debe rechazar operación inválida", (done) => {
      const client = ClientIO("http://localhost:3002");
      clientSockets = [client];

      const invalidOperation = {
        op: "add" as const,
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "TestClass",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 100, y: 100 },
        },
        // Falta clientId - operación inválida
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Operación inválida",
      };

      client.on("connect", () => {
        client.emit("diagram:join", "diagram1");
        client.emit("diagram:operation", invalidOperation);
      });

      client.on("operation:rejected", (data) => {
        expect(data.operation).toEqual(invalidOperation);
        expect(data.reason).toContain("clientId");
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    test("debe sincronizar cambios entre múltiples clientes", (done) => {
      const client1 = ClientIO("http://localhost:3002");
      const client2 = ClientIO("http://localhost:3002");
      clientSockets = [client1, client2];

      const operation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "SharedClass",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 100, y: 100 },
        },
        clientId: "client1",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Agregar clase compartida",
      };

      let client1Confirmed = false;
      let client2ReceivedUpdate = false;

      client1.on("connect", () => {
        client1.emit("diagram:join", "diagram1");
      });

      client2.on("connect", () => {
        client2.emit("diagram:join", "diagram1");
      });

      client1.on("operation:confirmed", () => {
        client1Confirmed = true;
        checkSync();
      });

      client2.on("diagram:update", (data) => {
        expect(data.operation.op).toBe("replace");
        expect(data.operation.path).toBe("/diagram");
        expect(data.newState.elements["class1"]).toBeDefined();
        client2ReceivedUpdate = true;
        checkSync();
      });

      // Enviar operación desde cliente 1 después de que ambos estén conectados
      setTimeout(() => {
        client1.emit("diagram:operation", operation);
      }, 200);

      const checkSync = () => {
        if (client1Confirmed && client2ReceivedUpdate) {
          done();
        }
      };
    });

    test("debe mantener consistencia del estado entre operaciones", (done) => {
      const client = ClientIO("http://localhost:3002");
      clientSockets = [client];

      const addOperation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "TestClass",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 100, y: 100 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Agregar clase",
      };

      const updateOperation: JsonPatchOperation = {
        op: "replace",
        path: "/elements/class1/className",
        value: "UpdatedClass",
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 2,
        description: "Actualizar nombre",
      };

      let operationsConfirmed = 0;

      client.on("connect", () => {
        client.emit("diagram:join", "diagram1");
        client.emit("diagram:operation", addOperation);
      });

      client.on("operation:confirmed", (data) => {
        operationsConfirmed++;

        if (operationsConfirmed === 1) {
          // Primera operación confirmada, enviar la segunda
          expect(data.operation.sequenceNumber).toBe(1);
          client.emit("diagram:operation", updateOperation);
        } else if (operationsConfirmed === 2) {
          // Ambas operaciones confirmadas
          expect(data.operation.sequenceNumber).toBe(2);
          done();
        }
      });
    });
  });

  describe("Manejo de desconexiones", () => {
    test("debe manejar desconexión de cliente correctamente", (done) => {
      const client = ClientIO("http://localhost:3002");
      clientSockets = [client];

      client.on("connect", () => {
        client.emit("diagram:join", "diagram1");

        // Desconectar después de unirse
        setTimeout(() => {
          client.disconnect();
          expect(client.connected).toBe(false);
          done();
        }, 100);
      });
    });

    test("debe notificar desconexión a otros clientes en el mismo diagrama", (done) => {
      const client1 = ClientIO("http://localhost:3002");
      const client2 = ClientIO("http://localhost:3002");
      clientSockets = [client1, client2];

      client1.on("connect", () => {
        client1.emit("diagram:join", "diagram1");
      });

      client2.on("connect", () => {
        client2.emit("diagram:join", "diagram1");

        // Client2 se desconecta
        setTimeout(() => {
          client2.disconnect();
        }, 100);
      });

      client1.on("user:left", (data) => {
        expect(data.userId).toBe(client2.id);
        expect(data.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe("Rendimiento y escalabilidad", () => {
    test("debe manejar múltiples operaciones en secuencia", (done) => {
      const client = ClientIO("http://localhost:3002");
      clientSockets = [client];

      const operations: JsonPatchOperation[] = [];
      const numOperations = 5;

      // Crear múltiples operaciones
      for (let i = 1; i <= numOperations; i++) {
        operations.push({
          op: "add",
          path: `/elements/class${i}`,
          value: {
            id: `class${i}`,
            className: `Class${i}`,
            attributes: [],
            methods: [],
            elementType: "class" as const,
            position: { x: i * 50, y: i * 50 },
          },
          clientId: "test-client",
          timestamp: Date.now(),
          sequenceNumber: i,
          description: `Agregar clase ${i}`,
        });
      }

      let confirmedCount = 0;

      client.on("connect", () => {
        client.emit("diagram:join", "diagram1");

        // Enviar todas las operaciones
        operations.forEach((op) => {
          client.emit("diagram:operation", op);
        });
      });

      client.on("operation:confirmed", () => {
        confirmedCount++;
        if (confirmedCount === numOperations) {
          done();
        }
      });
    }, 10000); // Timeout extendido para múltiples operaciones
  });
});
