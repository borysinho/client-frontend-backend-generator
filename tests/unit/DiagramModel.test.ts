import {
  DiagramModel,
  DiagramState,
  OperationResult,
} from "../../server/models/DiagramModel";
import { JsonPatchOperation } from "../../server/validation/UMLValidator";

describe("DiagramModel", () => {
  let model: DiagramModel;
  let mockObserver: jest.MockedFunction<(state: DiagramState) => void>;

  beforeEach(() => {
    model = new DiagramModel();
    mockObserver = jest.fn();
    model.subscribe(mockObserver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Inicialización", () => {
    test("debe inicializar con estado vacío", async () => {
      const state = model.getState();
      expect(state.elements).toEqual({});
      expect(state.relationships).toEqual({});
      expect(state.version).toBe(0);
      expect(state.lastModified).toBeGreaterThan(0);
    });

    test("debe tener versión inicial 0", async () => {
      const state = model.getState();
      expect(state.version).toBe(0);
    });
  });

  describe("Aplicación de operaciones válidas", () => {
    test("debe agregar un elemento válido", async () => {
      const operation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "TestClass",
          attributes: ["+attribute1: String"],
          methods: ["+method1(): void"],
          elementType: "class" as const,
          position: { x: 100, y: 100 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Agregar clase de prueba",
      };

      const result: OperationResult = await await model.applyOperation(
        operation
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBeDefined();
      expect(result.newState!.elements["class1"]).toBeDefined();
      expect(result.newState!.version).toBe(1);
      expect(mockObserver).toHaveBeenCalledWith(result.newState);
    });

    test("debe agregar una relación válida", async () => {
      // Primero agregar elementos
      const addClass1: JsonPatchOperation = {
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
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Agregar clase 1",
      };

      const addClass2: JsonPatchOperation = {
        op: "add",
        path: "/elements/class2",
        value: {
          id: "class2",
          className: "Class2",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 300, y: 100 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 2,
        description: "Agregar clase 2",
      };

      await await model.applyOperation(addClass1);
      await await model.applyOperation(addClass2);

      // Ahora agregar relación
      const addRelationship: JsonPatchOperation = {
        op: "add",
        path: "/relationships/rel1",
        value: {
          id: "rel1",
          sourceId: "class1",
          targetId: "class2",
          relationship: "association" as const,
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 3,
        description: "Agregar relación de asociación",
      };

      const result = await await model.applyOperation(addRelationship);

      expect(result.success).toBe(true);
      expect(result.newState!.relationships["rel1"]).toBeDefined();
      expect(result.newState!.version).toBe(3);
    });

    test("debe actualizar propiedades de un elemento", async () => {
      // Agregar elemento primero
      const addOperation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "OldName",
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

      await model.applyOperation(addOperation);

      // Actualizar nombre
      const updateOperation: JsonPatchOperation = {
        op: "replace",
        path: "/elements/class1/className",
        value: "NewName",
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 2,
        description: "Actualizar nombre de clase",
      };

      const result = await await model.applyOperation(updateOperation);

      expect(result.success).toBe(true);
      expect(result.newState!.elements["class1"].className).toBe("NewName");
      expect(result.newState!.version).toBe(2);
    });

    test("debe incrementar la versión con cada operación válida", async () => {
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
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Operación 1",
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
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 2,
        description: "Operación 2",
      };

      await model.applyOperation(operation1);
      expect(model.getState().version).toBe(1);

      await model.applyOperation(operation2);
      expect(model.getState().version).toBe(2);
    });
  });

  describe("Rechazo de operaciones inválidas", () => {
    test("debe rechazar operación sin clientId", async () => {
      const operation = {
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
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Operación sin clientId",
      };

      const result = await model.applyOperation(
        operation as JsonPatchOperation
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("clientId es requerido");
      expect(mockObserver).not.toHaveBeenCalled();
    });

    test("debe rechazar agregar elemento con ID duplicado", async () => {
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
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Agregar clase 1",
      };

      const operation2: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "Class1Duplicate",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 200, y: 100 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 2,
        description: "Intentar duplicar ID",
      };

      await model.applyOperation(operation1);
      const result = await model.applyOperation(operation2);

      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(mockObserver).toHaveBeenCalledTimes(1); // Solo la primera operación
    });

    test("debe rechazar relación con elementos inexistentes", async () => {
      const operation: JsonPatchOperation = {
        op: "add",
        path: "/relationships/rel1",
        value: {
          id: "rel1",
          sourceId: "nonexistent1",
          targetId: "nonexistent2",
          relationship: "association" as const,
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Relación con elementos inexistentes",
      };

      const result = await model.applyOperation(operation);

      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(mockObserver).not.toHaveBeenCalled();
    });

    test("debe rechazar operación con tipo de elemento inválido", async () => {
      const operation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "TestClass",
          attributes: [],
          methods: [],
          elementType: "invalid" as unknown as
            | "class"
            | "interface"
            | "enumeration"
            | "package"
            | "note",
          position: { x: 100, y: 100 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Elemento con tipo inválido",
      };

      const result = await model.applyOperation(operation);

      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(mockObserver).not.toHaveBeenCalled();
    });
  });

  describe("Sistema de observadores", () => {
    test("debe notificar a observadores cuando el estado cambia", async () => {
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

      await model.applyOperation(operation);

      expect(mockObserver).toHaveBeenCalledTimes(1);
      expect(mockObserver).toHaveBeenCalledWith(
        expect.objectContaining({
          elements: expect.any(Object),
          version: 1,
          lastModified: expect.any(Number),
        })
      );
    });

    test("debe permitir múltiples observadores", async () => {
      const observer2 = jest.fn();
      const observer3 = jest.fn();

      model.subscribe(observer2);
      model.subscribe(observer3);

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

      await model.applyOperation(operation);

      expect(mockObserver).toHaveBeenCalledTimes(1);
      expect(observer2).toHaveBeenCalledTimes(1);
      expect(observer3).toHaveBeenCalledTimes(1);
    });

    test("debe permitir desuscribir observadores", async () => {
      const unsubscribe = model.subscribe(mockObserver);

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

      await model.applyOperation(operation);
      expect(mockObserver).toHaveBeenCalledTimes(1);

      unsubscribe();
      await model.applyOperation({
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
      });

      expect(mockObserver).toHaveBeenCalledTimes(1); // No debería ser llamado nuevamente
    });
  });

  describe("Gestión de estado", () => {
    test("debe mantener el estado consistente después de operaciones fallidas", async () => {
      const validOperation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "ValidClass",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 100, y: 100 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Operación válida",
      };

      const invalidOperation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1", // ID duplicado
        value: {
          id: "class1",
          className: "DuplicateClass",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 200, y: 100 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 2,
        description: "Operación inválida",
      };

      await model.applyOperation(validOperation);
      const stateAfterValid = model.getState();

      await model.applyOperation(invalidOperation);
      const stateAfterInvalid = model.getState();

      // El estado debería ser el mismo después de la operación inválida
      expect(stateAfterInvalid).toEqual(stateAfterValid);
      expect(stateAfterInvalid.version).toBe(1); // Versión no incrementada
    });

    test("debe actualizar lastModified con cada cambio", async () => {
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

      const beforeTime = Date.now();
      await model.applyOperation(operation);
      const afterTime = Date.now();

      const state = model.getState();
      expect(state.lastModified).toBeGreaterThanOrEqual(beforeTime);
      expect(state.lastModified).toBeLessThanOrEqual(afterTime);
    });
  });
});
