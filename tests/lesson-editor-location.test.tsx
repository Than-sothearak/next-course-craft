import { beforeEach, describe, expect, it, vi } from "vitest";
import LessonEditPage from "../app/courses/[courseId]/edit/lessons/[lessonId]/page";
import type { ComponentProps, ReactElement } from "react";

const { auth, getCourseEditor, getCourseAuthorName, notFound } = vi.hoisted(() => ({ auth: vi.fn(), getCourseEditor: vi.fn(), getCourseAuthorName: vi.fn(), notFound: vi.fn(() => { throw new Error("Not found"); }) }));
vi.mock("../lib/auth/pages", () => ({ requirePageUser: auth, requirePageCourseAccess: vi.fn(async () => ({ ownerId: "owner-1", role: "owner", workspaceId: null, permissions: ["courses.view", "courses.edit"] })) }));
vi.mock("../lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("../lib/editor/services/course", () => ({ getCourseEditor, getCourseAuthorName }));
vi.mock("../lib/workspaces/access", () => ({ resolveCourseAccess: vi.fn(async () => ({ ownerId: "owner-1", role: "owner", workspaceId: null })) }));
vi.mock("next/navigation", () => ({ notFound, redirect: () => { throw new Error("Login required"); } }));
vi.mock("../app/courses/[courseId]/edit/_components/editor-client", () => ({ EditorClient: () => null }));
vi.mock("@/app/dashboard/actions", () => ({ signOutAction: vi.fn() }));

async function renderLessonEditContent(props: ComponentProps<typeof LessonEditPage>) {
  const page = LessonEditPage(props) as ReactElement<{ children: ReactElement }>;
  const content = page.props.children;
  const render = content.type as (props: ComponentProps<typeof LessonEditPage>) => Promise<ReactElement<Record<string, unknown>>>;
  return render(content.props as ComponentProps<typeof LessonEditPage>);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ id: "owner-1", name: "Author" });
  getCourseAuthorName.mockResolvedValue("Course Creator");
  getCourseEditor.mockResolvedValue({
    courseId: "course-1", lessons: [
      { id: "lesson-1", blocks: [{ id: "block-1" }] },
      { id: "lesson-2", blocks: [{ id: "block-2" }] },
    ],
  });
});

describe("lesson editor block location", () => {
  it("passes a block in the requested lesson to the editor after loading the owner's course", async () => {
    const result = await renderLessonEditContent({
      params: Promise.resolve({ courseId: "course-1", lessonId: "lesson-2" }),
      searchParams: Promise.resolve({ blockId: "block-2" }),
    });
    expect(getCourseEditor).toHaveBeenCalledWith("owner-1", "course-1");
    expect(result.props).toMatchObject({ focusedLessonId: "lesson-2", focusedBlockId: "block-2" });
    expect(result.key).toBe("lesson-2");
  });

  it.each(["block-1", "missing-block", ["block-2", "block-1"], undefined])("ignores an invalid block location: %s", async (blockId) => {
    const result = await renderLessonEditContent({
      params: Promise.resolve({ courseId: "course-1", lessonId: "lesson-2" }),
      searchParams: Promise.resolve({ blockId }),
    });
    expect(result.props.focusedLessonId).toBe("lesson-2");
    expect(result.props.focusedBlockId).toBeUndefined();
  });

  it("rejects a lesson outside the loaded course", async () => {
    await expect(renderLessonEditContent({ params: Promise.resolve({ courseId: "course-1", lessonId: "other-lesson" }) })).rejects.toThrow("Not found");
    expect(notFound).toHaveBeenCalled();
  });
});
