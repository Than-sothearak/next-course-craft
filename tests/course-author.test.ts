import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { Course, Lesson, User } from "../models";
import { getCourseAuthorName } from "../lib/editor/services/course";
import { createCourse } from "../lib/dashboard/services/courses";
import { resolveDashboardAccess } from "../lib/workspaces/access";

vi.mock("../models", () => ({
  Asset: {},
  Course: { findOne: vi.fn(), create: vi.fn(), deleteOne: vi.fn() },
  Folder: { exists: vi.fn() },
  Lesson: { create: vi.fn(), deleteMany: vi.fn() },
  User: { findById: vi.fn() },
}));
vi.mock("../lib/workspaces/access", () => ({ resolveDashboardAccess: vi.fn() }));

const ownerId = "507f1f77bcf86cd799439011";
const creatorId = "507f1f77bcf86cd799439012";
const courseId = "507f1f77bcf86cd799439013";

function mockCourse(course: { createdBy?: string | null; ownerId: string } | null) {
  vi.mocked(Course.findOne).mockReturnValue({
    select: () => ({ lean: async () => course }),
  } as never);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("course author name", () => {
  it("creates a slide presentation with an owned first slide", async () => {
    vi.mocked(resolveDashboardAccess).mockResolvedValue({ ownerId, workspaceId: null } as never);
    vi.mocked(Course.create).mockResolvedValue({ _id: courseId, title: "Presentation", folderId: null, status: "draft" } as never);
    const result = await createCourse(creatorId, {
      title: "Presentation", description: "", folderId: null, workspaceId: null, courseLayout: "slides",
    });
    expect(Course.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: new Types.ObjectId(ownerId), courseLayout: "slides",
      sections: [expect.objectContaining({ title: "Slides" })],
    }));
    expect(Lesson.create).toHaveBeenCalledWith(expect.objectContaining({
      courseId, editorId: result.firstSlideId, sectionId: expect.any(String), title: "Slide 1", blocks: [],
    }));
    expect(result.firstSlideId).toMatch(/^[a-f\d]{24}$/);
  });

  it("removes a partially created presentation if its first slide cannot be saved", async () => {
    vi.mocked(resolveDashboardAccess).mockResolvedValue({ ownerId, workspaceId: null } as never);
    vi.mocked(Course.create).mockResolvedValue({ _id: courseId, title: "Presentation", folderId: null, status: "draft" } as never);
    vi.mocked(Lesson.create).mockRejectedValueOnce(new Error("Slide write failed"));
    await expect(createCourse(creatorId, {
      title: "Presentation", description: "", folderId: null, workspaceId: null, courseLayout: "slides",
    })).rejects.toThrow("Slide write failed");
    expect(Lesson.deleteMany).toHaveBeenCalledWith({ courseId });
    expect(Course.deleteOne).toHaveBeenCalledWith({ _id: courseId, ownerId: new Types.ObjectId(ownerId) });
  });

  it("uses the account that created the course", async () => {
    mockCourse({ createdBy: creatorId, ownerId });
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: async () => ({ name: "  Course Creator  ", email: "creator@example.com" }) }),
    } as never);

    await expect(getCourseAuthorName(ownerId, courseId)).resolves.toBe("Course Creator");
    expect(User.findById).toHaveBeenCalledWith(creatorId);
  });

  it("falls back to the owner for courses created before creator tracking", async () => {
    mockCourse({ ownerId });
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: async () => ({ name: "Workspace Owner", email: "owner@example.com" }) }),
    } as never);

    await expect(getCourseAuthorName(ownerId, courseId)).resolves.toBe("Workspace Owner");
    expect(User.findById).toHaveBeenCalledWith(ownerId);
  });

  it("stores the signed-in creator separately from the shared workspace owner", async () => {
    vi.mocked(resolveDashboardAccess).mockResolvedValue({
      ownerId,
      workspaceId: "507f1f77bcf86cd799439014",
      workspaceName: "Team",
      role: "editor",
    } as never);
    vi.mocked(Course.create).mockResolvedValue({
      _id: "507f1f77bcf86cd799439015",
      title: "Shared course",
      folderId: null,
      status: "draft",
    } as never);

    await createCourse(creatorId, {
      title: "Shared course",
      description: "",
      coverImage: null,
      folderId: null,
      workspaceId: "507f1f77bcf86cd799439014",
    });

    expect(Course.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: new Types.ObjectId(ownerId),
      createdBy: new Types.ObjectId(creatorId),
      workspaceId: "507f1f77bcf86cd799439014",
    }));
  });
});
