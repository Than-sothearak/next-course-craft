import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { createScormProgressAdapter, createScorm2004ProgressAdapter } from "@/export/src/scorm-runtime";
import { getInteractiveBlockProgressIds } from "@/lib/export/progress";
import { getHandoutBlockText } from "@/lib/pdf/content";
const course = () => ({ courseId: "rope-course", ...editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, courseLayout: "slides", navigationMode: "restricted", sections: [{ id: "section", title: "Discover", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Discovery", order: 0, blocks: [{ id: "ropes", type: "hangingRopeCards", version: 1, data: {} }] }] }) });
describe("Hanging Rope Cards static export", () => {
  it.each(["standard", "slides"] as const)("shares the %s rope scene in preview and standalone without server dependencies", (layout) => { for (const standalone of [false, true]) { const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...course(), courseLayout: layout }, authorName: "Author", initialLessonId: "lesson", standalone })); expect(markup).toContain('data-hanging-rope-cards="ropes"'); expect(markup).toContain("data-rope-strand"); expect(markup).toContain("data-rope-target"); expect(markup).not.toContain("Replace this with"); expect(markup).not.toContain("/api/"); } });
  it.each(["1.2", "2004"] as const)("saves and resumes individual discoveries through SCORM %s", (version) => {
    const data = course(), values: Record<string, string> = {};
    const get = (key: string) => values[key] ?? "", set = (key: string, value: string) => { values[key] = value; return "true"; };
    const host = { parent: null as unknown, opener: null, btoa: globalThis.btoa, atob: globalThis.atob, setTimeout: () => 1, clearTimeout() {}, addEventListener() {}, API: { LMSInitialize: () => "true", LMSFinish: () => "true", LMSGetValue: get, LMSSetValue: set, LMSCommit: () => "true" }, API_1484_11: { Initialize: () => "true", Terminate: () => "true", GetValue: get, SetValue: set, Commit: () => "true" } }; host.parent = host;
    const adapter = (version === "1.2" ? createScormProgressAdapter : createScorm2004ProgressAdapter)(data, host as unknown as Window)!;
    const ids = getInteractiveBlockProgressIds(data.lessons[0].blocks[0]); expect(ids).toHaveLength(3);
    const snapshot = { visitedLessonIds: ["lesson"], lessonScrollProgress: { lesson: 100 }, revealedDividerIds: [], completedDividerIds: [], selectedLessonId: "lesson", interactedContentIds: [ids[0]] };
    adapter.save(data.courseId, snapshot, false); expect(adapter.load(data.courseId)?.interactedContentIds).toEqual([ids[0]]); adapter.save(data.courseId, { ...snapshot, interactedContentIds: ids }, true); expect(adapter.load(data.courseId)?.interactedContentIds).toEqual(ids); expect(values[version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"]).toBe("completed");
  });
  it("retains hidden learning content in the handout", () => expect(getHandoutBlockText(course().lessons[0].blocks[0]).join(" ")).toContain("learning content"));
});
