import { courseCoverSchema } from "@/lib/editor/course-cover";
import { prepareOutlineCover } from "./session-cover";
import { Types } from "mongoose";
import { DashboardError } from "@/lib/dashboard/rules";
import { CourseGenerationSession } from "@/models/CourseGenerationSession";
import { GenerationJob } from "@/models/GenerationJob";
import { Course } from "@/models/Course";
import { Lesson } from "@/models/Lesson";
import { courseGenerationInputSchema, defaultCourseGenerationModel, type CourseGenerationInput } from "../course-generation-schemas";
import { courseOutlineSchema, normalizePreLearnPostOutline, type CourseOutline, type GenerationSessionSnapshot } from "../course-generation-session-schema";
import { getCourseEditor } from "@/lib/editor/services/course";
import { saveCourseEditor } from "@/lib/editor/services/save";
import { editorSnapshotSchema, editorLessonSchema } from "@/lib/editor/schemas";
import { generationCheckpointPayload, saveGenerationCheckpoint } from "./generation-job-store";
import { loadGenerationSourceInventory } from "./source-generation-workflow";
import { planGenerationSession } from "./session-planning";
import { prepareSessionLesson } from "./session-lesson";
import type { SourceCoursePlan } from "./types";

type Scope = { ownerId: string; courseId: string };
const modelFor = (input: CourseGenerationInput) => input.model ?? process.env.OPENAI_TEXT_MODEL ?? defaultCourseGenerationModel;

async function ownedSession(scope: Scope, sessionId: string) {
  if (!Types.ObjectId.isValid(sessionId)) throw new DashboardError("Invalid generation session.", 400);
  const session = await CourseGenerationSession.findOne({ _id: sessionId, ...scope, expiresAt: { $gt: new Date() } });
  if (!session) throw new DashboardError("Generation session expired or was not found. Saved lessons remain in your course.", 404);
  return session;
}
async function inventoryFor(scope: Scope, sourceJobId: string) {
  const job = await GenerationJob.findOne({ _id: sourceJobId, ...scope, status: "awaitingPrompt", expiresAt: { $gt: new Date() } });
  if (!job) throw new DashboardError("The source is not ready or has expired. Prepare it again.", 409);
  return loadGenerationSourceInventory(job);
}
export async function getSession(scope: Scope, sessionId?: string): Promise<GenerationSessionSnapshot | null> {
  const session = sessionId ? await ownedSession(scope, sessionId) : await CourseGenerationSession.findOne({ ...scope, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!session) return null;
  const input = courseGenerationInputSchema.parse(session.input);
  const storedOutline = courseOutlineSchema.parse(session.outline);
  const outline = session.status === "outline" && input.template === "preLearnPost" ? normalizePreLearnPostOutline(storedOutline, input.targetLanguage) : storedOutline;
  const ids = outline.sections.flatMap((section) => section.lessons.map((lesson) => lesson.id));
  // The completion receipt is stored in the same DB write as the lesson itself.
  const saved = await Lesson.find({ courseId: scope.courseId, generationSessionId: session._id, editorId: { $in: ids } }).select("editorId").lean();
  const savedIds = new Set(saved.map((lesson) => String(lesson.editorId)));
  const completedLessonIds = ids.filter((id) => savedIds.has(id));
  const currentLessonId = ids.find((id) => !completedLessonIds.includes(id)) ?? null;
  const outlineSaved = session.status === "outline" && await Course.exists({ _id: scope.courseId, ownerId: scope.ownerId, deletedAt: null, generationOutlineSessionId: session._id });
  const activeStatus = outlineSaved ? "generating" : session.status;
  const status = activeStatus === "generating" && !currentLessonId ? "completed" : activeStatus;
  if (outlineSaved) await CourseGenerationSession.updateOne({ _id: session._id, status: "outline" }, { $set: { status } });
  if (status === "completed" && session.status !== status) await CourseGenerationSession.updateOne({ _id: session._id, status: "generating" }, { $set: { status } });
  const cover = courseCoverSchema.safeParse(session.cover);
  return {
    ...(cover.success ? { cover: cover.data } : {}), coverWarning: session.coverWarning ?? null,
    id: String(session._id), status, outline, input, sourceJobId: session.sourceJobId ? String(session.sourceJobId) : undefined, completedLessonIds, currentLessonId,
    error: session.error ?? null,
    readyToSave: Boolean(currentLessonId && await generationCheckpointPayload(session, "sessionDraft", currentLessonId)),
  };
}
export async function planSession(scope: Scope, input: CourseGenerationInput, sourceJobId?: string) {
  const active = await CourseGenerationSession.exists({ ...scope, status: "generating", expiresAt: { $gt: new Date() } });
  if (active) throw new DashboardError("Finish or cancel the current generation before starting another.", 409);
  if (!input.prompt.trim() && !sourceJobId) throw new DashboardError("Write a course prompt or add source material.", 400);
  const inventory = sourceJobId ? await inventoryFor(scope, sourceJobId) : undefined;
  const plan = await planGenerationSession(input, modelFor(input), inventory);
  const session = await CourseGenerationSession.create({ ...scope, input, ...plan, sourceJobId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000) });
  try {
    const cover = await prepareOutlineCover(scope.ownerId, scope.courseId, plan.outline);
    await CourseGenerationSession.updateOne({ _id: session._id, ...scope }, { $set: cover });
  } catch (error) {
    await CourseGenerationSession.updateOne({ _id: session._id, ...scope }, { $set: { coverWarning: `The outline is ready, but its cover image could not be prepared. ${error instanceof DashboardError ? error.message : "You can add a cover later."}`.slice(0, 1_000) } });
  }
  return getSession(scope, String(session._id));
}
export async function approveSession(scope: Scope, sessionId: string, outline: CourseOutline, mode: "append" | "replace", revision: number) {
  const session = await ownedSession(scope, sessionId);
  const state = (await getSession(scope, sessionId))!;
  if (state.status === "generating" || state.status === "completed") return { session: state, editor: await getCourseEditor(scope.ownerId, scope.courseId) };
  if (session.status !== "outline") throw new DashboardError("This outline can no longer be approved.", 409);
  const input = courseGenerationInputSchema.parse(session.input);
  const original = courseOutlineSchema.parse(session.outline);
  const approved = courseOutlineSchema.parse(outline);
  const originalLessons = original.sections.flatMap((section) => section.lessons);
  const approvedLessons = approved.sections.flatMap((section) => section.lessons);
  // Source ranges and template activity identities cannot be changed by client data.
  const protectedLessons = originalLessons.filter((lesson) => lesson.sourceIndex !== undefined || lesson.kind !== "learn");
  for (const lesson of protectedLessons) {
    const next = approvedLessons.find((candidate) => candidate.id === lesson.id);
    if (!next || next.kind !== lesson.kind || next.sourceIndex !== lesson.sourceIndex)
      throw new DashboardError("Keep all source lessons and template activities in the outline.", 400);
  }
  const protectedIds = new Set(protectedLessons.map((lesson) => lesson.id));
  if (approvedLessons.filter((lesson) => protectedIds.has(lesson.id)).map((lesson) => lesson.id).join() !== protectedLessons.map((lesson) => lesson.id).join())
    throw new DashboardError("Keep source lessons and template activities in their original order.", 400);
  if (input.template === "preLearnPost") {
    const [pre, learn, post] = approved.sections;
    if (approved.sections.length !== 3
      || pre?.lessons.map((lesson) => lesson.kind).join() !== "description,overview,keywords,preTest"
      || !learn?.lessons.every((lesson) => lesson.kind === "learn")
      || post?.lessons.map((lesson) => lesson.kind).join() !== "postTest,summary,next")
      throw new DashboardError("Pre / Learn / Post requires exactly three sections, with all learning lessons in the second section.", 400);
  }
  for (const lesson of approvedLessons) {
    const before = originalLessons.find((candidate) => candidate.id === lesson.id);
    if ((before && (before.kind !== lesson.kind || before.sourceIndex !== lesson.sourceIndex)) || (!before && (lesson.kind !== "learn" || lesson.sourceIndex !== undefined || (session.sourceJobId && input.template !== "custom"))))
      throw new DashboardError("Invalid outline lesson change.", 400);
  }
  const current = await getCourseEditor(scope.ownerId, scope.courseId);
  if (current.revision !== revision) throw new DashboardError("Save or reload your course before approving the outline.", 409);
  const course = await Course.findOne({ _id: scope.courseId, ownerId: scope.ownerId, deletedAt: null }).select("coverImage").lean();
  const cover = courseCoverSchema.safeParse(session.cover);
  const applyCover = Boolean(session.generatedCover && cover.success && cover.data.imageSrc && !course?.coverImage);
  const generatedCover = applyCover && cover.success ? cover.data : undefined;
  const append = mode === "append";
  const sections = approved.sections.map((section, index) => ({ id: section.id, title: section.title, order: (append ? current.sections.length : 0) + index }));
  const lessons = approved.sections.flatMap((section) => section.lessons.map((lesson, order) => editorLessonSchema.parse({ id: lesson.id, sectionId: section.id, title: lesson.title, order, lessonType: ["preTest", "postTest"].includes(lesson.kind) ? "quiz" : "content", blocks: [] })));
  const snapshot = editorSnapshotSchema.parse({ ...current,
    ...(append ? {} : { title: approved.title, description: approved.description, descriptionHtml: undefined }),
    sections: [...(append ? current.sections : []), ...sections], lessons: [...(append ? current.lessons : []), ...lessons],
  });
  // Persist the approved outline before its course receipt. If a response is
  // lost after the course save, getSession can recover the approval atomically.
  await CourseGenerationSession.updateOne({ _id: session._id, ...scope, status: "outline" }, { $set: { outline: approved } });
  await saveCourseEditor(scope.ownerId, scope.courseId, snapshot, { sessionId, ...(generatedCover ? { coverImage: generatedCover.imageSrc } : {}) });
  await CourseGenerationSession.updateOne({ _id: session._id, ...scope, status: "outline" }, { $set: { outline: approved, status: "generating", error: null } });
  return { session: await getSession(scope, sessionId), editor: await getCourseEditor(scope.ownerId, scope.courseId) };
}
export async function prepareNextLesson(scope: Scope, sessionId: string) {
  const session = await ownedSession(scope, sessionId);
  const state = (await getSession(scope, sessionId))!;
  if (state.status !== "generating" || !state.currentLessonId || state.readyToSave) return state;
  const item = state.outline.sections.flatMap((section) => section.lessons).find((lesson) => lesson.id === state.currentLessonId)!;
  try {
    const input = courseGenerationInputSchema.parse(session.input);
    const draft = await prepareSessionLesson({ job: session, input, model: modelFor(input), outline: state.outline, item,
      inventory: session.sourceJobId ? await inventoryFor(scope, String(session.sourceJobId)) : undefined,
      sourcePlan: session.sourcePlan as SourceCoursePlan | undefined,
    });
    if (await CourseGenerationSession.exists({ _id: session._id, ...scope, status: "generating" })) {
      if (draft) await saveGenerationCheckpoint(session, "sessionDraft", item.id, draft);
      await CourseGenerationSession.updateOne({ _id: session._id, ...scope, status: "generating" }, { $set: { error: null } });
    }
  } catch (error) {
    await CourseGenerationSession.updateOne({ _id: session._id, ...scope, status: "generating" }, { $set: { error: (error instanceof Error ? error.message : "Lesson generation failed.").slice(0, 2_000) } });
    throw error;
  }
  return getSession(scope, sessionId);
}
export async function commitNextLesson(scope: Scope, sessionId: string, revision: number) {
  const session = await ownedSession(scope, sessionId);
  const state = (await getSession(scope, sessionId))!;
  if (state.status !== "generating" || !state.currentLessonId) return { session: state, editor: await getCourseEditor(scope.ownerId, scope.courseId) };
  const prepared = await generationCheckpointPayload(session, "sessionDraft", state.currentLessonId);
  if (!prepared) throw new DashboardError("Generate the lesson before saving it.", 409);
  const lesson = editorLessonSchema.parse(prepared);
  const current = await getCourseEditor(scope.ownerId, scope.courseId);
  if (current.revision !== revision) throw new DashboardError("The course changed. Reload before continuing generation.", 409);
  const placeholder = current.lessons.find((candidate) => candidate.id === lesson.id);
  if (!placeholder || placeholder.blocks.length || placeholder.quizQuestions.length)
    throw new DashboardError("The pending lesson was changed or removed. Your edits were preserved. Restore its empty draft before retrying.", 409);
  const snapshot = editorSnapshotSchema.parse({ ...current, lessons: current.lessons.map((candidate) => candidate.id === lesson.id ? { ...candidate, blocks: lesson.blocks, quizQuestions: lesson.quizQuestions, lessonType: lesson.lessonType, passingScore: lesson.passingScore } : candidate) });
  await saveCourseEditor(scope.ownerId, scope.courseId, snapshot, { sessionId, lessonId: lesson.id });
  await CourseGenerationSession.updateOne({ _id: session._id, ...scope }, { $set: { error: null } });
  return { session: await getSession(scope, sessionId), editor: await getCourseEditor(scope.ownerId, scope.courseId) };
}
export async function cancelSession(scope: Scope, sessionId: string) {
  await ownedSession(scope, sessionId);
  await CourseGenerationSession.updateOne({ _id: sessionId, ...scope, status: { $ne: "completed" } }, { $set: { status: "cancelled", error: null } });
  return getSession(scope, sessionId);
}
