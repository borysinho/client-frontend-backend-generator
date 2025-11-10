import { InvitationModel } from "../../server/models/InvitationModel.js";

describe("InvitationModel", () => {
  let invitationModel: InvitationModel;

  beforeEach(() => {
    invitationModel = new InvitationModel();
  });

  describe("create()", () => {
    test("should create a new invitation with pending status and timestamps", () => {
      const invitationData = {
        diagramId: "diagram123",
        creatorId: "user456",
        inviteeEmail: "invitee@example.com",
        message: "Please join my diagram",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      };

      const invitation = invitationModel.create(invitationData);

      expect(invitation).toBeDefined();
      expect(invitation.id).toMatch(/^invitation_\d+_[a-z0-9]+$/);
      expect(invitation.diagramId).toBe(invitationData.diagramId);
      expect(invitation.creatorId).toBe(invitationData.creatorId);
      expect(invitation.inviteeEmail).toBe(invitationData.inviteeEmail);
      expect(invitation.message).toBe(invitationData.message);
      expect(invitation.expiresAt).toEqual(invitationData.expiresAt);
      expect(invitation.status).toBe("pending");
      expect(invitation.createdAt).toBeInstanceOf(Date);
      expect(invitation.updatedAt).toBeInstanceOf(Date);
      expect(invitation.acceptedAt).toBeUndefined();
      expect(invitation.rejectedAt).toBeUndefined();
    });

    test("should create invitation without optional fields", () => {
      const invitationData = {
        diagramId: "diagram123",
        creatorId: "user456",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const invitation = invitationModel.create(invitationData);

      expect(invitation.message).toBeUndefined();
      expect(invitation.inviteeId).toBeUndefined();
    });
  });

  describe("findById()", () => {
    test("should return invitation when found", () => {
      const createdInvitation = invitationModel.create({
        diagramId: "diagram123",
        creatorId: "user456",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(),
      });

      const foundInvitation = invitationModel.findById(createdInvitation.id);

      expect(foundInvitation).toEqual(createdInvitation);
    });

    test("should return undefined when invitation not found", () => {
      const foundInvitation = invitationModel.findById("nonexistent");

      expect(foundInvitation).toBeUndefined();
    });
  });

  describe("findByDiagramId()", () => {
    test("should return all invitations for a diagram", () => {
      const invitation1 = invitationModel.create({
        diagramId: "diagram123",
        creatorId: "user1",
        inviteeEmail: "invitee1@example.com",
        expiresAt: new Date(),
      });

      const invitation2 = invitationModel.create({
        diagramId: "diagram123",
        creatorId: "user2",
        inviteeEmail: "invitee2@example.com",
        expiresAt: new Date(),
      });

      const invitation3 = invitationModel.create({
        diagramId: "diagram456",
        creatorId: "user3",
        inviteeEmail: "invitee3@example.com",
        expiresAt: new Date(),
      });

      const foundInvitations = invitationModel.findByDiagramId("diagram123");

      expect(foundInvitations).toHaveLength(2);
      expect(foundInvitations).toContain(invitation1);
      expect(foundInvitations).toContain(invitation2);
      expect(foundInvitations).not.toContain(invitation3);
    });

    test("should return empty array when no invitations for diagram", () => {
      const foundInvitations = invitationModel.findByDiagramId("nonexistent");

      expect(foundInvitations).toEqual([]);
    });
  });

  describe("findByCreatorId()", () => {
    test("should return all invitations created by a user", () => {
      const invitation1 = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user123",
        inviteeEmail: "invitee1@example.com",
        expiresAt: new Date(),
      });

      const invitation2 = invitationModel.create({
        diagramId: "diagram2",
        creatorId: "user123",
        inviteeEmail: "invitee2@example.com",
        expiresAt: new Date(),
      });

      const invitation3 = invitationModel.create({
        diagramId: "diagram3",
        creatorId: "user456",
        inviteeEmail: "invitee3@example.com",
        expiresAt: new Date(),
      });

      const foundInvitations = invitationModel.findByCreatorId("user123");

      expect(foundInvitations).toHaveLength(2);
      expect(foundInvitations).toContain(invitation1);
      expect(foundInvitations).toContain(invitation2);
    });
  });

  describe("findByInviteeEmail()", () => {
    test("should return all invitations for an email", () => {
      const invitation1 = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "test@example.com",
        expiresAt: new Date(),
      });

      const invitation2 = invitationModel.create({
        diagramId: "diagram2",
        creatorId: "user2",
        inviteeEmail: "test@example.com",
        expiresAt: new Date(),
      });

      const foundInvitations =
        invitationModel.findByInviteeEmail("test@example.com");

      expect(foundInvitations).toHaveLength(2);
      expect(foundInvitations).toContain(invitation1);
      expect(foundInvitations).toContain(invitation2);
    });
  });

  describe("findPendingByEmail()", () => {
    test("should return only pending invitations for an email", () => {
      const pendingInvitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "test@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const acceptedInvitation = invitationModel.create({
        diagramId: "diagram2",
        creatorId: "user2",
        inviteeEmail: "test@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      invitationModel.accept(acceptedInvitation.id, "user123");

      const foundInvitations =
        invitationModel.findPendingByEmail("test@example.com");

      expect(foundInvitations).toHaveLength(1);
      expect(foundInvitations[0]).toEqual(pendingInvitation);
    });
  });

  describe("accept()", () => {
    test("should accept pending invitation and set timestamps", () => {
      const invitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const acceptedInvitation = invitationModel.accept(
        invitation.id,
        "user123"
      );

      expect(acceptedInvitation).toBeDefined();
      expect(acceptedInvitation!.status).toBe("accepted");
      expect(acceptedInvitation!.inviteeId).toBe("user123");
      expect(acceptedInvitation!.acceptedAt).toBeInstanceOf(Date);
      expect(acceptedInvitation!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        invitation.createdAt.getTime()
      );
    });

    test("should return undefined when accepting non-pending invitation", () => {
      const invitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      invitationModel.accept(invitation.id, "user123"); // Accept first
      const result = invitationModel.accept(invitation.id, "user456"); // Try to accept again

      expect(result).toBeUndefined();
    });

    test("should return undefined when accepting non-existent invitation", () => {
      const result = invitationModel.accept("nonexistent", "user123");

      expect(result).toBeUndefined();
    });
  });

  describe("reject()", () => {
    test("should reject pending invitation and set timestamp", () => {
      const invitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const rejectedInvitation = invitationModel.reject(invitation.id);

      expect(rejectedInvitation).toBeDefined();
      expect(rejectedInvitation!.status).toBe("rejected");
      expect(rejectedInvitation!.rejectedAt).toBeInstanceOf(Date);
      expect(rejectedInvitation!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        invitation.createdAt.getTime()
      );
    });

    test("should return undefined when rejecting non-pending invitation", () => {
      const invitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      invitationModel.reject(invitation.id); // Reject first
      const result = invitationModel.reject(invitation.id); // Try to reject again

      expect(result).toBeUndefined();
    });
  });

  describe("expire()", () => {
    test("should expire pending invitation", () => {
      const invitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const expiredInvitation = invitationModel.expire(invitation.id);

      expect(expiredInvitation).toBeDefined();
      expect(expiredInvitation!.status).toBe("expired");
      expect(expiredInvitation!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        invitation.createdAt.getTime()
      );
    });

    test("should return undefined when expiring non-pending invitation", () => {
      const invitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      invitationModel.accept(invitation.id, "user123"); // Accept first
      const result = invitationModel.expire(invitation.id); // Try to expire

      expect(result).toBeUndefined();
    });
  });

  describe("update()", () => {
    test("should update invitation fields", () => {
      const invitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(),
      });

      const updatedInvitation = invitationModel.update(invitation.id, {
        message: "Updated message",
        inviteeId: "user123",
      });

      expect(updatedInvitation).toBeDefined();
      expect(updatedInvitation!.message).toBe("Updated message");
      expect(updatedInvitation!.inviteeId).toBe("user123");
      expect(updatedInvitation!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        invitation.createdAt.getTime()
      );
    });

    test("should return undefined when updating non-existent invitation", () => {
      const result = invitationModel.update("nonexistent", {
        message: "New message",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("delete()", () => {
    test("should delete existing invitation", () => {
      const invitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(),
      });

      const deleteResult = invitationModel.delete(invitation.id);

      expect(deleteResult).toBe(true);
      expect(invitationModel.findById(invitation.id)).toBeUndefined();
    });

    test("should return false when deleting non-existent invitation", () => {
      const deleteResult = invitationModel.delete("nonexistent");

      expect(deleteResult).toBe(false);
    });
  });

  describe("getAll()", () => {
    test("should return all invitations", () => {
      const invitation1 = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee1@example.com",
        expiresAt: new Date(),
      });

      const invitation2 = invitationModel.create({
        diagramId: "diagram2",
        creatorId: "user2",
        inviteeEmail: "invitee2@example.com",
        expiresAt: new Date(),
      });

      const allInvitations = invitationModel.getAll();

      expect(allInvitations).toHaveLength(2);
      expect(allInvitations).toContain(invitation1);
      expect(allInvitations).toContain(invitation2);
    });
  });

  describe("cleanupExpired()", () => {
    test("should expire pending invitations that have passed their expiration date", () => {
      const expiredInvitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      const activeInvitation = invitationModel.create({
        diagramId: "diagram2",
        creatorId: "user2",
        inviteeEmail: "invitee2@example.com",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Not expired
      });

      const cleanedCount = invitationModel.cleanupExpired();

      expect(cleanedCount).toBe(1);

      const expired = invitationModel.findById(expiredInvitation.id);
      const active = invitationModel.findById(activeInvitation.id);

      expect(expired!.status).toBe("expired");
      expect(active!.status).toBe("pending");
    });

    test("should not expire non-pending invitations", () => {
      const acceptedInvitation = invitationModel.create({
        diagramId: "diagram1",
        creatorId: "user1",
        inviteeEmail: "invitee@example.com",
        expiresAt: new Date(Date.now() - 1000), // Already expired but accepted
      });
      invitationModel.accept(acceptedInvitation.id, "user123");

      const cleanedCount = invitationModel.cleanupExpired();

      expect(cleanedCount).toBe(0);
      expect(invitationModel.findById(acceptedInvitation.id)!.status).toBe(
        "accepted"
      );
    });
  });
});
