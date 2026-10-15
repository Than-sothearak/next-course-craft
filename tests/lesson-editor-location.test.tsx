import { beforeEach, describe, expect, it, vi } from "vitest";
import LessonEditPage from "../app/courses/[courseId]/edit/lessons/[lessonId]/page";

const { auth, getCourseEditor, notFound } = vi.hoisted(() => ({ auth: vi.fn(), getCourseEditor: vi.fn(), notFound: vi.fn(() => { throw new Error("Not found"); }) }));
vi.mock("../lib/auth", () => ({ auth }));
vi.mock("../lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("../lib/editor/services/course", () => ({ getCourseEditor }));
vi.mock("next/navigation", () => ({ notFound, redirect: () => { throw new Error("Login required"); } }));
vi.mock("../app/courses/[courseId]/edit/_components/editor-client", () => ({ EditorClient: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "owner-1", name: "Author" } });
  getCourseEditor.mockResolvedValue({
    courseId: "course-1", lessons: [
      { id: "lesson-1", blocks: [{ id: "block-1" }] },
      { id: "lesson-2", blocks: [{ id: "block-2" }] },
    ],
  });
});

describe("lesson editor block location", () => {
  it("passes a block in the requested lesson to the editor after loading the owner's course", async () => {
    const result = await LessonEditPage({
      params: Promise.resolve({ courseId: "course-1", lessonId: "lesson-2" }),
      searchParams: Promise.resolve({ blockId: "block-2" }),
    });
    expect(getCourseEditor).toHaveBeenCalledWith("owner-1", "course-1");
    expect(result.props).toMatchObject({ focusedLessonId: "lesson-2", focusedBlockId: "block-2" });
    expect(result.key).toBe("lesson-2");
  });

  it.each(["block-1", "missing-block", ["block-2", "block-1"], undefined])("ignores an invalid block location: %s", async (blockId) => {
    const result = await LessonEditPage({
      params: Promise.resolve({ courseId: "course-1", lessonId: "lesson-2" }),
      searchParams: Promise.resolve({ blockId }),
    });
    expect(result.props.focusedLessonId).toBe("lesson-2");
    expect(result.props.focusedBlockId).toBeUndefined();
  });

  it("rejects a lesson outside the loaded course", async () => {
    await expect(LessonEditPage({ params: Promise.resolve({ courseId: "course-1", lessonId: "other-lesson" }) })).rejects.toThrow("Not found");
    expect(notFound).toHaveBeenCalled();
  });
});
