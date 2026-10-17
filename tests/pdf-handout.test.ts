import { describe, expect, it } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { quizQuestionSchema } from "@/lib/schemas/quiz";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { getHandoutBlockText, getQuizQuestionHandoutText, htmlToHandoutText } from "@/lib/pdf/content";
import { renderCourseHandoutPdf } from "@/lib/pdf/course-handout";

const course = parseScorm12Snapshot({
  title: "Safety & សុវត្ថិភាព",
  description: "Course description",
  revision: 1,
  sections: [{ id: "section-1", title: "Introduction", order: 0 }],
  lessons: [{
    id: "lesson-1",
    sectionId: "section-1",
    title: "Welcome",
    order: 0,
    blocks: [{ id: "continue-1", version: 1, type: "divider", data: { style: "continue", label: "Continue" } }],
  }],
});

describe("PDF handout content", () => {
  it("converts rich text into readable, plain handout text", () => {
    expect(htmlToHandoutText("<h2>Use &amp; check</h2><ul><li>First</li><li>Second</li></ul><script>private()</script>"))
      .toBe("Use & check\n- First\n- Second");
  });

  it("includes all accordion explanation text", () => {
    const block = blockSchema.parse({
      id: "accordion-1",
      version: 1,
      type: "accordion",
      data: {
        items: [
          { id: "item-1", title: "First explanation", body: "<p>First details</p>" },
          { id: "item-2", title: "Second explanation", body: "Second details" },
        ],
      },
    });

    expect(getHandoutBlockText(block)).toEqual([
      "First explanation",
      "First details",
      "Second explanation",
      "Second details",
    ]);
  });

  it("prints hotspot game prompts without revealing the winning target", () => {
    const game = blockSchema.parse({
      id: "field-scout-game",
      version: 1,
      type: "labeledGraphic",
      data: {
        src: "",
        alt: "A crop field with one stressed plant.",
        interactionMode: "spotTarget",
        sceneTheme: "agriculture",
        challengePrompt: "Find the plant with discolored leaves.",
        successMessage: "Correct: target plant 2.",
        markers: [
          { id: "healthy", label: "Healthy plant", description: "This plant is healthy.", x: 30, y: 50 },
          { id: "target", label: "Stressed plant", description: "The leaves are discolored.", x: 70, y: 50, isTarget: true },
        ],
      },
    });
    const text = getHandoutBlockText(game).join("\n");

    expect(text).toContain("Find the plant with discolored leaves.");
    expect(text).toContain("A crop field with one stressed plant.");
    expect(text).toContain("Complete the hotspot activity");
    expect(text).not.toContain("Stressed plant");
    expect(text).not.toContain("Correct: target plant");
  });

  it("includes lesson map checkpoint content in text-only handouts", () => {
    const map = blockSchema.parse({
      id: "lesson-map",
      version: 1,
      type: "lessonMap",
      data: {
        template: "farmFields",
        checkpoints: [
          { id: "field-stop", title: "Soil check", description: "Compare field samples.", x: 20, y: 50, targetType: "lesson", targetId: "lesson-1" },
        ],
      },
    });
    expect(getHandoutBlockText(map)).toEqual([
      "Lesson map: Farm Fields",
      "Checkpoint 1: Soil check — Compare field samples.",
      "Open the interactive course to follow the illustrated lesson map.",
    ]);
  });

  it("prints quiz prompts and choices without answer keys or feedback", () => {
    const question = quizQuestionSchema.parse({
      id: "question-1",
      prompt: "Which option is correct?",
      choices: [{ id: "right", text: "Correct answer" }, { id: "wrong", text: "Incorrect answer" }],
      correctChoiceIds: ["right"],
      correctFeedback: "Private correct feedback",
      incorrectFeedback: "Private incorrect feedback",
    });
    const text = getQuizQuestionHandoutText(question, 0).join("\n");

    expect(text).toContain("Which option is correct?");
    expect(text).toContain("Correct answer");
    expect(text).not.toContain("Private");
    expect(text).not.toContain("right");
  });

  it("generates a PDF handout with embedded Khmer and Latin fonts", async () => {
    const pdf = await renderCourseHandoutPdf(course, "Course author");

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.toString("ascii").endsWith("%%EOF\n")).toBe(true);
  });
});
