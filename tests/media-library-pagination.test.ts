import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), sort: vi.fn(), limit: vi.fn(), lean: vi.fn() }));
vi.mock("@/models/Asset", () => ({ Asset: { find: mocks.find } }));
vi.mock("@/lib/media/service", () => ({ deleteStoredMedia: vi.fn() }));
vi.mock("@/lib/workspaces/access", () => ({ resolveCourseAccess: vi.fn() }));
import { listCourseMedia } from "@/lib/media/services/course-assets";

describe("course media pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockReturnValue({ sort: mocks.sort });
    mocks.sort.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockReturnValue({ lean: mocks.lean });
  });

  it("returns bounded owner/course-scoped pages with a stable timestamp/ID cursor", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const records = Array.from({ length: 101 }, (_, index) => ({ _id: (200 - index).toString(16).padStart(24, "0"), createdAt, originalName: `${index}.mp4`, mimeType: "video/mp4", size: 100 }));
    mocks.lean.mockResolvedValue(records);
    const page = await listCourseMedia("owner", "course");
    expect(mocks.find).toHaveBeenCalledWith({ ownerId: "owner", courseId: "course", status: "ready" });
    expect(mocks.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(mocks.limit).toHaveBeenCalledWith(101);
    expect(page.assets).toHaveLength(100);
    expect(page.nextCursor).toBe(`${createdAt.toISOString()}~${records[99]._id}`);
    expect(page.assets[0]).toMatchObject({ id: records[0]._id, fileUrl: `/api/assets/${records[0]._id}/file`, contentType: "video/mp4" });
  });

  it("uses both cursor fields to handle identical creation times without losing files", async () => {
    mocks.lean.mockResolvedValue([]);
    const cursor = { createdAt: "2026-01-01T00:00:00.000Z", id: "a".repeat(24) };
    expect(await listCourseMedia("owner", "course", cursor)).toEqual({ assets: [], nextCursor: null });
    expect(mocks.find).toHaveBeenCalledWith({ ownerId: "owner", courseId: "course", status: "ready", $or: [
      { createdAt: { $lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), _id: { $lt: cursor.id } },
    ] });
  });
});
