import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { editorSnapshotSchema } from "../lib/editor/schemas";
import { transactionUnsupported } from "../lib/editor/service";
import { getCourseProgress } from "../lib/editor/preview";
import { normalizeFontSize, normalizeHexColor } from "../lib/editor/text-format";
import { blockSchema, defaultBlockPadding, defaultBlockWidth, normalizeBlockPadding } from "../lib/schemas/block";
import { textEditorExtensions } from "../app/courses/[courseId]/edit/_components/text-formatting-toolbar";

const validSnapshot = {
  title: "Onboarding",
  description: "A welcome course",
  revision: 2,
  sections: [{ id: "section-a", title: "Welcome", order: 0 }],
  lessons: [{
    id: "lesson-a",
    sectionId: "section-a",
    title: "First day",
    order: 0,
    blocks: [{ id: "block-a", version: 1, type: "richText", data: { html: "<p>Hello</p>" } }],
  }],
};

describe("course editor snapshot", () => {
  it("accepts a versioned course, lesson, and block snapshot", () => {
    expect(editorSnapshotSchema.parse(validSnapshot)).toMatchObject({ title: "Onboarding", revision: 2 });
  });

  it("accepts formatted course and lesson titles, author visibility, and content icons", () => {
    const formatted = structuredClone(validSnapshot) as typeof validSnapshot & {
      descriptionHtml?: string;
      authorVisible?: boolean;
      lessons: Array<(typeof validSnapshot.lessons)[number] & { titleHtml?: string; icon?: string }>;
    };
    formatted.descriptionHtml = "<p><strong>Welcome</strong> to the course.</p>";
    formatted.authorVisible = false;
    formatted.lessons[0].titleHtml = "<h2><em>First day</em></h2>";
    formatted.lessons[0].icon = "book";
    expect(editorSnapshotSchema.parse(formatted)).toMatchObject({
      descriptionHtml: "<p><strong>Welcome</strong> to the course.</p>",
      authorVisible: false,
      lessons: [{ titleHtml: "<h2><em>First day</em></h2>", icon: "book" }],
    });
  });

  it("preserves quiz content types and defaults older content to lessons", () => {
    const snapshot = editorSnapshotSchema.parse({
      ...validSnapshot,
      lessons: [
        { ...validSnapshot.lessons[0], lessonType: "quiz", icon: "quiz" },
        { ...validSnapshot.lessons[0], id: "lesson-b", title: "Reading", order: 1 },
      ],
    });
    expect(snapshot.lessons.map((lesson) => lesson.lessonType)).toEqual(["quiz", "content"]);
  });

  it("validates quiz choices, answer keys, selection modes, and feedback", () => {
    const quizSnapshot = editorSnapshotSchema.parse({
      ...validSnapshot,
      lessons: [{
        ...validSnapshot.lessons[0],
        lessonType: "quiz",
        quizQuestions: [{
          id: "question-a",
          prompt: "Which are prime numbers?",
          imageSrc: "",
          imageAlt: "",
          selectionMode: "multiple",
          choices: [
            { id: "choice-a", text: "2", imageSrc: "", imageAlt: "" },
            { id: "choice-b", text: "4", imageSrc: "", imageAlt: "" },
          ],
          correctChoiceIds: ["choice-a"],
          correctFeedback: "Correct.",
          incorrectFeedback: "Try again.",
        }],
      }],
    });
    expect(quizSnapshot.lessons[0].quizQuestions[0]).toMatchObject({
      selectionMode: "multiple",
      correctChoiceIds: ["choice-a"],
      correctFeedback: "Correct.",
      incorrectFeedback: "Try again.",
    });

    const invalid = {
      ...validSnapshot,
      lessons: [{
        ...validSnapshot.lessons[0],
        lessonType: "quiz",
        quizQuestions: [{
        id: "question-a",
        prompt: "Pick one",
        selectionMode: "single",
        choices: [{ id: "choice-a", text: "A" }, { id: "choice-b", text: "B" }],
        correctChoiceIds: ["choice-a", "choice-b"],
        }],
      }],
    };
    expect(editorSnapshotSchema.safeParse(invalid).success).toBe(false);
  });

  it("requires every lesson to reference a section", () => {
    const invalid = structuredClone(validSnapshot);
    invalid.lessons[0].sectionId = "missing-section";
    expect(editorSnapshotSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate lesson identifiers", () => {
    const invalid = structuredClone(validSnapshot);
    invalid.lessons.push({ ...invalid.lessons[0], sectionId: "section-a" });
    expect(editorSnapshotSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate lesson positions within a section", () => {
    const invalid = structuredClone(validSnapshot);
    invalid.lessons.push({ ...invalid.lessons[0], id: "lesson-b" });
    expect(editorSnapshotSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("MongoDB transaction fallback detection", () => {
  it("detects standalone MongoDB transaction errors", () => {
    expect(transactionUnsupported({ code: 20, message: "Transaction numbers are only allowed on a replica set member or mongos" })).toBe(true);
  });

  it("does not treat unrelated database errors as transaction support errors", () => {
    expect(transactionUnsupported({ code: 11000, message: "duplicate key" })).toBe(false);
  });
});

describe("rich text formatting values", () => {
  it("accepts safe font sizes from 8 to 200 pixels", () => {
    expect(normalizeFontSize("8")).toBe("8px");
    expect(normalizeFontSize("36px")).toBe("36px");
    expect(normalizeFontSize("200")).toBe("200px");
    expect(normalizeFontSize("7")).toBeNull();
    expect(normalizeFontSize("201px")).toBeNull();
    expect(normalizeFontSize("12.5px")).toBeNull();
  });

  it("normalizes hex and browser rgb color values", () => {
    expect(normalizeHexColor("#AbC")).toBe("#aabbcc");
    expect(normalizeHexColor("A1B2C3")).toBe("#a1b2c3");
    expect(normalizeHexColor("rgb(12, 34, 56)")).toBe("#0c2238");
    expect(normalizeHexColor("red")).toBeNull();
  });
});

describe("list marker font size formatting", () => {
  it("stores the selected font size on list items so markers can inherit it", () => {
    const schema = getSchema(textEditorExtensions.filter((extension) => extension.name !== "underline"));
    const listItemType = schema.nodes.listItem;
    const listItem = listItemType.create(
      { fontSize: "40px" },
      schema.nodes.paragraph.create(null, schema.text("Large list item")),
    );

    expect(listItemType.spec.attrs?.fontSize).toBeDefined();
    expect(listItemType.spec.toDOM?.(listItem)).toEqual(["li", { style: "font-size: 40px" }, 0]);
  });
});

describe("content block dimensions", () => {
  it("defaults heading and text blocks to medium width with 20px padding", () => {
    const heading = blockSchema.parse({ id: "heading-a", version: 1, type: "heading", data: { text: "Title", level: 1 } });
    const richText = blockSchema.parse({ id: "text-a", version: 1, type: "richText", data: { html: "<p>Text</p>" } });

    expect(heading).toMatchObject({ width: "medium", widthCustom: false, blockPadding: 20 });
    expect(richText).toMatchObject({ width: "medium", widthCustom: false, blockPadding: 20 });
    expect(defaultBlockWidth("heading")).toBe("medium");
    expect(defaultBlockWidth("richText")).toBe("medium");
    expect(defaultBlockPadding("heading")).toBe(20);
    expect(defaultBlockPadding("richText")).toBe(20);
  });

  it("accepts pixel padding and migrates legacy spacing values", () => {
    const block = blockSchema.parse({ id: "text-a", version: 1, type: "richText", blockPadding: 28, data: { html: "<p>Text</p>" } });
    const legacyBlock = blockSchema.parse({ id: "text-b", version: 1, type: "richText", blockPadding: "large", data: { html: "<p>Text</p>" } });

    expect(block.blockPadding).toBe(28);
    expect(legacyBlock.blockPadding).toBe(32);
    expect(normalizeBlockPadding("small", "heading")).toBe(8);
    expect(normalizeBlockPadding("medium", "heading")).toBe(20);
    expect(blockSchema.safeParse({ id: "text-c", version: 1, type: "richText", blockPadding: 201, data: { html: "<p>Text</p>" } }).success).toBe(false);
  });

  it("keeps the existing defaults for media and interactive blocks", () => {
    const image = blockSchema.parse({ id: "image-a", version: 1, type: "image", data: { src: "/image.png", alt: "" } });
    expect(image).toMatchObject({ width: "small", blockPadding: 20 });
  });
});

describe("course preview progress", () => {
  it("tracks only visited content in the current course", () => {
    expect(getCourseProgress(new Set(), ["lesson-a", "lesson-b"])).toBe(0);
    expect(getCourseProgress(new Set(["lesson-a"]), ["lesson-a", "lesson-b"])).toBe(50);
    expect(getCourseProgress(new Set(["lesson-a", "old-lesson"]), ["lesson-a"])).toBe(100);
    expect(getCourseProgress(new Set(["lesson-a"]), [])).toBe(0);
  });
});
