import { UserModel } from "../../server/models/UserModel.js";

describe("UserModel", () => {
  let userModel: UserModel;

  beforeEach(() => {
    userModel = new UserModel();
  });

  describe("create()", () => {
    test("should create a new user with generated id and timestamps", () => {
      const userData = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      };

      const user = userModel.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.password).toBe(userData.password);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.createdAt.getTime()).toBe(user.updatedAt.getTime());
    });

    test("should create multiple users with unique ids", () => {
      const user1 = userModel.create({
        name: "User 1",
        email: "user1@example.com",
        password: "pass1",
      });

      const user2 = userModel.create({
        name: "User 2",
        email: "user2@example.com",
        password: "pass2",
      });

      expect(user1.id).not.toBe(user2.id);
      expect(user1.email).not.toBe(user2.email);
    });
  });

  describe("findById()", () => {
    test("should return user when found", () => {
      const createdUser = userModel.create({
        name: "Test User",
        email: "test@example.com",
        password: "testpass",
      });

      const foundUser = userModel.findById(createdUser.id);

      expect(foundUser).toEqual(createdUser);
    });

    test("should return undefined when user not found", () => {
      const foundUser = userModel.findById("nonexistent");

      expect(foundUser).toBeUndefined();
    });
  });

  describe("findByEmail()", () => {
    test("should return user when found by email", () => {
      const createdUser = userModel.create({
        name: "Email Test",
        email: "emailtest@example.com",
        password: "emailpass",
      });

      const foundUser = userModel.findByEmail("emailtest@example.com");

      expect(foundUser).toEqual(createdUser);
    });

    test("should return undefined when email not found", () => {
      const foundUser = userModel.findByEmail("notfound@example.com");

      expect(foundUser).toBeUndefined();
    });

    test("should return first user when multiple users exist", () => {
      userModel.create({
        name: "User 1",
        email: "same@example.com",
        password: "pass1",
      });

      userModel.create({
        name: "User 2",
        email: "different@example.com",
        password: "pass2",
      });

      const foundUser = userModel.findByEmail("same@example.com");

      expect(foundUser?.name).toBe("User 1");
    });
  });

  describe("update()", () => {
    test("should update user and set updatedAt timestamp", () => {
      const createdUser = userModel.create({
        name: "Original Name",
        email: "original@example.com",
        password: "originalpass",
      });

      const originalUpdatedAt = createdUser.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        const updatedUser = userModel.update(createdUser.id, {
          name: "Updated Name",
          email: "updated@example.com",
        });

        expect(updatedUser).toBeDefined();
        expect(updatedUser!.name).toBe("Updated Name");
        expect(updatedUser!.email).toBe("updated@example.com");
        expect(updatedUser!.password).toBe("originalpass"); // Unchanged
        expect(updatedUser!.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime()
        );
      }, 1);
    });

    test("should return undefined when updating non-existent user", () => {
      const updatedUser = userModel.update("nonexistent", {
        name: "New Name",
      });

      expect(updatedUser).toBeUndefined();
    });

    test("should not update id, createdAt", () => {
      const createdUser = userModel.create({
        name: "Test",
        email: "test@example.com",
        password: "test",
      });

      const updatedUser = userModel.update(createdUser.id, {
        name: "Updated",
      });

      expect(updatedUser!.name).toBe("Updated");
    });
  });

  describe("delete()", () => {
    test("should delete existing user and return true", () => {
      const createdUser = userModel.create({
        name: "Delete Test",
        email: "delete@example.com",
        password: "deletepass",
      });

      const deleteResult = userModel.delete(createdUser.id);

      expect(deleteResult).toBe(true);
      expect(userModel.findById(createdUser.id)).toBeUndefined();
    });

    test("should return false when deleting non-existent user", () => {
      const deleteResult = userModel.delete("nonexistent");

      expect(deleteResult).toBe(false);
    });
  });

  describe("getAll()", () => {
    test("should return all users", () => {
      const user1 = userModel.create({
        name: "User 1",
        email: "user1@example.com",
        password: "pass1",
      });

      const user2 = userModel.create({
        name: "User 2",
        email: "user2@example.com",
        password: "pass2",
      });

      const allUsers = userModel.getAll();

      expect(allUsers).toHaveLength(2);
      expect(allUsers).toContain(user1);
      expect(allUsers).toContain(user2);
    });

    test("should return empty array when no users exist", () => {
      const allUsers = userModel.getAll();

      expect(allUsers).toEqual([]);
    });
  });

  describe("validateCredentials()", () => {
    test("should return user when credentials are valid", () => {
      const createdUser = userModel.create({
        name: "Login Test",
        email: "login@example.com",
        password: "correctpassword",
      });

      const validatedUser = userModel.validateCredentials(
        "login@example.com",
        "correctpassword"
      );

      expect(validatedUser).toEqual(createdUser);
    });

    test("should return undefined when email is incorrect", () => {
      userModel.create({
        name: "Test",
        email: "test@example.com",
        password: "password",
      });

      const validatedUser = userModel.validateCredentials(
        "wrong@example.com",
        "password"
      );

      expect(validatedUser).toBeUndefined();
    });

    test("should return undefined when password is incorrect", () => {
      userModel.create({
        name: "Test",
        email: "test@example.com",
        password: "correctpassword",
      });

      const validatedUser = userModel.validateCredentials(
        "test@example.com",
        "wrongpassword"
      );

      expect(validatedUser).toBeUndefined();
    });

    test("should return undefined when both email and password are incorrect", () => {
      userModel.create({
        name: "Test",
        email: "test@example.com",
        password: "password",
      });

      const validatedUser = userModel.validateCredentials(
        "wrong@example.com",
        "wrongpassword"
      );

      expect(validatedUser).toBeUndefined();
    });
  });
});
