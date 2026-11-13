import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { prepareSessionLesson } from "@/lib/ai/generation/session-lesson";
import { generateCourseSeed } from "@/lib/ai/generation/direct-course-workflow";
import { generateLearnContentItem } from "@/lib/ai/generation/source-generation-content";
import { assembleCourseDraft } from "@/lib/ai/generation/course-draft-assembler";
import { courseGenerationInputSchema, generatedSourceInventorySchema } from "@/lib/ai/course-generation-schemas";
import type { CourseOutline } from "@/lib/ai/course-generation-session-schema";
vi.mock("@/lib/ai/generation/direct-course-workflow", () => ({ generateCourseSeed: vi.fn() }));
vi.mock("@/lib/ai/generation/source-generation-content", () => ({ generateLearnContentItem: vi.fn(), generatePreActivities: vi.fn(), generatePostActivities: vi.fn(), countGeneratedImagePrompts: () => 0 }));
vi.mock("@/lib/ai/generation/course-draft-assembler", () => ({ assembleCourseDraft: vi.fn() }));
vi.mock("@/lib/ai/generation/generation-job-store", () => ({ generationCheckpointPayload: vi.fn(async () => null), saveGenerationCheckpoint: vi.fn(), saveLearnWorkCheckpoint: vi.fn() }));
describe("added Custom lessons with source material", () => {
  it("generates a supplemental lesson from its objective without reassigning original source pages", async () => {
    const input = courseGenerationInputSchema.parse({ prompt: "Teach HTML", audience: "Students", level: "beginner", lessonCount: 1, template: "custom", includeImages: false, courseTitle: "", courseDescription: "" });
    const outline: CourseOutline = { title: "Course", description: "Description", sections: [{ id: "source", title: "Source", lessons: [{ id: "original", title: "Original source lesson", objective: "Learn HTML", kind: "learn", sourceIndex: 0 }] }, { id: "practice", title: "Practice", lessons: [{ id: "added", title: "Practice HTML", objective: "Build a page", kind: "learn" }] }] };
    vi.mocked(generateCourseSeed).mockResolvedValue({ title: "Course", description: "Description", sections: [{ title: "Practice", lessons: [{ title: "Practice HTML", objective: "Build a page", blocks: [] }] }], lessonOverview: [], keyTerms: [], preTest: [], postTest: [], lessonSummary: "Practice recap", nextLesson: "Next topic" });
    vi.mocked(assembleCourseDraft).mockResolvedValue({ title: "Course", description: "Description", sections: [{ id: "converted", title: "Practice", order: 0 }], lessons: [{ id: "converted", title: "Practice HTML", sectionId: "converted", order: 0, icon: "book", lessonType: "content", quizQuestions: [], blocks: [] }], template: "custom", learningLessonCount: 1, generatedImageCount: 0 });
    const result = await prepareSessionLesson({
      job: { _id: new Types.ObjectId(), ownerId: new Types.ObjectId(), courseId: new Types.ObjectId(), expiresAt: new Date(Date.now() + 60_000) },
      input, model: "test-model", outline, item: outline.sections[1].lessons[0],
      inventory: generatedSourceInventorySchema.parse({ sourcePageCount: 1, sourceLanguage: "English", summary: "Reference summary", pages: [{ pageNumber: 1, elements: [] }] }),
      sourcePlan: { title: "Course", description: "Description", sourceLanguage: "English", targetLanguage: "English", objectives: ["Learn HTML"], items: [{ title: "Original source lesson", focus: "Learn HTML", startPage: 1, endPage: 1, sourceElementIds: [], recommendedBlockTypes: [], interactionOpportunities: [] }] },
    });
    expect(result?.id).toBe("added");
    expect(generateCourseSeed).toHaveBeenCalledWith(expect.objectContaining({ lessonCount: 1, prompt: expect.stringContaining("Reference summary") }), "test-model");
    expect(generateLearnContentItem).not.toHaveBeenCalled();
    expect(outline.sections[0].lessons[0].sourceIndex).toBe(0);
  });
});
