import {
  UMLValidator,
  Diagram,
  Element,
  JsonPatchOperation,
} from "../../server/validation/UMLValidator";

describe("UMLValidator", () => {
  describe("Validación de operaciones JSON Patch", () => {
    test("debe validar operación de agregar elemento válido", () => {
      const operation: JsonPatchOperation = {
        op: "add",
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "TestClass",
          attributes: ["+attribute1: String"],
          methods: ["+method1(): void"],
          elementType: "class" as const,
          position: { x: 100, y: 200 },
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Agregar clase de prueba",
      };

      const diagram: Diagram = {
        id: "diagram1",
        elements: [],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("debe rechazar operación sin clientId", () => {
      const operation = {
        op: "add" as const,
        path: "/elements/class1",
        value: {
          id: "class1",
          className: "NewClass",
          attributes: [],
          methods: [],
          elementType: "class" as const,
          position: { x: 100, y: 100 },
        },
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Operación sin clientId",
      };

      const diagram: Diagram = {
        id: "diagram1",
        elements: [],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(
        operation as JsonPatchOperation,
        diagram
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("clientId es requerido");
    });

    test("debe rechazar agregar elemento con ID duplicado", () => {
      const operation: JsonPatchOperation = {
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
        description: "Agregar clase con ID duplicado",
      };

      const existingElement: Element = {
        id: "class1",
        className: "ExistingClass",
        attributes: [],
        methods: [],
        elementType: "class",
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      };

      const diagram: Diagram = {
        id: "diagram1",
        elements: [existingElement],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("ID de elemento duplicado: class1");
    });

    test("debe validar operación de actualizar elemento", () => {
      const operation: JsonPatchOperation = {
        op: "replace",
        path: "/elements/class1/className",
        value: "UpdatedClassName",
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Actualizar nombre de clase",
      };

      const existingElement: Element = {
        id: "class1",
        className: "OldClassName",
        attributes: [],
        methods: [],
        elementType: "class",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      };

      const diagram: Diagram = {
        id: "diagram1",
        elements: [existingElement],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("debe rechazar actualización de elemento inexistente", () => {
      const operation: JsonPatchOperation = {
        op: "replace",
        path: "/elements/nonexistent/className",
        value: "NewName",
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Actualizar elemento inexistente",
      };

      const diagram: Diagram = {
        id: "diagram1",
        elements: [],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Elemento no encontrado: nonexistent");
    });

    test("debe validar operación de agregar relación", () => {
      const operation: JsonPatchOperation = {
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
        sequenceNumber: 1,
        description: "Agregar relación de asociación",
      };

      const class1: Element = {
        id: "class1",
        className: "Class1",
        attributes: [],
        methods: [],
        elementType: "class",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      };

      const class2: Element = {
        id: "class2",
        className: "Class2",
        attributes: [],
        methods: [],
        elementType: "class",
        x: 200,
        y: 100,
        width: 100,
        height: 100,
      };

      const diagram: Diagram = {
        id: "diagram1",
        elements: [class1, class2],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("debe rechazar relación con elementos inexistentes", () => {
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

      const diagram: Diagram = {
        id: "diagram1",
        elements: [],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Elemento source no encontrado: nonexistent1"
      );
    });

    test("debe rechazar operación con path inválido", () => {
      const operation: JsonPatchOperation = {
        op: "add",
        path: "/invalid/path",
        value: { some: "data" },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Path inválido",
      };

      const diagram: Diagram = {
        id: "diagram1",
        elements: [],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Path no válido: /invalid/path");
    });

    test("debe rechazar tipo de elemento inválido", () => {
      const operation: JsonPatchOperation = {
        op: "add",
        path: "/elements/element1",
        value: {
          id: "element1",
          className: "TestElement",
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

      const diagram: Diagram = {
        id: "diagram1",
        elements: [],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Tipo de elemento no válido: invalid");
    });

    test("debe rechazar auto-referencia en relación", () => {
      const operation: JsonPatchOperation = {
        op: "add",
        path: "/relationships/rel1",
        value: {
          id: "rel1",
          sourceId: "class1",
          targetId: "class1", // Misma clase
          relationship: "association" as const,
        },
        clientId: "test-client",
        timestamp: Date.now(),
        sequenceNumber: 1,
        description: "Auto-referencia",
      };

      const class1: Element = {
        id: "class1",
        className: "Class1",
        attributes: [],
        methods: [],
        elementType: "class",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      };

      const diagram: Diagram = {
        id: "diagram1",
        elements: [class1],
        relationships: [],
        version: 1,
      };

      const result = UMLValidator.validateOperation(operation, diagram);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Una relación no puede referenciar al mismo elemento"
      );
    });
  });
});
