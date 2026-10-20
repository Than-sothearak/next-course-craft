import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), findById: vi.fn(), updateOne: vi.fn(), probe: vi.fn(), audit: vi.fn(), transaction: vi.fn(), validateDirectory: vi.fn(), capacity: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/models/PlatformSettings", () => ({ PlatformSettings: { findById: mocks.findById, updateOne: mocks.updateOne } }));
vi.mock("@/lib/media/service", () => ({ testStorageConnection: mocks.probe }));
vi.mock("@/lib/media/capacity", () => ({ getLocalStorageCapacity: mocks.capacity }));
vi.mock("@/lib/admin/transactions", () => ({ audit: mocks.audit, securityTransaction: mocks.transaction }));
vi.mock("@/lib/media/local-browser", async (original) => ({ ...await original<typeof import("@/lib/media/local-browser")>(), validateLocalDirectorySelection: mocks.validateDirectory }));
import { getMediaStorageSettings, updateMediaStorageSettings, testMediaStorageSettings } from "@/lib/media/settings";

const session = { id: "transaction" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({ id: "super", role: "super_admin" });
  mocks.probe.mockResolvedValue({ connected: true });
  mocks.validateDirectory.mockImplementation(async (path: string) => ({ root: "/data/coursecraft", path }));
  mocks.capacity.mockResolvedValue(null);
  mocks.findById.mockImplementation(() => {
    const query = { session: () => query, lean: async () => ({ aiEnabled: false, mediaStorageProvider: "s3", mediaStorageRevision: 3 }) };
    return query;
  });
  mocks.transaction.mockImplementation((work) => work(session));
});

describe("Super Admin storage settings", () => {
  it("tests before updating one singleton and audits the change in the same transaction", async () => {
    expect(await updateMediaStorageSettings("super", { provider: "local", revision: 3 })).toEqual({ provider: "local", revision: 4 });
    expect(mocks.requireRole).toHaveBeenNthCalledWith(1, ["super_admin"], "super", undefined);
    expect(mocks.requireRole).toHaveBeenNthCalledWith(2, ["super_admin"], "super", session);
    expect(mocks.updateOne).toHaveBeenCalledWith({ _id: "platform" }, { $set: { mediaStorageProvider: "local" }, $inc: { mediaStorageRevision: 1 } }, { upsert: true, runValidators: true, session });
    expect(mocks.probe.mock.invocationCallOrder[0]).toBeLessThan(mocks.transaction.mock.invocationCallOrder[0]);
    expect(mocks.audit).toHaveBeenCalledWith(session, expect.objectContaining({ actorId: "super", action: "settings.media-storage", metadata: { previousProvider: "s3", provider: "local" } }));
  });
  it("validates and tests a selected folder, then saves it atomically with the provider", async () => {
    await updateMediaStorageSettings("super", { provider: "local", localDirectory: "/data/coursecraft/new-folder", revision: 3 });
    expect(mocks.validateDirectory).toHaveBeenCalledWith("/data/coursecraft/new-folder");
    expect(mocks.probe).toHaveBeenCalledWith("local", "/data/coursecraft/new-folder");
    expect(mocks.updateOne).toHaveBeenCalledWith({ _id: "platform" }, { $set: { mediaStorageProvider: "local", mediaLocalDirectory: "/data/coursecraft/new-folder" }, $inc: { mediaStorageRevision: 1 } }, expect.objectContaining({ session }));
    expect(mocks.audit).toHaveBeenCalledWith(session, expect.objectContaining({ metadata: expect.objectContaining({ directory: "/data/coursecraft/new-folder" }) }));
  });
  it("tests a chosen folder without saving it", async () => {
    await testMediaStorageSettings("super", { provider: "local", localDirectory: "/data/coursecraft/new-folder" });
    expect(mocks.validateDirectory).toHaveBeenCalledOnce();
    expect(mocks.probe).toHaveBeenCalledWith("local", "/data/coursecraft/new-folder");
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it("never probes an unauthorized or out-of-bounds folder", async () => {
    mocks.validateDirectory.mockRejectedValue(new Error("Outside approved storage root"));
    await expect(updateMediaStorageSettings("super", { provider: "local", localDirectory: "/etc", revision: 3 })).rejects.toThrow("Outside approved storage root");
    expect(mocks.probe).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
    mocks.requireRole.mockRejectedValue(new Error("Access denied"));
    mocks.validateDirectory.mockClear();
    await expect(testMediaStorageSettings("admin", { provider: "local", localDirectory: "/etc" })).rejects.toThrow("Access denied");
    expect(mocks.validateDirectory).not.toHaveBeenCalled();
  });

  it("never changes settings after a failed probe", async () => {
    mocks.probe.mockRejectedValue(new Error("Disconnected"));
    await expect(updateMediaStorageSettings("super", { provider: "local", revision: 3 })).rejects.toThrow("Disconnected");
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects unauthorized actors before any probe or database update", async () => {
    mocks.requireRole.mockRejectedValue(new Error("Access denied"));
    await expect(updateMediaStorageSettings("admin", { provider: "local", revision: 3 })).rejects.toThrow("Access denied");
    expect(mocks.probe).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
    await expect(getMediaStorageSettings("admin")).rejects.toThrow("Access denied");
  });
  it("rejects concurrent stale saves without overwriting newer settings", async () => {
    await expect(updateMediaStorageSettings("super", { provider: "local", revision: 2 })).rejects.toMatchObject({ status: 409 });
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it("rechecks current authorization after the connection test", async () => {
    mocks.requireRole.mockResolvedValueOnce({ role: "super_admin" }).mockRejectedValueOnce(new Error("Account suspended"));
    await expect(updateMediaStorageSettings("super", { provider: "local", revision: 3 })).rejects.toThrow("Account suspended");
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it("returns only safe configuration, never cloud credentials", async () => {
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "never-return-this");
    vi.stubEnv("AWS_S3_BUCKET", "private-bucket");
    const result = await getMediaStorageSettings("super");
    expect(result.s3.bucket).toBe("private-bucket");
    expect(result).not.toHaveProperty("aiEnabled");
    expect(JSON.stringify(result)).not.toContain("never-return-this");
    vi.unstubAllEnvs();
  });
  it("checks the requested local folder capacity only after Super Admin authorization and folder validation", async () => {
    mocks.capacity.mockResolvedValue({ totalBytes: 1_000_000_000, freeBytes: 250_000_000 });
    const result = await getMediaStorageSettings("super", "/data/coursecraft/new-folder");
    expect(mocks.validateDirectory).toHaveBeenCalledWith("/data/coursecraft/new-folder");
    expect(mocks.capacity).toHaveBeenCalledWith("/data/coursecraft/new-folder");
    expect(result.local.capacity).toEqual({ totalBytes: 1_000_000_000, freeBytes: 250_000_000 });
    expect(mocks.requireRole.mock.invocationCallOrder[0]).toBeLessThan(mocks.validateDirectory.mock.invocationCallOrder[0]);
  });
  it("rejects unrecognized providers, credentials, and missing revision", async () => {
    for (const input of [{ provider: "other", revision: 3 }, { provider: "s3", revision: 3, secret: "bad" }, { provider: "s3" }]) {
      await expect(updateMediaStorageSettings("super", input)).rejects.toThrow();
    }
    expect(mocks.probe).not.toHaveBeenCalled();
  });
});
