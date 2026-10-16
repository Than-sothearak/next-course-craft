import type { Adapter, AdapterUser } from "next-auth/adapters";
import { describe, expect, it, vi } from "vitest";
import { approvalAdapter } from "@/lib/auth/adapter";

vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/models/User", () => ({ User: { init: vi.fn() } }));

describe("OAuth registration persistence", () => {
  it.each(["Google", "GitHub"])("registers new %s identities as pending without trusting provider authorization fields", async () => {
    const createUser = vi.fn(async (user) => ({ ...user, id: "stored-user" }));
    const adapter = approvalAdapter({ createUser } as Adapter);
    const incoming = { id: "provider-input", name: "New user", email: "Person@Example.com", emailVerified: null, role: "super_admin", status: "active" };
    await adapter.createUser!(incoming);
    expect(createUser.mock.calls[0][0]).toMatchObject({ role: "viewer", status: "pending", email: "person@example.com", createdAt: expect.any(Date), updatedAt: expect.any(Date) });
  });
  it("preserves approved roles and suspension on reauthentication", async () => {
    const existing = { id: "stored-user", name: "Old name", email: "person@example.com", role: "editor", status: "suspended", emailVerified: null };
    const updateUser = vi.fn(async (profile) => Object.assign(existing, profile));
    const adapter = approvalAdapter({ updateUser } as Adapter);
    await adapter.updateUser!({ id: existing.id, name: "Updated name", role: "super_admin", status: "active", permissions: ["roles.manage"] } as unknown as AdapterUser);
    expect(existing).toMatchObject({ name: "Updated name", role: "editor", status: "suspended" });
    expect(updateUser.mock.calls[0][0]).toEqual({ id: "stored-user", name: "Updated name" });
  });
});
