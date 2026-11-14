import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { cancelSession } from "@/lib/ai/generation/session-workflow";
import { courseGenerationInputSchema } from "@/lib/ai/course-generation-schemas";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

const db = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  savedLessons: [] as { editorId: string }[],
  approved: true,
  editor: null as Record<string, unknown> | null,
  findSession: vi.fn(),
  updateSession: vi.fn(),
  findLessons: vi.fn(),
  courseExists: vi.fn(),
  getEditor: vi.fn(),
  saveEditor: vi.fn(),
}));

vi.mock("@/models/CourseGenerationSession", () => ({ CourseGenerationSession: { findOne: db.findSession, updateOne: db.updateSession } }));
vi.mock("@/models/Course", () => ({ Course: { exists: db.courseExists } }));
vi.mock("@/models/Lesson", () => ({ Lesson: { find: db.findLessons } }));
vi.mock("@/lib/editor/services/course", () => ({ getCourseEditor: db.getEditor }));
vi.mock("@/lib/editor/services/save", () => ({ saveCourseEditor: db.saveEditor }));
vi.mock("@/lib/ai/generation/generation-job-store", () => ({ generationCheckpointPayload: vi.fn(async () => null), saveGenerationCheckpoint: vi.fn() }));

const ownerId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const sessionId = "507f1f77bcf86cd799439013";
const input = courseGenerationInputSchema.parse({ prompt: "Teach HTML", audience: "Students", level: "beginner", lessonCount: 3, template: "custom", includeImages: false, courseTitle: "", courseDescription: "" });
const outline = { title: "Course", description: "Learn HTML", sections: [{ id: "learn", title: "Learn", lessons: [0, 1, 2].map((index) => ({ id: `lesson-${index}`, title: `Lesson ${index + 1}`, objective: "Explain HTML", kind: "learn" as const })) }] };

function currentEditor() {
  return editorSnapshotSchema.parse({
    title: "Course", description: "Learn HTML", revision: 4,
    sections: [{ id: "learn", title: "Learn", order: 0 }],
    lessons: outline.sections[0].lessons.map((lesson, order) => ({ id: lesson.id, sectionId: "learn", title: lesson.title, order, blocks: [] })),
  });
}

describe("cancelling generated lesson drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.session = { _id: new Types.ObjectId(sessionId), ownerId: new Types.ObjectId(ownerId), courseId: new Types.ObjectId(courseId), status: "generating", input, outline, expiresAt: new Date(Date.now() + 60_000), error: null };
    db.savedLessons = [{ editorId: "lesson-0" }];
    db.approved = true;
    db.editor = currentEditor();
    db.findSession.mockImplementation(async () => db.session);
    db.updateSession.mockImplementation(async () => { if (db.session) db.session.status = "cancelled"; return { modifiedCount: 1 }; });
    db.findLessons.mockImplementation(() => ({ select: () => ({ lean: async () => db.savedLessons }) }));
    db.courseExists.mockImplementation(async () => db.approved);
    db.getEditor.mockImplementation(async () => db.editor);
    db.saveEditor.mockResolvedValue({ revision: 5 });
  });

  it("removes ungenerated placeholders but retains lessons with saved generation receipts", async () => {
    const result = await cancelSession({ ownerId, courseId }, sessionId);

    expect(result.session?.status).toBe("cancelled");
    expect(result.session?.completedLessonIds).toEqual(["lesson-0"]);
    expect(result.discardedLessonIds).toEqual(["lesson-1", "lesson-2"]);
    expect(result.changed).toBe(true);
    expect(db.saveEditor).toHaveBeenCalledOnce();
    expect(db.saveEditor).toHaveBeenCalledWith(ownerId, courseId, expect.objectContaining({ lessons: [expect.objectContaining({ id: "lesson-0" })] }));
  });

  it("leaves existing course lessons alone when the outline was never approved", async () => {
    db.approved = false;

    const result = await cancelSession({ ownerId, courseId }, sessionId);

    expect(result.discardedLessonIds).toEqual([]);
    expect(result.changed).toBe(false);
    expect(db.saveEditor).not.toHaveBeenCalled();
  });

  it("removes generated sections with no completed lessons and leaves one valid empty section", async () => {
    db.savedLessons = [];

    const result = await cancelSession({ ownerId, courseId }, sessionId);

    expect(result.discardedLessonIds).toEqual(["lesson-0", "lesson-1", "lesson-2"]);
    expect(result.changed).toBe(true);
    expect(db.saveEditor).toHaveBeenCalledWith(ownerId, courseId, expect.objectContaining({
      sections: [expect.objectContaining({ title: "Getting started", order: 0 })],
      lessons: [],
    }));
  });
});
