import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { Course, Slide, User } from "../models";
import { getCourseAuthorName } from "../lib/editor/services/course";
import { createCourse } from "../lib/dashboard/services/courses";
import { resolveDashboardAccess } from "../lib/workspaces/access";

vi.mock("../models", () => ({
  Asset: {},
  Course: { findOne: vi.fn(), create: vi.fn(), deleteOne: vi.fn() },
  Folder: { exists: vi.fn() },
  Lesson: {},
  Slide: { create: vi.fn() },
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
      editorType: "slide",
    } as never);
    vi.mocked(Slide.create).mockResolvedValue({} as never);

    await createCourse(creatorId, {
      title: "Shared course",
      editorType: "slide",
      description: "",
      coverImage: null,
      folderId: null,
      workspaceId: "507f1f77bcf86cd799439014",
    });

    expect(Course.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: new Types.ObjectId(ownerId),
      createdBy: new Types.ObjectId(creatorId),
      workspaceId: "507f1f77bcf86cd799439014",
      editorType: "slide",
    }));
    expect(Slide.create).toHaveBeenCalledWith(expect.objectContaining({
      courseId: "507f1f77bcf86cd799439015",
      title: "Welcome",
      schemaVersion: 3,
      composition: expect.objectContaining({ layers: [expect.objectContaining({ kind: "template", content: expect.objectContaining({ slots: expect.objectContaining({ title: { type: "text", content: "Shared course" } }) }) })] }),
      order: 0,
      width: 1280,
      height: 720,
    }));
  });
});
