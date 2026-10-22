import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), connection: vi.fn(), cookies: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), connection: mocks.connection }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "507f1f77bcf86cd799439012" } });
});

describe("session resolution in private cache scopes", () => {
  it("keeps ordinary authentication behind connection()", async () => {
    await requireAuthenticatedUser();
    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.cookies).not.toHaveBeenCalled();
  });

  it("reads request cookies before Auth.js when prefetching is allowed", async () => {
    await requireAuthenticatedUser({ allowPrefetch: true });
    expect(mocks.cookies).toHaveBeenCalledOnce();
    expect(mocks.connection).not.toHaveBeenCalled();
    expect(mocks.cookies.mock.invocationCallOrder[0]).toBeLessThan(mocks.auth.mock.invocationCallOrder[0]);
  });

  it.each([null, { user: { id: "invalid" } }])("still rejects an invalid session: %j", async (session) => {
    mocks.auth.mockResolvedValue(session);
    await expect(requireAuthenticatedUser({ allowPrefetch: true })).rejects.toMatchObject({ status: 401 });
  });
});
