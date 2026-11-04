/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { createScorm2004ProgressAdapter, createScormProgressAdapter } from "@/export/src/scorm-runtime";
import type { LearnerProgressSnapshot } from "@/lib/export/progress";

describe.each(["1.2", "2004"])("SCORM %s media checkpoints", (version) => {
  function runtime() {
    const values: Record<string, string> = {};
    const api = { Initialize: () => "true", Terminate: () => "true", GetValue: (key: string) => values[key] ?? "", SetValue: (key: string, value: string) => { values[key] = value; return "true"; }, Commit: () => "true" };
    const host = { parent: null as unknown, opener: null, btoa: globalThis.btoa.bind(globalThis), atob: globalThis.atob.bind(globalThis), setTimeout: () => 1, clearTimeout: () => {}, addEventListener: () => {},
      ...(version === "2004" ? { API_1484_11: api } : { API: { LMSInitialize: api.Initialize, LMSFinish: api.Terminate, LMSGetValue: api.GetValue, LMSSetValue: api.SetValue, LMSCommit: api.Commit } }),
    };
    host.parent = host;
    return { values, host: host as unknown as Window };
  }
  const create = version === "2004" ? createScorm2004ProgressAdapter : createScormProgressAdapter;
  const course = { courseId: "media-course", revision: 1, sections: [{ id: "section", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", order: 0, blocks: [{ id: "audio", type: "audio", data: { src: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file" } }] }] };
  const snapshot: LearnerProgressSnapshot = { visitedLessonIds: [], lessonScrollProgress: { lesson: 75 }, revealedDividerIds: [], completedDividerIds: [], interactedContentIds: [], selectedLessonId: "lesson", mediaProgress: { "audio:listened": { source: "aaaaaaaaaaaaaaaaaaaaaaaa", seconds: 20, duration: 40 } } };

  it("round-trips fractional media progress without completing the task", () => {
    const { values, host } = runtime();
    create(course, host)!.save(course.courseId, snapshot, false);
    const restored = create(course, host)!.load(course.courseId)!;
    expect(restored.mediaProgress).toEqual(snapshot.mediaProgress);
    expect(restored.interactedContentIds).toEqual([]);
    expect(values[version === "2004" ? "cmi.completion_status" : "cmi.core.lesson_status"]).toBe("incomplete");
    if (version === "2004") expect(values["cmi.progress_measure"]).toBe("0.7500");
    expect(values["cmi.suspend_data"].length).toBeLessThan(4000);
  });

  it("drops oversized partial checkpoints before sacrificing completion state", () => {
    const { values, host } = runtime();
    const blocks = Array.from({ length: 200 }, (_, index) => ({ ...course.lessons[0].blocks[0], id: `audio-${index}` }));
    const largeCourse = { ...course, lessons: [{ ...course.lessons[0], blocks }] };
    const mediaProgress = Object.fromEntries(blocks.map((block) => [`${block.id}:listened`, snapshot.mediaProgress!["audio:listened"]]));
    const interactedContentIds = ["audio-0:listened"];
    create(largeCourse, host)!.save(course.courseId, { ...snapshot, mediaProgress, interactedContentIds }, false);
    expect(values["cmi.suspend_data"].length).toBeLessThan(4000);
    expect(create(largeCourse, host)!.load(course.courseId)!.interactedContentIds).toEqual(interactedContentIds);
  });
});
