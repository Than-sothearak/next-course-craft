import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { migrationFields } from "../scripts/migrate-user-approval.mjs";

describe("existing account approval migration", () => {
  it("maps legacy authors to pending editors without changing account identity or course ownership", () => {
    const _id = new ObjectId();
    const user = { _id, role: "author", email: "Old@Example.com" };
    const changes = migrationFields(user);
    expect(changes).toMatchObject({ role: "editor", legacyRole: "author", status: "pending", email: "old@example.com" });
    expect(changes).not.toHaveProperty("_id");
    expect(changes).not.toHaveProperty("ownerId");
    expect(user).toEqual({ _id, role: "author", email: "Old@Example.com" });
  });
  it("preserves explicit active/suspended states and is idempotent for migrated accounts", () => {
    const now = new Date();
    for (const status of ["active", "suspended", "rejected", "pending"]) {
      expect(migrationFields({ _id: new ObjectId(), role: "admin", status, email: "old@example.com", createdAt: now, updatedAt: now })).toEqual({});
    }
  });
});
