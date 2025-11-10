import {
  DiagramOperationLogModel,
  DiagramOperation,
  DiagramOperationInput,
  OperationBatchInput,
} from "../../server/models/DiagramOperationLogModel.js";

describe("DiagramOperationLogModel", () => {
  let logModel: DiagramOperationLogModel;

  const mockOperationData = {
    diagramId: "diagram123",
    operation: {
      op: "add" as const,
      path: "/elements/class1",
      value: {
        id: "class1",
        className: "TestClass",
        attributes: [],
        methods: [],
        elementType: "class" as const,
      },
      clientId: "client123",
      timestamp: Date.now(),
      sequenceNumber: 1,
      description: "Add class",
    },
    userId: "user456",
    timestamp: new Date(),
    sequenceNumber: 1,
    diagramVersion: 1,
    clientId: "client123",
  };

  beforeEach(() => {
    logModel = new DiagramOperationLogModel();
  });

  describe("addOperation()", () => {
    test("should add a new operation to the log", () => {
      const operation = logModel.addOperation(mockOperationData);

      expect(operation).toBeDefined();
      expect(operation.id).toMatch(/^op_\d+_[a-z0-9]+$/);
      expect(operation.diagramId).toBe(mockOperationData.diagramId);
      expect(operation.userId).toBe(mockOperationData.userId);
      expect(operation.sequenceNumber).toBe(mockOperationData.sequenceNumber);
    });

    test("should index operation by diagramId", () => {
      const operation = logModel.addOperation(mockOperationData);
      const operations = logModel.getOperationsByDiagram("diagram123");

      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual(operation);
    });
  });

  describe("getOperationsByDiagram()", () => {
    test("should return all operations for a diagram", () => {
      const op1 = logModel.addOperation({
        ...mockOperationData,
        sequenceNumber: 1,
      });
      const op2 = logModel.addOperation({
        ...mockOperationData,
        sequenceNumber: 2,
      });

      const operations = logModel.getOperationsByDiagram("diagram123");

      expect(operations).toHaveLength(2);
      expect(operations).toContain(op1);
      expect(operations).toContain(op2);
    });

    test("should return empty array for diagram with no operations", () => {
      const operations = logModel.getOperationsByDiagram("nonexistent");

      expect(operations).toEqual([]);
    });
  });

  describe("getLastOperation()", () => {
    test("should return the last operation for a diagram", () => {
      logModel.addOperation({ ...mockOperationData, sequenceNumber: 1 });
      logModel.addOperation({ ...mockOperationData, sequenceNumber: 2 });
      const lastOp = logModel.addOperation({
        ...mockOperationData,
        sequenceNumber: 3,
      });

      const result = logModel.getLastOperation("diagram123");

      expect(result).toEqual(lastOp);
    });

    test("should return undefined for diagram with no operations", () => {
      const result = logModel.getLastOperation("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("getOperationsByUser()", () => {
    test("should return all operations by a user", () => {
      const op1 = logModel.addOperation({
        ...mockOperationData,
        userId: "user123",
        sequenceNumber: 1,
      });
      const op2 = logModel.addOperation({
        ...mockOperationData,
        userId: "user123",
        sequenceNumber: 2,
      });
      logModel.addOperation({
        ...mockOperationData,
        userId: "user456",
        sequenceNumber: 3,
      });

      const operations = logModel.getOperationsByUser("user123");

      expect(operations).toHaveLength(2);
      expect(operations).toContain(op1);
      expect(operations).toContain(op2);
    });
  });

  describe("getDiagramSummary()", () => {
    test("should return summary for diagram with operations", () => {
      logModel.addOperation({
        ...mockOperationData,
        userId: "user123",
        sequenceNumber: 1,
        diagramVersion: 1,
      });
      logModel.addOperation({
        ...mockOperationData,
        userId: "user456",
        sequenceNumber: 2,
        diagramVersion: 2,
      });
      logModel.addOperation({
        ...mockOperationData,
        userId: "user123",
        sequenceNumber: 3,
        diagramVersion: 3,
        operation: {
          ...mockOperationData.operation,
          op: "remove" as const,
          description: "Remove class",
        },
      });

      const summary = logModel.getDiagramSummary("diagram123");

      expect(summary).toBeDefined();
      expect(summary!.diagramId).toBe("diagram123");
      expect(summary!.totalOperations).toBe(3);
      expect(summary!.lastUserId).toBe("user123");
      expect(summary!.currentVersion).toBe(3);
    });

    test("should return undefined for diagram with no operations", () => {
      const summary = logModel.getDiagramSummary("nonexistent");

      expect(summary).toBeUndefined();
    });
  });

  describe("cleanupOldOperations()", () => {
    test("should remove old operations keeping specified count", () => {
      // Add 5 operations
      for (let i = 1; i <= 5; i++) {
        logModel.addOperation({
          ...mockOperationData,
          sequenceNumber: i,
          diagramVersion: i,
        });
      }

      const removedCount = logModel.cleanupOldOperations("diagram123", 3);

      expect(removedCount).toBe(2);
      const remainingOps = logModel.getOperationsByDiagram("diagram123");
      expect(remainingOps).toHaveLength(3);
    });

    test("should return 0 when operations count is less than keepVersions", () => {
      logModel.addOperation({ ...mockOperationData, sequenceNumber: 1 });

      const removedCount = logModel.cleanupOldOperations("diagram123", 5);

      expect(removedCount).toBe(0);
      const remainingOps = logModel.getOperationsByDiagram("diagram123");
      expect(remainingOps).toHaveLength(1);
    });
  });

  describe("Version Management", () => {
    test("getCurrentVersion() should return 0 for new diagram", () => {
      const version = logModel.getCurrentVersion("newDiagram");
      expect(version).toBe(0);
    });

    test("incrementVersion() should increment version for diagram", () => {
      const newVersion = logModel.incrementVersion("diagram123");
      expect(newVersion).toBe(1);

      const currentVersion = logModel.getCurrentVersion("diagram123");
      expect(currentVersion).toBe(1);
    });

    test("setVersion() should set specific version for diagram", () => {
      logModel.setVersion("diagram123", 5);
      const version = logModel.getCurrentVersion("diagram123");
      expect(version).toBe(5);
    });

    test("resetVersion() should reset version to 0", () => {
      logModel.setVersion("diagram123", 10);
      logModel.resetVersion("diagram123");
      const version = logModel.getCurrentVersion("diagram123");
      expect(version).toBe(0);
    });

    test("addOperation() should auto-increment version when not provided", () => {
      const operationData: DiagramOperationInput = {
        diagramId: mockOperationData.diagramId,
        operation: mockOperationData.operation,
        userId: mockOperationData.userId,
        timestamp: mockOperationData.timestamp,
        sequenceNumber: mockOperationData.sequenceNumber,
        clientId: mockOperationData.clientId,
        // diagramVersion is omitted to test auto-increment
      };

      const operation = logModel.addOperation(operationData);
      expect(operation.diagramVersion).toBe(1);

      const currentVersion = logModel.getCurrentVersion("diagram123");
      expect(currentVersion).toBe(1);
    });

    test("addOperation() should use provided version when specified", () => {
      const operation = logModel.addOperation({
        ...mockOperationData,
        diagramVersion: 10,
      });

      expect(operation.diagramVersion).toBe(10);
      const currentVersion = logModel.getCurrentVersion("diagram123");
      expect(currentVersion).toBe(10);
    });

    test("addOperationBatch() should handle versions correctly", () => {
      const batchOperations: DiagramOperationInput[] = [
        {
          diagramId: "diagram123",
          operation: mockOperationData.operation,
          userId: "user456",
          timestamp: new Date(),
          sequenceNumber: 1,
          clientId: "client123",
        },
        {
          diagramId: "diagram123",
          operation: {
            ...mockOperationData.operation,
            path: "/elements/class2",
          },
          userId: "user456",
          timestamp: new Date(),
          sequenceNumber: 2,
          clientId: "client123",
        },
        {
          diagramId: "diagram123",
          operation: {
            ...mockOperationData.operation,
            path: "/elements/class3",
          },
          userId: "user456",
          timestamp: new Date(),
          sequenceNumber: 3,
          clientId: "client123",
        },
      ];

      const batchData: OperationBatchInput = {
        diagramId: "diagram123",
        operations: batchOperations,
        batchTimestamp: new Date(),
        userId: "user456",
      };

      const batch = logModel.addOperationBatch(batchData);

      expect(batch.operations[0].diagramVersion).toBe(1);
      expect(batch.operations[1].diagramVersion).toBe(2);
      expect(batch.operations[2].diagramVersion).toBe(3);

      const currentVersion = logModel.getCurrentVersion("diagram123");
      expect(currentVersion).toBe(3);
    });

    test("getVersionHistory() should return version history for diagram", () => {
      logModel.addOperation({
        ...mockOperationData,
        sequenceNumber: 1,
        diagramVersion: 1,
      });
      logModel.addOperation({
        ...mockOperationData,
        sequenceNumber: 2,
        diagramVersion: 2,
      });

      const history = logModel.getVersionHistory("diagram123");

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
    });

    test("getOperationsUpToVersion() should return operations up to specified version", () => {
      logModel.addOperation({
        ...mockOperationData,
        sequenceNumber: 1,
        diagramVersion: 1,
      });
      logModel.addOperation({
        ...mockOperationData,
        sequenceNumber: 2,
        diagramVersion: 2,
      });
      logModel.addOperation({
        ...mockOperationData,
        sequenceNumber: 3,
        diagramVersion: 3,
      });

      const operations = logModel.getOperationsUpToVersion("diagram123", 2);

      expect(operations).toHaveLength(2);
      expect(operations[0].diagramVersion).toBe(1);
      expect(operations[1].diagramVersion).toBe(2);
    });

    test("hasVersion() should check if version exists for diagram", () => {
      logModel.addOperation({ ...mockOperationData, diagramVersion: 5 });

      expect(logModel.hasVersion("diagram123", 5)).toBe(true);
      expect(logModel.hasVersion("diagram123", 10)).toBe(false);
      expect(logModel.hasVersion("otherDiagram", 5)).toBe(false);
    });

    test("getOperationForVersion() should return operation for specific version", () => {
      const operation = logModel.addOperation({
        ...mockOperationData,
        diagramVersion: 3,
      });

      const foundOperation = logModel.getOperationForVersion("diagram123", 3);

      expect(foundOperation).toEqual(operation);
      expect(logModel.getOperationForVersion("diagram123", 99)).toBeUndefined();
    });

    test("cleanupOldOperations() should clean up based on versions", () => {
      // Set current version to 10
      logModel.setVersion("diagram123", 10);

      // Add operations with different versions
      for (let i = 1; i <= 10; i++) {
        logModel.addOperation({
          ...mockOperationData,
          sequenceNumber: i,
          diagramVersion: i,
        });
      }

      // Keep only last 3 versions (versions 8, 9, 10)
      const removedCount = logModel.cleanupOldOperationsByVersion(
        "diagram123",
        3
      );

      expect(removedCount).toBe(7); // Should remove versions 1-7
      const remainingOps = logModel.getOperationsByDiagram("diagram123");
      expect(remainingOps).toHaveLength(3);
      expect(remainingOps[0].diagramVersion).toBe(8);
      expect(remainingOps[1].diagramVersion).toBe(9);
      expect(remainingOps[2].diagramVersion).toBe(10);
    });

    test("getGlobalStats() should include version statistics", () => {
      logModel.setVersion("diagram123", 5);
      logModel.setVersion("diagram456", 3);

      const stats = logModel.getGlobalStats();

      expect(stats.versionsByDiagram).toEqual({
        diagram123: 5,
        diagram456: 3,
      });
      expect(stats.averageVersionsPerDiagram).toBe(4);
    });
  });
});
