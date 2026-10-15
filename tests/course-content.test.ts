import { describe, expect, it } from "vitest";
import { duplicateLessonContent, moveLessonToSection } from "../lib/editor/course-content";
import { editorSnapshotSchema } from "../lib/editor/schemas";

const course = editorSnapshotSchema.parse({ title: "Course", description: "", revision: 2,
  sections: [{ id: "a", title: "First", order: 0 }, { id: "b", title: "Second", order: 1 }, { id: "c", title: "Empty", order: 2 }],
  lessons: [0, 1, 2, 3, 4].map((index) => ({ id: `lesson-${index}`, sectionId: index < 3 ? "a" : "b", title: `Lesson ${index}`, order: index < 3 ? index : index - 3, blocks: [{ id: `block-${index}`, version: 1, type: "richText", data: { html: "<p>Original text</p>" } }] })),
});

describe("course content organization", () => {
  it.each([0, 1, 2])("moves lesson %i to the end of another section and keeps both sections ordered", (index) => {
    const next = moveLessonToSection(course, `lesson-${index}`, "b");
    const original = course.lessons.find((lesson) => lesson.id === `lesson-${index}`)!;
    const moved = next.lessons.find((lesson) => lesson.id === original.id)!;
    expect(moved).toEqual({ ...original, sectionId: "b", order: 2 });
    expect(next.lessons.filter((lesson) => lesson.sectionId === "a").map((lesson) => lesson.order)).toEqual([0, 1]);
    expect(next.lessons.filter((lesson) => lesson.sectionId === "b").sort((a, b) => a.order - b.order).map((lesson) => lesson.id)).toEqual(["lesson-3", "lesson-4", original.id]);
    expect(editorSnapshotSchema.safeParse(next).success).toBe(true);
    expect(original.sectionId).toBe("a");
  });

  it("moves content into an empty section without changing its text or IDs", () => {
    const next = moveLessonToSection(course, "lesson-1", "c");
    expect(next.lessons.find((lesson) => lesson.id === "lesson-1")).toEqual({ ...course.lessons[1], sectionId: "c", order: 0 });
    expect(next.lessons.find((lesson) => lesson.id === "lesson-3")).toBe(course.lessons[3]);
  });

  it.each([["missing", "b"], ["lesson-1", "missing"], ["lesson-1", "a"]])("ignores invalid or unchanged moves (%s → %s)", (lesson, section) => {
    expect(moveLessonToSection(course, lesson, section)).toBe(course);
  });

  it("duplicates content with fresh IDs, editable independent data, and its formatted title", () => {
    const source = { ...course.lessons[0], titleHtml: "<p><strong>Lesson 0</strong></p>" };
    let id = 0;
    const copy = duplicateLessonContent(source, () => `copy-${++id}`);
    expect(copy.title).toBe("Lesson 0 copy");
    expect(copy.titleHtml).toBe("<p><strong>Lesson 0 copy</strong></p>");
    expect(copy.id).not.toBe(source.id);
    expect(copy.blocks[0].id).not.toBe(source.blocks[0].id);
    if (copy.blocks[0].type !== "richText") throw new Error("Expected text");
    copy.blocks[0].data.html = "<p>Changed copy</p>";
    expect(source.blocks[0].data).toEqual({ html: "<p>Original text</p>" });
  });

  it("remaps the quiz answer key to the copied choices", () => {
    const source = { ...course.lessons[0], lessonType: "quiz" as const, quizQuestions: [{ id: "question", prompt: "Choose", imageSrc: "", imageAlt: "", selectionMode: "single" as const, choices: [{ id: "correct", text: "Correct", imageSrc: "", imageAlt: "" }, { id: "other", text: "Other", imageSrc: "", imageAlt: "" }], correctChoiceIds: ["correct"], correctFeedback: "Correct", incorrectFeedback: "Try again" }] };
    let id = 0;
    const copy = duplicateLessonContent(source, () => `quiz-copy-${++id}`);
    expect(copy.quizQuestions[0].correctChoiceIds).toEqual([copy.quizQuestions[0].choices[0].id]);
    expect(copy.quizQuestions[0].id).not.toBe("question");
    expect(editorSnapshotSchema.safeParse({ ...course, lessons: [{ ...copy, order: 0 }] }).success).toBe(true);
    expect(source.quizQuestions[0].correctChoiceIds).toEqual(["correct"]);
  });
});
