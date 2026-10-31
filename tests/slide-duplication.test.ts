import { describe, expect, it } from "vitest";
import { duplicatePresentationSlide } from "@/lib/editor/course-content";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

const course = editorSnapshotSchema.parse({ title: "Slides", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "a", title: "First", order: 0 }, { id: "b", title: "Second", order: 1 }], lessons: [
  { id: "content", sectionId: "a", title: "Content", order: 0, blocks: [{ id: "text", version: 1, type: "richText", data: { html: "<p>Keep me</p>" }, slideFrame: { x: 10, y: 20, width: 40, height: 30, z: 1 } }] },
  { id: "quiz", sectionId: "a", title: "Quiz", order: 1, lessonType: "quiz", passingScore: 85, quizQuestions: [{ id: "q1", prompt: "Choose", choices: [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }], correctChoiceIds: ["yes"], correctFeedback: "Right", incorrectFeedback: "Wrong" }], blocks: [] },
  { id: "end", sectionId: "b", title: "End", order: 0, blocks: [] },
] });

describe("presentation slide duplication", () => {
  it("copies content immediately after the source with new block IDs", () => {
    let counter = 0;
    const { course: next, duplicateId } = duplicatePresentationSlide(course, "content", () => `copy-${++counter}`);
    expect(next.lessons.filter((lesson) => lesson.sectionId === "a").sort((a, b) => a.order - b.order).map((lesson) => lesson.id)).toEqual(["content", duplicateId, "quiz"]);
    const copy = next.lessons.find((lesson) => lesson.id === duplicateId)!;
    expect(copy.title).toBe("Content copy");
    expect(copy.blocks[0].id).not.toBe("text");
    expect(copy.blocks[0].slideFrame).toEqual(course.lessons[0].blocks[0].slideFrame);
    expect(editorSnapshotSchema.safeParse(next).success).toBe(true);
    expect(course.lessons.find((lesson) => lesson.id === "quiz")?.order).toBe(1);
  });

  it("copies quiz scoring, feedback, and answer keys with fresh question and choice IDs", () => {
    let counter = 0;
    const { course: next, duplicateId } = duplicatePresentationSlide(course, "quiz", () => `quiz-copy-${++counter}`);
    const copy = next.lessons.find((lesson) => lesson.id === duplicateId)!;
    const source = course.lessons.find((lesson) => lesson.id === "quiz")!;
    expect(copy).toMatchObject({ title: "Quiz copy", lessonType: "quiz", passingScore: 85, order: 2 });
    expect(copy.quizQuestions[0].id).not.toBe(source.quizQuestions[0].id);
    expect(copy.quizQuestions[0].choices.map((choice) => choice.id)).not.toEqual(source.quizQuestions[0].choices.map((choice) => choice.id));
    expect(copy.quizQuestions[0].correctChoiceIds).toEqual([copy.quizQuestions[0].choices[0].id]);
    expect(copy.quizQuestions[0]).toMatchObject({ correctFeedback: "Right", incorrectFeedback: "Wrong" });
    expect(editorSnapshotSchema.safeParse(next).success).toBe(true);
  });

  it("keeps cover artwork and settings independent in the copied slide", () => {
    const coverCourse = editorSnapshotSchema.parse({ ...course, lessons: [{ id: "cover", sectionId: "a", title: "Cover", order: 0, slideCover: { template: "imageCover", subtitle: "Welcome", imageSrc: "/api/assets/123456789012345678901234/file" }, blocks: [] }, ...course.lessons.map((lesson) => lesson.sectionId === "a" ? { ...lesson, order: lesson.order + 1 } : lesson)] });
    let counter = 0;
    const { course: next, duplicateId } = duplicatePresentationSlide(coverCourse, "cover", () => `cover-copy-${++counter}`);
    const copy = next.lessons.find((lesson) => lesson.id === duplicateId)!;
    expect(copy.slideCover).toEqual(coverCourse.lessons[0].slideCover);
    expect(copy.slideCover).not.toBe(coverCourse.lessons[0].slideCover);
    expect(copy.order).toBe(1);
    expect(editorSnapshotSchema.safeParse(next).success).toBe(true);
  });

  it("leaves the course unchanged when the slide is missing", () => {
    const result = duplicatePresentationSlide(course, "missing", () => "unused");
    expect(result).toEqual({ course, duplicateId: null });
    expect(result.course).toBe(course);
  });
});
