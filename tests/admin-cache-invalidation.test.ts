import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateAdminNavigation } from "@/app/admin/actions";

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireRole: mocks.requireRole }));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag, revalidatePath: mocks.revalidatePath }));

beforeEach(() => { vi.resetAllMocks(); });

describe("private admin cache invalidation", () => {
  it("checks current administrative access before invalidating all admin sections", async () => {
    await invalidateAdminNavigation();
    expect(mocks.requireRole).toHaveBeenCalledWith(["admin", "super_admin"]);
    expect(mocks.updateTag).toHaveBeenCalledWith("admin");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(mocks.requireRole.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateTag.mock.invocationCallOrder[0]);
  });

  it("does not invalidate navigation for an unauthorized caller", async () => {
    mocks.requireRole.mockRejectedValue(new Error("Access denied."));
    await expect(invalidateAdminNavigation()).rejects.toThrow("Access denied.");
    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
