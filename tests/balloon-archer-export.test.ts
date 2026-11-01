import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { createScormProgressAdapter, createScorm2004ProgressAdapter } from "@/export/src/scorm-runtime";
import { getInteractiveBlockProgressIds } from "@/lib/export/progress";
const course = () => ({ courseId: "archer-course", ...editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, courseLayout: "slides", navigationMode: "restricted", sections: [{ id: "section", title: "Game", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Archer", order: 0, blocks: [{ id: "game", type: "balloonArcher", version: 1, data: {} }] }] }) });
describe("Balloon Archer export", () => {
  it.each(["standard", "slides"] as const)("renders the same server-independent %s game in preview and static output", (layout) => {
    const data = { ...course(), courseLayout: layout };
    for (const standalone of [false, true]) {
      const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: data, authorName: "Author", initialLessonId: "lesson", standalone }));
      expect(markup).toContain('data-balloon-archer="game"'); expect(markup).toContain("Grab arrow, pull down and release to shoot");
      expect(markup).not.toContain(data.lessons[0].blocks[0].type === "balloonArcher" && data.lessons[0].blocks[0].data.balloons[0].content);
      expect(markup).not.toContain("/api/assets/");
    }
  });
  it.each(["1.2", "2004"] as const)("stores and resumes per-balloon progress with SCORM %s", (version) => {
    const data = course(), values: Record<string, string> = {};
    const get = (key: string) => values[key] ?? "", set = (key: string, value: string) => { values[key] = value; return "true"; };
    const host = { parent: null as unknown, opener: null, btoa: globalThis.btoa, atob: globalThis.atob, setTimeout: () => 1, clearTimeout() {}, addEventListener() {},
      API: { LMSInitialize: () => "true", LMSFinish: () => "true", LMSGetValue: get, LMSSetValue: set, LMSCommit: () => "true" },
      API_1484_11: { Initialize: () => "true", Terminate: () => "true", GetValue: get, SetValue: set, Commit: () => "true" },
    }; host.parent = host;
    const adapter = (version === "1.2" ? createScormProgressAdapter : createScorm2004ProgressAdapter)(data, host as unknown as Window)!;
    const ids = getInteractiveBlockProgressIds(data.lessons[0].blocks[0]);
    const snapshot = { visitedLessonIds: ["lesson"], lessonScrollProgress: { lesson: 100 }, revealedDividerIds: [], completedDividerIds: [], selectedLessonId: "lesson", interactedContentIds: [ids[0]] };
    adapter.save(data.courseId, snapshot, false); expect(adapter.load(data.courseId)?.interactedContentIds).toEqual([ids[0]]);
    adapter.save(data.courseId, { ...snapshot, interactedContentIds: ids }, true); expect(adapter.load(data.courseId)?.interactedContentIds).toEqual(ids);
    expect(values[version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"]).toBe("completed");
    expect(values["cmi.suspend_data"].length).toBeLessThan(4096);
  });
});
