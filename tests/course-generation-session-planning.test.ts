import { beforeEach, describe, expect, it, vi } from "vitest";
import { planGenerationSession } from "@/lib/ai/generation/session-planning";
import { requestStructuredJson } from "@/lib/ai/generation/provider";
import { generateSourcePlan } from "@/lib/ai/generation/source-generation-content";
import { courseGenerationInputSchema, generatedSourceInventorySchema } from "@/lib/ai/course-generation-schemas";
vi.mock("@/lib/ai/generation/provider", () => ({ requestStructuredJson: vi.fn() }));
vi.mock("@/lib/ai/generation/source-generation-content", () => ({ generateSourcePlan: vi.fn() }));
const input = courseGenerationInputSchema.parse({ prompt: "Teach HTML", audience: "Students", level: "beginner", lessonCount: 2, template: "custom", includeImages: false, courseTitle: "", courseDescription: "" });
const rawOutline = { title: "HTML course", description: "Learn HTML", sections: [{ title: "Learn", lessons: [{ title: "HTML basics", objective: "Describe elements" }, { title: "Build a page", objective: "Create an HTML page" }] }] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requestStructuredJson).mockResolvedValue(rawOutline); });
describe("reviewable outline planning", () => {
  it("produces stable metadata identities without drafting lesson content", async () => {
    const { outline } = await planGenerationSession(input, "test-model");
    expect(outline.sections[0].lessons).toHaveLength(2);
    expect(new Set(outline.sections[0].lessons.map((lesson) => lesson.id)).size).toBe(2);
    expect(outline.sections[0].lessons.every((lesson) => !("blocks" in lesson))).toBe(true);
    expect(vi.mocked(requestStructuredJson).mock.calls[0][0].developerPrompt).toContain("Do not write lesson content");
  });
  it("rejects an incorrect lesson count instead of approving it silently", async () => {
    await expect(planGenerationSession({ ...input, lessonCount: 3 }, "test-model")).rejects.toThrow("incorrect lesson count");
  });
  it("includes every required Pre/Learn/Post activity in the approved total", async () => {
    const { outline } = await planGenerationSession({ ...input, template: "preLearnPost" }, "test-model");
    const items = outline.sections.flatMap((section) => section.lessons);
    expect(items.map((lesson) => lesson.kind)).toEqual(["description", "overview", "keywords", "preTest", "learn", "learn", "postTest", "summary", "next"]);
    expect(items).toHaveLength(9);
  });
  it("keeps exactly three template sections when the AI suggests multiple learning sections", async () => {
    vi.mocked(requestStructuredJson).mockResolvedValue({ ...rawOutline, sections: rawOutline.sections[0].lessons.map((lesson, index) => ({ title: `Topic ${index + 1}`, lessons: [lesson] })) });
    const { outline } = await planGenerationSession({ ...input, template: "preLearnPost" }, "test-model");
    expect(outline.sections.map((section) => section.title)).toEqual(["Pre activities", "Learn", "Post activities"]);
    expect(outline.sections[1].lessons.map((lesson) => lesson.title)).toEqual(["HTML basics", "Build a page"]);
  });
  it("retains multiple learning sections for Custom outlines", async () => {
    vi.mocked(requestStructuredJson).mockResolvedValue({ ...rawOutline, sections: rawOutline.sections[0].lessons.map((lesson, index) => ({ title: `Topic ${index + 1}`, lessons: [lesson] })) });
    const { outline } = await planGenerationSession(input, "test-model");
    expect(outline.sections.map((section) => section.title)).toEqual(["Topic 1", "Topic 2"]);
  });
  it("preserves the source planner's group identities for later lesson writing", async () => {
    const inventory = generatedSourceInventorySchema.parse({ sourcePageCount: 1, summary: "HTML source", sourceLanguage: "English", pages: [{ pageNumber: 1, elements: [] }] });
    vi.mocked(generateSourcePlan).mockResolvedValue({ title: "Source course", description: "Learn from source", objectives: ["Understand HTML"], sourceLanguage: "English", targetLanguage: "English", items: [{ title: "Source topic", focus: "Understand HTML", startPage: 1, endPage: 1, sourceElementIds: [], recommendedBlockTypes: [], interactionOpportunities: [] }] });
    const { outline } = await planGenerationSession(input, "test-model", inventory);
    expect(outline.sections[0].lessons[0].sourceIndex).toBe(0);
    expect(generateSourcePlan).toHaveBeenCalledWith(input, "test-model", inventory);
    expect(requestStructuredJson).not.toHaveBeenCalled();
  });
});
