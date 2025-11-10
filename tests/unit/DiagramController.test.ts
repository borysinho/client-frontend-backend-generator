import {
  DiagramController,
  ViewObserver,
} from "../../server/controllers/DiagramController";
import { JsonPatchOperation } from "../../server/validation/UMLValidator";

describe("DiagramController", () => {
  let controller: DiagramController;
  let mockView1: ViewObserver;
  let mockView2: ViewObserver;

  beforeEach(() => {
    controller = new DiagramController();
    mockView1 = {
      id: "view1",
      notify: jest.fn(),
    };
    mockView2 = {
      id: "view2",
      notify: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Inicialización", () => {
    test("debe crear una instancia correctamente", () => {
      expect(controller).toBeDefined();
      expect(typeof controller.registerView).toBe("function");
      expect(typeof controller.processOperation).toBe("function");
      expect(typeof controller.getStatistics).toBe("function");
    });

    test("debe tener estado inicial vacío", () => {
      const state = controller.getCurrentState();
      expect(state.elements).toEqual({});
      expect(state.relationships).toEqual({});
      expect(state.version).toBe(0);
    });
  });

  describe("Registro de vistas", () => {
    test("debe registrar una vista correctamente", () => {
      const unregister = controller.registerView("view1", mockView1);

      expect(unregister).toBeDefined();
      expect(typeof unregister).toBe("function");
    });

    test("debe enviar estado inicial a la nueva vista", () => {
      controller.registerView("view1", mockView1);

      expect(mockView1.notify).toHaveBeenCalledTimes(1);
      expect(mockView1.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "replace",
          path: "/diagram",
        }),
        expect.any(Object)
      );
    });

    test("debe permitir múltiples vistas registradas", () => {
      controller.registerView("view1", mockView1);
      controller.registerView("view2", mockView2);

      expect(mockView1.notify).toHaveBeenCalledTimes(1);
      expect(mockView2.notify).toHaveBeenCalledTimes(1);
    });

    test("debe permitir desregistrar vistas", () => {
      const unregister = controller.registerView("view1", mockView1);

      // Agregar una operación para verificar que las vistas reciben notificaciones
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

      controller.processOperation("view1", operation);

      // Desregistrar vista
      unregister();

      // Nueva operación - la vista desregistrada no debería recibir notificación
      const operation2: JsonPatchOperation = {
        ...operation,
        path: "/elements/class2",
        value: {
          id: "class2",
          className: "Class2",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 200, y: 100 },
        },
        sequenceNumber: 2,
      };

      controller.processOperation("view1", operation2);

      // mockView1 debería haber sido llamado solo 2 veces (estado inicial + primera operación)
      expect(mockView1.notify).toHaveBeenCalledTimes(2);
    });
  });

  describe("Procesamiento de operaciones", () => {
    beforeEach(() => {
      controller.registerView("view1", mockView1);
      controller.registerView("view2", mockView2);
    });

    test("debe procesar operación válida correctamente", async () => {
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

      const result = await controller.processOperation("view1", operation);

      expect(result.success).toBe(true);
      expect(result.newState).toBeDefined();
      expect(result.newState!.elements["class1"]).toBeDefined();
    });

    test("debe notificar a todas las vistas cuando una operación es exitosa", async () => {
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

      await controller.processOperation("view1", operation);

      // Ambas vistas deberían haber recibido la notificación del modelo
      expect(mockView1.notify).toHaveBeenCalledTimes(2); // estado inicial + cambio
      expect(mockView2.notify).toHaveBeenCalledTimes(2); // estado inicial + cambio
    });

    test("debe rechazar operación inválida", async () => {
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

      const result = await controller.processOperation(
        "view1",
        invalidOperation as JsonPatchOperation
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      // Las vistas no deberían recibir notificación de cambio (solo estado inicial)
      expect(mockView1.notify).toHaveBeenCalledTimes(1);
      expect(mockView2.notify).toHaveBeenCalledTimes(1);
    });

    test("debe manejar operaciones de diferentes vistas", async () => {
      const operation1: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "Class1",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 100, y: 100 },
        },
        clientId: "client1",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Operación de cliente 1",
      };

      const operation2: JsonPatchOperation = {
        op: "add",
        path: "/elements/class2",
        value: {
          id: "class2",
          className: "Class2",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 200, y: 100 },
        },
        clientId: "client2",
        timestamp: Date.now(),
        sequenceNumber: 2,
        description: "Operación de cliente 2",
      };

      await controller.processOperation("view1", operation1);
      await controller.processOperation("view2", operation2);

      const finalState = controller.getCurrentState();
      expect(finalState.elements["class1"]).toBeDefined();
      expect(finalState.elements["class2"]).toBeDefined();
      expect(finalState.version).toBe(2);
    });
  });

  describe("Estadísticas", () => {
    test("debe proporcionar estadísticas básicas", () => {
      const stats = controller.getStatistics();

      expect(stats).toHaveProperty("totalElements");
      expect(stats).toHaveProperty("totalRelationships");
      expect(stats).toHaveProperty("currentVersion");
      expect(stats).toHaveProperty("activeViews");
      expect(stats).toHaveProperty("lastModified");
    });

    test("debe contar vistas activas correctamente", () => {
      expect(controller.getStatistics().viewsCount).toBe(0);

      controller.registerView("view1", mockView1);
      expect(controller.getStatistics().viewsCount).toBe(1);

      controller.registerView("view2", mockView2);
      expect(controller.getStatistics().viewsCount).toBe(2);
    });

    test("debe actualizar estadísticas después de operaciones", async () => {
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
        description: "Agregar clase",
      };

      const statsBefore = controller.getStatistics();
      await controller.processOperation("view1", operation);
      const statsAfter = controller.getStatistics();

      expect(statsAfter.elementsCount).toBe(statsBefore.elementsCount + 1);
      expect(statsAfter.version).toBe(statsBefore.version + 1);
    });
  });

  describe("Notificaciones automáticas", () => {
    test("debe notificar automáticamente cuando el modelo cambia", async () => {
      controller.registerView("view1", mockView1);
      controller.registerView("view2", mockView2);

      // Limpiar llamadas de estado inicial
      jest.clearAllMocks();

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
        description: "Agregar clase",
      };

      await controller.processOperation("view1", operation);

      // Verificar que ambas vistas recibieron la notificación automática
      expect(mockView1.notify).toHaveBeenCalledTimes(1);
      expect(mockView2.notify).toHaveBeenCalledTimes(1);

      const callArgs1 = (mockView1.notify as jest.Mock).mock.calls[0];
      const callArgs2 = (mockView2.notify as jest.Mock).mock.calls[0];

      expect(callArgs1[0]).toEqual(callArgs2[0]); // Misma operación
      expect(callArgs1[1]).toEqual(callArgs2[1]); // Mismo estado
    });

    test("debe enviar notificaciones con el formato correcto", async () => {
      controller.registerView("view1", mockView1);

      // Limpiar llamada de estado inicial
      jest.clearAllMocks();

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
        description: "Agregar clase",
      };

      await controller.processOperation("view1", operation);

      expect(mockView1.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "replace",
          path: "/diagram",
          clientId: "server",
          description: "Estado actualizado del diagrama",
        }),
        expect.objectContaining({
          elements: expect.any(Object),
          relationships: expect.any(Object),
          version: 1,
          lastModified: expect.any(Number),
        })
      );
    });
  });
});
