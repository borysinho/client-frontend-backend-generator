import { DiagramSnapshotModel } from "../../server/models/DiagramSnapshotModel.js";
import { type DiagramState } from "../../server/models/DiagramModel.js";

describe("DiagramSnapshotModel", () => {
  let snapshotModel: DiagramSnapshotModel;

  const mockState: DiagramState = {
    elements: {
      class1: {
        id: "class1",
        className: "TestClass",
        attributes: ["name: string"],
        methods: ["getName(): string"],
        elementType: "class",
        position: { x: 100, y: 100 },
      },
    },
    relationships: {},
    version: 1,
    lastModified: Date.now(),
  };

  beforeEach(() => {
    snapshotModel = new DiagramSnapshotModel();
  });

  describe("create()", () => {
    test("should create a new snapshot with default values", () => {
      const snapshotData = {
        diagramId: "diagram123",
        name: "Test Diagram",
        description: "A test diagram",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: ["test", "uml"],
      };

      const snapshot = snapshotModel.create(snapshotData);

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toMatch(/^snapshot_\d+_[a-z0-9]+$/);
      expect(snapshot.diagramId).toBe(snapshotData.diagramId);
      expect(snapshot.name).toBe(snapshotData.name);
      expect(snapshot.description).toBe(snapshotData.description);
      expect(snapshot.creatorId).toBe(snapshotData.creatorId);
      expect(snapshot.collaborators).toEqual(snapshotData.collaborators);
      expect(snapshot.state).toEqual(snapshotData.state);
      expect(snapshot.version).toBe(1);
      expect(snapshot.isPublic).toBe(snapshotData.isPublic);
      expect(snapshot.tags).toEqual(snapshotData.tags);
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.updatedAt).toBeInstanceOf(Date);
      expect(snapshot.lastActivityAt).toBeInstanceOf(Date);
    });

    test("should create snapshot without optional fields", () => {
      const snapshotData = {
        diagramId: "diagram123",
        name: "Test Diagram",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      };

      const snapshot = snapshotModel.create(snapshotData);

      expect(snapshot.description).toBeUndefined();
      expect(snapshot.thumbnail).toBeUndefined();
    });
  });

  describe("createVersion()", () => {
    test("should create a new version of existing diagram", () => {
      // Create initial snapshot
      const initialSnapshot = snapshotModel.create({
        diagramId: "diagram123",
        name: "Test Diagram",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      // Create new version
      const newState = { ...mockState, version: 2, lastModified: Date.now() };
      const newVersion = snapshotModel.createVersion("diagram123", newState);

      expect(newVersion).toBeDefined();
      expect(newVersion!.version).toBe(2);
      expect(newVersion!.state).toEqual(newState);
      expect(newVersion!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialSnapshot.createdAt.getTime()
      );
      expect(newVersion!.lastActivityAt.getTime()).toBeGreaterThanOrEqual(
        initialSnapshot.createdAt.getTime()
      );
    });

    test("should return undefined when diagram does not exist", () => {
      const newState = { ...mockState, version: 2 };
      const result = snapshotModel.createVersion("nonexistent", newState);

      expect(result).toBeUndefined();
    });
  });

  describe("findById()", () => {
    test("should return snapshot when found", () => {
      const createdSnapshot = snapshotModel.create({
        diagramId: "diagram123",
        name: "Test Diagram",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const foundSnapshot = snapshotModel.findById(createdSnapshot.id);

      expect(foundSnapshot).toEqual(createdSnapshot);
    });

    test("should return undefined when snapshot not found", () => {
      const foundSnapshot = snapshotModel.findById("nonexistent");

      expect(foundSnapshot).toBeUndefined();
    });
  });

  describe("getLatestByDiagramId()", () => {
    test("should return the latest snapshot for a diagram", () => {
      // Create first snapshot
      const snapshot1 = snapshotModel.create({
        diagramId: "diagram123",
        name: "Test Diagram v1",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      // Create second version
      const newState = { ...mockState, version: 2 };
      snapshotModel.createVersion("diagram123", newState);

      const latest = snapshotModel.getLatestByDiagramId("diagram123");

      expect(latest).toBeDefined();
      expect(latest!.version).toBe(2);
      expect(latest!.name).toBe(snapshot1.name); // Should preserve metadata
    });

    test("should return undefined when diagram has no snapshots", () => {
      const latest = snapshotModel.getLatestByDiagramId("nonexistent");

      expect(latest).toBeUndefined();
    });
  });

  describe("getAllByDiagramId()", () => {
    test("should return all snapshots for a diagram", () => {
      // Create first snapshot
      const snapshot1 = snapshotModel.create({
        diagramId: "diagram123",
        name: "Test Diagram",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      // Create versions
      snapshotModel.createVersion("diagram123", { ...mockState, version: 2 });
      snapshotModel.createVersion("diagram123", { ...mockState, version: 3 });

      const allSnapshots = snapshotModel.getAllByDiagramId("diagram123");

      expect(allSnapshots).toHaveLength(1); // Only the latest version is stored
      expect(allSnapshots[0].version).toBe(3);
    });
  });

  describe("findByCreatorId()", () => {
    test("should return all snapshots created by a user", () => {
      const snapshot1 = snapshotModel.create({
        diagramId: "diagram1",
        name: "Diagram 1",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const snapshot2 = snapshotModel.create({
        diagramId: "diagram2",
        name: "Diagram 2",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const snapshot3 = snapshotModel.create({
        diagramId: "diagram3",
        name: "Diagram 3",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const foundSnapshots = snapshotModel.findByCreatorId("user123");

      expect(foundSnapshots).toHaveLength(2);
      expect(foundSnapshots).toContain(snapshot1);
      expect(foundSnapshots).toContain(snapshot2);
      expect(foundSnapshots).not.toContain(snapshot3);
    });
  });

  describe("findByCollaboratorId()", () => {
    test("should return snapshots where user is a collaborator", () => {
      const snapshot1 = snapshotModel.create({
        diagramId: "diagram1",
        name: "Diagram 1",
        creatorId: "user123",
        collaborators: ["user123", "user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const snapshot2 = snapshotModel.create({
        diagramId: "diagram2",
        name: "Diagram 2",
        creatorId: "user789",
        collaborators: ["user789", "user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const foundSnapshots = snapshotModel.findByCollaboratorId("user456");

      expect(foundSnapshots).toHaveLength(2);
      expect(foundSnapshots).toContain(snapshot1);
      expect(foundSnapshots).toContain(snapshot2);
    });
  });

  describe("findPublic()", () => {
    test("should return only public snapshots", () => {
      const publicSnapshot = snapshotModel.create({
        diagramId: "diagram1",
        name: "Public Diagram",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: true,
        tags: [],
      });

      snapshotModel.create({
        diagramId: "diagram2",
        name: "Private Diagram",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const publicSnapshots = snapshotModel.findPublic();

      expect(publicSnapshots).toHaveLength(1);
      expect(publicSnapshots[0]).toEqual(publicSnapshot);
    });
  });

  describe("findByTag()", () => {
    test("should return snapshots containing the specified tag", () => {
      const snapshot1 = snapshotModel.create({
        diagramId: "diagram1",
        name: "Diagram 1",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: ["uml", "design"],
      });

      const snapshot2 = snapshotModel.create({
        diagramId: "diagram2",
        name: "Diagram 2",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: ["database", "design"],
      });

      const foundSnapshots = snapshotModel.findByTag("design");

      expect(foundSnapshots).toHaveLength(2);
      expect(foundSnapshots).toContain(snapshot1);
      expect(foundSnapshots).toContain(snapshot2);
    });
  });

  describe("searchByName()", () => {
    test("should return snapshots with names containing the search term", () => {
      const snapshot1 = snapshotModel.create({
        diagramId: "diagram1",
        name: "User Management System",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      snapshotModel.create({
        diagramId: "diagram2",
        name: "Product Catalog",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const foundSnapshots = snapshotModel.searchByName("System");

      expect(foundSnapshots).toHaveLength(1);
      expect(foundSnapshots[0]).toEqual(snapshot1);
    });

    test("should be case insensitive", () => {
      const snapshot = snapshotModel.create({
        diagramId: "diagram1",
        name: "User Management System",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const foundSnapshots = snapshotModel.searchByName("system");

      expect(foundSnapshots).toHaveLength(1);
      expect(foundSnapshots[0]).toEqual(snapshot);
    });
  });

  describe("updateMetadata()", () => {
    test("should update snapshot metadata", () => {
      const snapshot = snapshotModel.create({
        diagramId: "diagram1",
        name: "Old Name",
        description: "Old description",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: ["old"],
      });

      const updatedSnapshot = snapshotModel.updateMetadata(snapshot.id, {
        name: "New Name",
        description: "New description",
        tags: ["new", "updated"],
        isPublic: true,
      });

      expect(updatedSnapshot).toBeDefined();
      expect(updatedSnapshot!.name).toBe("New Name");
      expect(updatedSnapshot!.description).toBe("New description");
      expect(updatedSnapshot!.tags).toEqual(["new", "updated"]);
      expect(updatedSnapshot!.isPublic).toBe(true);
      expect(updatedSnapshot!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        snapshot.createdAt.getTime()
      );
      expect(updatedSnapshot!.id).toBe(snapshot.id);
    });

    test("should return undefined when updating non-existent snapshot", () => {
      const result = snapshotModel.updateMetadata("nonexistent", {
        name: "New Name",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("addCollaborator()", () => {
    test("should add collaborator to diagram", () => {
      snapshotModel.create({
        diagramId: "diagram1",
        name: "Test Diagram",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const result = snapshotModel.addCollaborator("diagram1", "user456");

      expect(result).toBe(true);
      const updatedSnapshot = snapshotModel.getLatestByDiagramId("diagram1");
      expect(updatedSnapshot!.collaborators).toContain("user456");
    });

    test("should not add duplicate collaborator", () => {
      const snapshot = snapshotModel.create({
        diagramId: "diagram1",
        name: "Test Diagram",
        creatorId: "user123",
        collaborators: ["user123", "user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const result = snapshotModel.addCollaborator("diagram1", "user456");

      expect(result).toBe(false);
      const updatedSnapshot = snapshotModel.getLatestByDiagramId("diagram1");
      expect(updatedSnapshot!.collaborators).toEqual(["user123", "user456"]);
    });

    test("should return false when diagram does not exist", () => {
      const result = snapshotModel.addCollaborator("nonexistent", "user456");

      expect(result).toBe(false);
    });
  });

  describe("removeCollaborator()", () => {
    test("should remove collaborator from diagram", () => {
      snapshotModel.create({
        diagramId: "diagram1",
        name: "Test Diagram",
        creatorId: "user123",
        collaborators: ["user123", "user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const result = snapshotModel.removeCollaborator("diagram1", "user456");

      expect(result).toBe(true);
      const updatedSnapshot = snapshotModel.getLatestByDiagramId("diagram1");
      expect(updatedSnapshot!.collaborators).toEqual(["user123"]);
    });

    test("should return false when collaborator not found", () => {
      const snapshot = snapshotModel.create({
        diagramId: "diagram1",
        name: "Test Diagram",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const result = snapshotModel.removeCollaborator("diagram1", "user456");

      expect(result).toBe(false);
    });
  });

  describe("updateLastActivity()", () => {
    test("should update last activity timestamp", () => {
      snapshotModel.create({
        diagramId: "diagram1",
        name: "Test Diagram",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const result = snapshotModel.updateLastActivity("diagram1");

      expect(result).toBe(true);
      const updatedSnapshot = snapshotModel.getLatestByDiagramId("diagram1");
      expect(updatedSnapshot!.lastActivityAt.getTime()).toBeGreaterThanOrEqual(
        Date.now() - 1000
      ); // Within last second
    });

    test("should return false when diagram does not exist", () => {
      const result = snapshotModel.updateLastActivity("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("delete()", () => {
    test("should delete all snapshots of a diagram", () => {
      snapshotModel.create({
        diagramId: "diagram1",
        name: "Test Diagram",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const deleteResult = snapshotModel.delete("diagram1");

      expect(deleteResult).toBe(true);
      expect(snapshotModel.getLatestByDiagramId("diagram1")).toBeUndefined();
      expect(snapshotModel.getAllByDiagramId("diagram1")).toHaveLength(0);
    });

    test("should return false when diagram does not exist", () => {
      const deleteResult = snapshotModel.delete("nonexistent");

      expect(deleteResult).toBe(false);
    });
  });

  describe("getStats()", () => {
    test("should return correct statistics", () => {
      // Create some test data
      snapshotModel.create({
        diagramId: "diagram1",
        name: "Public Diagram",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: true,
        tags: [],
      });

      snapshotModel.create({
        diagramId: "diagram2",
        name: "Private Diagram",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const stats = snapshotModel.getStats();

      expect(stats.totalDiagrams).toBe(2);
      expect(stats.totalSnapshots).toBe(2);
      expect(stats.publicDiagrams).toBe(1);
      expect(stats.averageVersionsPerDiagram).toBe(1);
    });

    test("should return zero statistics when no snapshots", () => {
      const stats = snapshotModel.getStats();

      expect(stats.totalDiagrams).toBe(0);
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.publicDiagrams).toBe(0);
      expect(stats.averageVersionsPerDiagram).toBe(0);
    });
  });

  describe("getAll()", () => {
    test("should return all snapshots", () => {
      const snapshot1 = snapshotModel.create({
        diagramId: "diagram1",
        name: "Diagram 1",
        creatorId: "user123",
        collaborators: ["user123"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const snapshot2 = snapshotModel.create({
        diagramId: "diagram2",
        name: "Diagram 2",
        creatorId: "user456",
        collaborators: ["user456"],
        state: mockState,
        isPublic: false,
        tags: [],
      });

      const allSnapshots = snapshotModel.getAll();

      expect(allSnapshots).toHaveLength(2);
      expect(allSnapshots).toContain(snapshot1);
      expect(allSnapshots).toContain(snapshot2);
    });
  });
});
