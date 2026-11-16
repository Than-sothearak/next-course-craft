import { describe, expect, it } from "vitest";
import { addCustomTemplateCourseActivities, addCustomTemplateFirstLessonActivities } from "@/lib/ai/generation/block-content";
import { generatedCourseSeedSchema } from "@/lib/ai/course-generation-schemas";
import { blockSchema } from "@/lib/schemas/block";

const seed = generatedCourseSeedSchema.parse({
  title: "HTML Basics",
  description: "Learn the building blocks of a web page.",
  sections: [{ title: "Learn", lessons: [{ title: "Create a page", objective: "Build a semantic HTML page.", blocks: [{ type: "text", title: "Start with structure", body: "Use elements to describe page content.", bullets: [], style: "tip", question: "", options: [], correctOptionIndex: 0, steps: [], imageAlt: "", imagePrompt: "" }] }] }],
  lessonOverview: [{ focus: "Build page structure", slideRange: "" }],
  keyTerms: Array.from({ length: 5 }, (_, index) => ({ term: `Term ${index + 1}`, definition: `Definition ${index + 1}` })),
  preTest: Array.from({ length: 3 }, (_, index) => ({ question: `Question ${index + 1}?`, options: ["A", "B"], correctOptionIndex: 0, correctFeedback: "Correct.", incorrectFeedback: "Try again." })),
  postTest: [],
  lessonSummary: "Review the structure of a web page.",
  nextLesson: "Add page styles",
});

describe("custom template first lesson activities", () => {
  it("adds a course overview, objective, keyword cards, and a quick quiz while keeping the cover first", () => {
    const cover = blockSchema.parse({ id: "cover", version: 1, type: "image", width: "full", blockPadding: 0, data: { src: "/api/assets/507f1f77bcf86cd799439011/file", alt: "Lesson cover", imageAspectRatio: "50/13" } });
    const result = addCustomTemplateFirstLessonActivities(
      seed,
      [{ id: "section", title: "Learn", order: 0 }],
      [{ id: "lesson", title: "Create a page", sectionId: "section", order: 0, icon: "book", lessonType: "content", quizQuestions: [], blocks: [cover] }],
      false,
      [
        { title: "Create a page", focus: "Build page structure", slideRange: "" },
        { title: "Add page styles", focus: "Style page content", slideRange: "" },
      ],
    );

    const blocks = result.lessons[0].blocks;
    expect(blocks[0]).toMatchObject({ type: "image", width: "full", blockPadding: 0, data: { imageAspectRatio: "50/13" } });
    const overview = blocks.find((block) => block.type === "richText" && block.data.html.includes("Lesson overview"));
    expect(overview?.type === "richText" && overview.data.html).toContain("Add page styles");
    expect(blocks.some((block) => block.type === "richText" && block.data.html.includes("Lesson objective") && block.data.html.includes("Build a semantic HTML page"))).toBe(true);
    const keywords = blocks.find((block) => block.type === "flipCard");
    expect(keywords?.type === "flipCard" && keywords.data.cards).toHaveLength(5);
    expect(blocks.filter((block) => block.type === "knowledgeCheck")).toHaveLength(1);
    expect(blocks.at(-1)).toMatchObject({ type: "knowledgeCheck", data: { question: "Question 1?", options: ["A", "B"] } });
  });

  it("renders the Custom lesson recap as a short semantic list", () => {
    const result = addCustomTemplateCourseActivities(
      { ...seed, lessonSummary: "- Identify the page structure.\n- Choose semantic elements.\n- Check the result in a browser." },
      [{ id: "section", title: "Learn", order: 0 }],
      [{ id: "lesson", title: "Create a page", sectionId: "section", order: 0, icon: "book", lessonType: "content", quizQuestions: [], blocks: [] }],
      false,
    );

    const summary = result.lessons[0].blocks.find((block) => block.type === "richText" && block.data.html.includes("Lesson summary"));
    expect(summary?.type === "richText" && summary.data.html).toContain("<ul>");
    expect(summary?.type === "richText" && summary.data.html.match(/<li>/g)).toHaveLength(3);
  });
});
