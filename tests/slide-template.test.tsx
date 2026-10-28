import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCourseSchema } from "@/lib/dashboard/schemas";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { SlideNavigation } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";
import { DashboardDialogs } from "@/app/dashboard/_components/(dashboard_client_components)/dashboard-dialogs";
import type { DashboardData } from "@/lib/dashboard/types";
import { CoursePreview, type PreviewData } from "@/app/courses/[courseId]/preview/course-preview";
import { blockSchema } from "@/lib/schemas/block";
import { resolveSlideFrame } from "@/lib/editor/slide-design";

const slides = [
  { id: "one", title: "Introduction", blocks: [] },
  { id: "two", title: "Practice", blocks: [] },
];
const course: PreviewData = {
  courseId: "slide-course", title: "Interactive presentation", description: "", authorVisible: false,
  courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: slides.map((slide, order) => ({ ...slide, sectionId: "section", order, lessonType: "content", quizQuestions: [] })),
};

describe("slide presentation template", () => {
  it("offers the slide template when creating a course", () => {
    const markup = renderToStaticMarkup(createElement(DashboardDialogs, {
      openFolder: false, openCourse: true,
      data: { currentFolder: null, folderOptions: [] } as unknown as DashboardData,
      busy: false, onCloseFolder: () => {}, onCloseCourse: () => {}, onSubmit: async () => {},
    }));
    expect(markup).toContain("Slide interactive presentation");
    expect(markup).toContain("grid grid-cols-2 gap-3");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('name="courseLayout"');
    expect(markup).toContain('value="slides"');
    expect(markup).toContain('value="standard"');
  });

  it("validates the creation choice and retains slide layout in editor/export snapshots", () => {
    const input = { title: "Presentation", folderId: null, workspaceId: null };
    expect(createCourseSchema.parse(input).courseLayout).toBeUndefined();
    expect(createCourseSchema.parse({ ...input, courseLayout: "slides" }).courseLayout).toBe("slides");
    expect(createCourseSchema.safeParse({ ...input, courseLayout: "unknown" }).success).toBe(false);
    expect(editorSnapshotSchema.parse({ ...course, revision: 0 }).courseLayout).toBe("slides");
  });

  it("validates bounded object frames and a shared master slide", () => {
    const block = blockSchema.parse({ id: "heading", version: 1, type: "heading", data: { text: "Hello", level: 1 }, slideFrame: { x: 14, y: 18, width: 55, height: 25, z: 2 } });
    const snapshot = editorSnapshotSchema.parse({ ...course, revision: 0, slideMaster: { template: "midnight", backgroundColor: "#0f172a", textColor: "#f8fafc", accentColor: "#a5b4fc", footerText: "Training", showSlideNumber: true }, lessons: [{ ...course.lessons[0], blocks: [block] }] });
    expect(snapshot.lessons[0].blocks[0].slideFrame).toEqual({ x: 14, y: 18, width: 55, height: 25, z: 2 });
    expect(blockSchema.safeParse({ ...block, slideFrame: { ...block.slideFrame, x: 90 } }).success).toBe(false);
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: "slide-course" }, authorName: "Author", initialLessonId: snapshot.lessons[0].id, standalone: true }));
    expect(markup).toContain('data-slide-object-id="heading"');
    expect(markup).toContain('left:14%');
    expect(markup).toContain('background:#0f172a');
    expect(markup).toContain("Training");
  });

  it("places older unpositioned slide blocks in separate cells", () => {
    const first = resolveSlideFrame({ type: "richText" }, 0, 2);
    const second = resolveSlideFrame({ type: "image" }, 1, 2);
    expect(first.x + first.width).toBeLessThan(second.x);
    expect(first.y).toBe(second.y);
  });

  it.each([false, true])("renders the image cover in preview and standalone mode (standalone=%s)", (standalone) => {
    const coverCourse: PreviewData = { ...course, lessons: [
      { ...course.lessons[0], slideCover: { template: "imageCover", imageSrc: "/assets/cover.png", imageAlt: "Training cover", subtitle: "Learn the basics", lessonOf: "Lesson of design", startLabel: "Begin", overlayOpacity: 40 } },
      course.lessons[1],
    ] };
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: coverCourse, authorName: "Author", initialLessonId: "one", standalone }));
    expect(markup).toContain('alt="Training cover"');
    expect(markup).toContain("Learn the basics");
    expect(markup).toContain("Lesson of design");
    expect(markup).toContain("Begin");
    expect(markup).toContain('aria-label="Open slide menu"');
  });

  it("shows Previous/Next and a bottom thumbnail strip, including locked slides", () => {
    const markup = renderToStaticMarkup(createElement(SlideNavigation, {
      slides, activeId: "one", onSelect: () => {}, onAdd: () => {},
      getLockMessage: (id) => id === "two" ? "Finish this slide" : null,
    }));
    expect(markup).toContain('aria-label="Slide navigation"');
    expect(markup).toContain('aria-label="Slide thumbnails"');
    expect(markup).toContain('aria-label="Go to slide 1: Introduction"');
    expect(markup).toContain('aria-label="Go to slide 2: Practice"');
    expect(markup).toContain('title="Finish this slide"');
    expect(markup).toContain("Add slide");
  });

  it.each([false, true])("renders the 16:9 slide canvas in preview and static learner mode (standalone=%s)", (standalone) => {
    const markup = renderToStaticMarkup(createElement(CoursePreview, {
      initialData: course, authorName: "Author", initialLessonId: "one", standalone,
    }));
    expect(markup).toContain('data-slide-canvas=""');
    expect(markup).toContain('data-slide-stage="true"');
    expect(markup).toContain('aspect-ratio:960 / 540');
    expect(markup).toContain('data-presentation-view="true"');
    expect(markup).toContain('aria-label="Present full screen"');
    expect(markup).toContain('aria-label="Open slide menu"');
    expect(markup).toContain('aria-label="Slide navigation"');
    expect(markup).not.toContain('aria-label="Slide thumbnails"');
    expect(markup).not.toContain('aria-label="Go to slide 2: Practice"');
    expect(markup).not.toContain('aria-label="Previous section from content 1"');
  });
});
