import { describe, expect, it } from "vitest";
import { reorderPresentationSlides } from "@/lib/editor/course-content";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

const course = editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "b", title: "Practice", order: 1 }, { id: "a", title: "Introduction", order: 0 }], lessons: [
  { id: "quiz", sectionId: "b", title: "Quiz", order: 0, lessonType: "quiz", quizQuestions: [{ id: "question", prompt: "Choose", choices: [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }], correctChoiceIds: ["yes"] }], blocks: [] },
  { id: "content", sectionId: "a", title: "Content", order: 1, blocks: [{ id: "text", type: "heading", version: 1, data: { text: "Preserve this", level: 2 } }] },
  { id: "cover", sectionId: "a", title: "Cover", order: 0, slideCover: { template: "imageCover", subtitle: "Welcome" }, blocks: [] },
  { id: "end", sectionId: "b", title: "End", order: 1, blocks: [] },
] });
function ids(value: typeof course) { return [...value.sections].sort((a, b) => a.order - b.order).flatMap((section) => value.lessons.filter((lesson) => lesson.sectionId === section.id).sort((a, b) => a.order - b.order).map((lesson) => lesson.id)); }
describe("presentation slide reordering", () => {
  it.each([
    ["cover", "content", ["content", "cover", "quiz", "end"]],
    ["end", "quiz", ["cover", "content", "end", "quiz"]],
    ["cover", "end", ["content", "quiz", "end", "cover"]],
    ["end", "content", ["cover", "end", "content", "quiz"]],
  ])("moves %s to %s in the thumbnail order", (from, to, expected) => {
    const before = structuredClone(course), result = reorderPresentationSlides(course, String(from), String(to));
    expect(ids(result)).toEqual(expected); expect(editorSnapshotSchema.safeParse(result).success).toBe(true);
    expect(course).toEqual(before); expect(result.sections).toBe(course.sections);
    for (const section of result.sections) expect(result.lessons.filter((lesson) => lesson.sectionId === section.id).map((lesson) => lesson.order).sort((a, b) => a - b)).toEqual(Array.from({ length: result.lessons.filter((lesson) => lesson.sectionId === section.id).length }, (_, index) => index));
    expect(parseScorm12Snapshot(result)).toEqual(result);
  });
  it("retains cover, quiz answers and slide content while moving across sections", () => {
    const result = reorderPresentationSlides(course, "quiz", "cover");
    expect(ids(result)).toEqual(["quiz", "cover", "content", "end"]);
    expect(result.lessons.find((lesson) => lesson.id === "quiz")?.sectionId).toBe("a");
    for (const lesson of result.lessons) { const original = course.lessons.find((item) => item.id === lesson.id)!; expect(lesson.blocks).toBe(original.blocks); expect(lesson.quizQuestions).toBe(original.quizQuestions); expect(lesson.slideCover).toBe(original.slideCover); }
  });
  it.each([["missing", "cover"], ["cover", "missing"], ["content", "content"]])("ignores invalid or unchanged drops (%s to %s)", (from, to) => {
    expect(reorderPresentationSlides(course, from, to)).toBe(course);
  });
});
