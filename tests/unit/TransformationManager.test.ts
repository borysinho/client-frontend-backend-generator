import {
  TransformationManager,
  transformLogicalToPhysical,
  generateSQLDDL,
} from "../../server/models/TransformationManager.js";
import { type DiagramState } from "../../server/models/DiagramModel.js";

// Mock data for testing
const createMockDiagramState = (): DiagramState => ({
  elements: {
    class1: {
      id: "class1",
      className: "User",
      attributes: ["name: string", "email: string", "age: int"],
      methods: ["getName(): string"],
      elementType: "class",
      position: { x: 100, y: 100 },
    },
    class2: {
      id: "class2",
      className: "Order",
      attributes: ["total: float", "date: date"],
      methods: ["calculateTotal(): float"],
      elementType: "class",
      position: { x: 400, y: 100 },
    },
  },
  relationships: {
    rel1: {
      id: "rel1",
      sourceId: "class1",
      targetId: "class2",
      relationship: "association",
      sourceCardinality: "1",
      targetCardinality: "*",
      label: "places",
    },
  },
  version: 1,
  lastModified: Date.now(),
});

describe("TransformationManager", () => {
  let mockDiagramState: DiagramState;

  beforeEach(() => {
    mockDiagramState = createMockDiagramState();
  });

  describe("transform()", () => {
    test("should successfully transform a valid logical model", () => {
      const manager = new TransformationManager(mockDiagramState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      expect(result.physicalModel).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(result.transformationSteps).toContain(
        "Transformación completada exitosamente"
      );
    });

    test("should handle empty diagram state", () => {
      const emptyState: DiagramState = {
        elements: {},
        relationships: {},
        version: 1,
        lastModified: Date.now(),
      };
      const manager = new TransformationManager(emptyState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      expect(result.physicalModel?.tables).toEqual({});
      expect(result.physicalModel?.relationships).toHaveLength(0);
    });

    test("should handle invalid relationships gracefully", () => {
      const invalidState: DiagramState = {
        elements: mockDiagramState.elements,
        relationships: {
          invalidRel: {
            id: "invalidRel",
            sourceId: "nonexistent",
            targetId: "class2",
            relationship: "association",
          },
        },
        version: 1,
        lastModified: Date.now(),
      };
      const manager = new TransformationManager(invalidState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      expect(result.errors).toContain(
        "Elementos no encontrados para relación invalidRel"
      );
    });

    test("should create tables from classes", () => {
      const manager = new TransformationManager(mockDiagramState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      expect(result.physicalModel?.tables).toHaveProperty("user");
      expect(result.physicalModel?.tables).toHaveProperty("order");

      const userTable = result.physicalModel!.tables.user;
      expect(userTable.columns).toHaveLength(6); // id, name, email, age, created_at, updated_at
      expect(userTable.primaryKey).toEqual(["user_id"]);
    });

    test("should handle one-to-many associations", () => {
      const manager = new TransformationManager(mockDiagramState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      const orderTable = result.physicalModel!.tables.order;
      expect(
        orderTable.columns.find((col) => col.name === "user_id")
      ).toBeDefined();
      expect(orderTable.foreignKeys).toHaveLength(1);
    });

    test("should handle many-to-many associations", () => {
      const manyToManyState: DiagramState = {
        elements: mockDiagramState.elements,
        relationships: {
          rel1: {
            id: "rel1",
            sourceId: "class1",
            targetId: "class2",
            relationship: "association",
            sourceCardinality: "*",
            targetCardinality: "*",
          },
        },
        version: 1,
        lastModified: Date.now(),
      };
      const manager = new TransformationManager(manyToManyState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      expect(result.physicalModel?.tables).toHaveProperty("user_order");
      const junctionTable = result.physicalModel!.tables.user_order;
      expect(junctionTable.primaryKey).toEqual(["user_id", "order_id"]);
    });

    test("should handle generalization relationships", () => {
      const generalizationState: DiagramState = {
        elements: {
          subclass: {
            id: "subclass",
            className: "Student",
            attributes: ["studentId: string"],
            methods: [],
            elementType: "class",
            position: { x: 100, y: 100 },
          },
          superclass: {
            id: "superclass",
            className: "Person",
            attributes: ["name: string"],
            methods: [],
            elementType: "class",
            position: { x: 400, y: 100 },
          },
        },
        relationships: {
          gen1: {
            id: "gen1",
            sourceId: "subclass",
            targetId: "superclass",
            relationship: "generalization",
          },
        },
        version: 1,
        lastModified: Date.now(),
      };
      const manager = new TransformationManager(generalizationState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      const studentTable = result.physicalModel!.tables.student;
      expect(
        studentTable.columns.find((col) => col.name === "person_id")
      ).toBeDefined();
      expect(studentTable.foreignKeys).toHaveLength(1);
    });

    test("should apply normalization rules", () => {
      const manager = new TransformationManager(mockDiagramState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      expect(result.physicalModel?.appliedNormalizations).toContain(
        "1FN - Valores atómicos"
      );
      expect(result.physicalModel?.appliedNormalizations).toContain(
        "2FN - Sin dependencias parciales"
      );
      expect(result.physicalModel?.appliedNormalizations).toContain(
        "3FN - Sin dependencias transitivas"
      );
    });

    test("should add indexes for foreign keys", () => {
      const manager = new TransformationManager(mockDiagramState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      const orderTable = result.physicalModel!.tables.order;
      expect(
        orderTable.indexes.find((idx) => idx.name.includes("idx_order_user_id"))
      ).toBeDefined();
    });
  });

  describe("transformLogicalToPhysical", () => {
    test("should be a utility function that creates manager and transforms", () => {
      const result = transformLogicalToPhysical(mockDiagramState);

      expect(result.success).toBe(true);
      expect(result.physicalModel).toBeDefined();
    });
  });

  describe("generateSQLDDL", () => {
    test("should generate valid SQL DDL from physical model", () => {
      const manager = new TransformationManager(mockDiagramState);
      const result = manager.transform();

      expect(result.success).toBe(true);
      expect(result.physicalModel).toBeDefined();

      const sql = generateSQLDDL(result.physicalModel!);

      expect(sql).toContain("CREATE TABLE");
      expect(sql).toContain("CREATE SEQUENCE");
      expect(sql).toContain("CREATE INDEX");
      expect(sql).toContain("ALTER TABLE");
      expect(sql).toContain("FOREIGN KEY");
    });

    test("should handle empty physical model", () => {
      const emptyModel = {
        tables: {},
        relationships: [],
        sequences: [],
        normalizationLevel: 3 as const,
        appliedNormalizations: [],
      };

      const sql = generateSQLDDL(emptyModel);
      expect(sql).toBe("\n");
    });
  });
});
