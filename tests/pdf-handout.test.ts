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
