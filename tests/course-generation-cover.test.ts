import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareOutlineCover } from "@/lib/ai/generation/session-cover";
import { Course } from "@/models/Course";
import { CourseGenerationSession } from "@/models/CourseGenerationSession";
import { assertCourseCoverAsset } from "@/lib/editor/services/course-cover";
import { createGeneratedImageAsset } from "@/lib/ai/generation/images";
import { courseCoverSchema } from "@/lib/editor/course-cover";
import { DashboardError } from "@/lib/dashboard/rules";
import type { CourseOutline } from "@/lib/ai/course-generation-session-schema";
vi.mock("@/models/Course", () => ({ Course: { findOne: vi.fn() } }));
vi.mock("@/models/CourseGenerationSession", () => ({ CourseGenerationSession: { findOne: vi.fn() } }));
vi.mock("@/lib/editor/services/course-cover", () => ({ assertCourseCoverAsset: vi.fn() }));
vi.mock("@/lib/ai/generation/images", () => ({ createGeneratedImageAsset: vi.fn() }));
const ownerId = "owner", courseId = "course", src = "/api/assets/507f1f77bcf86cd799439013/file";
const outline: CourseOutline = { title: "HTML basics", description: "Learn HTML", sections: [{ id: "learn", title: "Learn", lessons: [{ id: "lesson", title: "HTML", objective: "Build a page", kind: "learn" }] }] };
const cover = courseCoverSchema.parse({ template: "image", imageSrc: src, titleOnly: true });
function currentCourse(value: object) { vi.mocked(Course.findOne).mockReturnValue({ select: () => ({ lean: async () => value }) } as never); }
beforeEach(() => {
  vi.clearAllMocks();
  currentCourse({ theme: {} });
  vi.mocked(CourseGenerationSession.findOne).mockReturnValue({ sort: async () => null } as never);
  vi.mocked(createGeneratedImageAsset).mockResolvedValue({ id: "507f1f77bcf86cd799439013", src });
  vi.mocked(assertCourseCoverAsset).mockResolvedValue(undefined);
});
describe("course cover preparation during outline generation", () => {
  it("generates a card image when the course card has no image", async () => {
    const result = await prepareOutlineCover(ownerId, courseId, outline);
    expect(result).toMatchObject({ generatedCover: true, cover: { imageSrc: src } });
    expect(createGeneratedImageAsset).toHaveBeenCalledWith(ownerId, courseId, expect.stringContaining("HTML basics"), { purpose: "course-cover" });
  });
  it("can generate a missing card image independently of an existing learner cover", async () => {
    currentCourse({ theme: { cover } });
    const result = await prepareOutlineCover(ownerId, courseId, outline);
    expect(result.generatedCover).toBe(true);
    expect(result.cover?.titleOnly).toBeUndefined();
    expect(createGeneratedImageAsset).toHaveBeenCalledOnce();
  });
  it("preserves an existing dashboard image even if there is no learner image", async () => {
    currentCourse({ theme: {}, coverImage: src });
    expect((await prepareOutlineCover(ownerId, courseId, outline)).generatedCover).toBe(false);
    expect(createGeneratedImageAsset).not.toHaveBeenCalled();
  });
  it("reuses a prepared cover when the author regenerates the outline", async () => {
    vi.mocked(CourseGenerationSession.findOne).mockReturnValue({ sort: async () => ({ cover }) } as never);
    expect(await prepareOutlineCover(ownerId, courseId, outline)).toEqual({ cover, generatedCover: true });
    expect(assertCourseCoverAsset).toHaveBeenCalledWith(ownerId, courseId, cover);
    expect(createGeneratedImageAsset).not.toHaveBeenCalled();
  });
  it("regenerates a missing prior asset instead of reusing a broken cover", async () => {
    vi.mocked(CourseGenerationSession.findOne).mockReturnValue({ sort: async () => ({ cover }) } as never);
    vi.mocked(assertCourseCoverAsset).mockRejectedValueOnce(new DashboardError("Missing image", 400));
    expect((await prepareOutlineCover(ownerId, courseId, outline)).generatedCover).toBe(true);
    expect(createGeneratedImageAsset).toHaveBeenCalledOnce();
  });
});
