import { Suspense, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoursePreviewPage from "../app/courses/[courseId]/preview/page";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connectToDatabase: vi.fn(),
  getCourseEditor: vi.fn(),
  getCourseAuthorName: vi.fn(),
  resolveCourseAccess: vi.fn(),
  notFound: vi.fn(() => { throw new Error("Not found"); }),
  redirect: vi.fn((path: string) => { throw new Error(`Redirect to ${path}`); }),
}));

vi.mock("../lib/auth/pages", () => ({ requirePageUser: mocks.auth, requirePageCourseAccess: mocks.resolveCourseAccess }));
vi.mock("../lib/db/mongodb", () => ({ connectToDatabase: mocks.connectToDatabase }));
vi.mock("../lib/editor/services/course", () => ({
  getCourseEditor: mocks.getCourseEditor,
  getCourseAuthorName: mocks.getCourseAuthorName,
}));
vi.mock("../lib/workspaces/access", () => ({ resolveCourseAccess: mocks.resolveCourseAccess }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("../app/courses/[courseId]/preview/course-preview-route", () => ({
  CoursePreviewRoute: () => null,
}));

type CoursePreviewPageProps = {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ lessonId?: string | string[] }>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "owner-1", name: "Author" });
  mocks.connectToDatabase.mockResolvedValue(undefined);
  mocks.resolveCourseAccess.mockResolvedValue({ ownerId: "owner-1", role: "owner", permissions: ["courses.view", "courses.edit"] });
  mocks.getCourseEditor.mockResolvedValue({ courseId: "course-1", sections: [], lessons: [{ id: "lesson-1" }] });
  mocks.getCourseAuthorName.mockResolvedValue("Course Creator");
});

describe("course preview loading boundary", () => {
  it("keeps session and course loading inside Suspense and shows a preview-shaped fallback", async () => {
    const props: CoursePreviewPageProps = {
      params: Promise.resolve({ courseId: "course-1" }),
      searchParams: Promise.resolve({ lessonId: "lesson-1" }),
    };
    const page = CoursePreviewPage(props) as ReactElement<{
      children: ReactElement<CoursePreviewPageProps>;
      fallback: ReactElement;
    }>;

    expect(page.type).toBe(Suspense);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(page.props.fallback)).toContain('aria-label="Loading course preview"');

    const loadCourse = page.props.children.type as (input: CoursePreviewPageProps) => Promise<ReactElement>;
    const content = await loadCourse(page.props.children.props);

    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.getCourseEditor).toHaveBeenCalledWith("owner-1", "course-1");
    expect(content.props).toMatchObject({ initialLessonId: "lesson-1", authorName: "Course Creator" });
  });
});
