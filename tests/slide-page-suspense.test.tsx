import { Suspense, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SlideEditorPage from "../app/courses/[courseId]/slides/edit/page";
import SlidePreviewPage from "../app/courses/[courseId]/slides/preview/page";
import { DashboardError } from "../lib/dashboard/rules";
import { defaultSlideTheme } from "../lib/slides/themes";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), access: vi.fn(), database: vi.fn(), course: vi.fn(), slides: vi.fn(), theme: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`Redirect to ${path}`); }),
  notFound: vi.fn(() => { throw new Error("Not found"); }),
}));
vi.mock("../lib/auth/pages", () => ({ requirePageUser: mocks.user, requirePageCourseAccess: mocks.access }));
vi.mock("../lib/db/mongodb", () => ({ connectToDatabase: mocks.database }));
vi.mock("../lib/editor/services/course", () => ({ getCourseEditor: mocks.course }));
vi.mock("../lib/slides/service", () => ({ getCourseSlides: mocks.slides, getSlideCourseTheme: mocks.theme }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("../app/courses/[courseId]/slides/edit/slide-editor-client", () => ({ SlideEditorClient: () => null }));
vi.mock("../app/courses/[courseId]/slides/preview/slide-player-client", () => ({ SlidePlayerClient: () => null }));
type Props = { params: Promise<{ courseId: string }> };
type Boundary = ReactElement<{ children: ReactElement<Props>; fallback: ReactElement }>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "editor" });
  mocks.access.mockResolvedValue({ ownerId: "course-owner", permissions: ["courses.view", "courses.edit"] });
  mocks.database.mockResolvedValue(undefined);
  mocks.course.mockResolvedValue({ courseId: "course", title: "A slide course", editorType: "slide" });
  mocks.slides.mockResolvedValue([]); mocks.theme.mockResolvedValue({ theme: defaultSlideTheme, revision: 0 });
});
describe.each([
  { name: "editor", Page: SlideEditorPage, permission: "courses.edit", fallback: "Loading slide editor", blockPath: "/courses/course/edit" },
  { name: "preview", Page: SlidePreviewPage, permission: "courses.view", fallback: "Loading slide preview", blockPath: "/courses/course/preview" },
])("slide $name loading boundary", ({ Page, permission, fallback, blockPath }) => {
  function page() { return Page({ params: Promise.resolve({ courseId: "course" }) }) as unknown as Boundary; }
  function load(boundary: Boundary) { return (boundary.props.children.type as (props: Props) => Promise<ReactElement>)(boundary.props.children.props); }
  it("defers session, params, permissions, and database reads beneath Suspense", async () => {
    const boundary = page();
    expect(boundary.type).toBe(Suspense);
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.database).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(boundary.props.fallback)).toContain(fallback);
    const content = await load(boundary);
    expect(mocks.access).toHaveBeenCalledWith("editor", "course", permission);
    expect(mocks.slides).toHaveBeenCalledWith("course-owner", "course");
    expect(mocks.theme).toHaveBeenCalledWith("course-owner", "course");
    expect(content.props).toHaveProperty(permission === "courses.edit" ? "initialSlides" : "slides", []);
  });
  it("preserves permission failures and avoids loading unauthorized content", async () => {
    mocks.access.mockRejectedValueOnce(new DashboardError("Access denied.", 403));
    await expect(load(page())).rejects.toMatchObject({ status: 403 });
    expect(mocks.slides).not.toHaveBeenCalled(); expect(mocks.theme).not.toHaveBeenCalled();
  });
  it("preserves redirects to the responsive course routes", async () => {
    mocks.course.mockResolvedValueOnce({ editorType: "block" });
    await expect(load(page())).rejects.toThrow(`Redirect to ${blockPath}`);
    expect(mocks.slides).not.toHaveBeenCalled();
  });
});
