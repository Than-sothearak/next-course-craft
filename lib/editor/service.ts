import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { Course, Lesson } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import { defaultBlockWidth, normalizeBlockPadding, type ContentBlock } from "@/lib/schemas/block";
import type { EditorSnapshotInput } from "./schemas";

function ownerObjectId(ownerId: string) {
  if (!Types.ObjectId.isValid(ownerId)) {
    throw new DashboardError("Your account session is invalid. Sign in again.", 401);
  }
  return new Types.ObjectId(ownerId);
}

function defaultSection() {
  return { id: randomUUID(), title: "Getting started", order: 0 };
}

export function transactionUnsupported(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 20 && "message" in error && typeof error.message === "string" && error.message.includes("Transaction numbers are only allowed");
}

function lessonWriteOperations(courseId: Types.ObjectId, snapshot: EditorSnapshotInput) {
  return snapshot.lessons.map((lesson) => ({
    updateOne: {
      filter: { courseId, editorId: lesson.id },
      update: {
        $set: { sectionId: lesson.sectionId, title: lesson.title, titleHtml: lesson.titleHtml ?? null, icon: lesson.icon ?? "file", lessonType: lesson.lessonType, quizQuestions: lesson.quizQuestions, order: lesson.order, blocks: lesson.blocks },
        $setOnInsert: { courseId, editorId: lesson.id, revision: 0, settings: {} },
      },
      upsert: true,
    },
  }));
}

async function saveWithoutTransactions(ownerId: string, courseId: string, snapshot: EditorSnapshotInput) {
  const courseObjectId = new Types.ObjectId(courseId);
  const before = await Course.findOne({ _id: courseObjectId, ownerId, deletedAt: null, revision: snapshot.revision }).select("title description descriptionHtml authorVisible sections revision __v").lean();
  if (!before) {
    const exists = await Course.exists({ _id: courseObjectId, ownerId, deletedAt: null });
    if (!exists) throw new DashboardError("Course not found.", 404);
    throw new DashboardError("This course changed elsewhere. Reload it before saving your edits.", 409);
  }

  const lockId = randomUUID();
  const staleLockBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await Course.findOneAndUpdate(
    { _id: courseObjectId, ownerId, deletedAt: null, revision: snapshot.revision, $or: [{ editorSaveLock: null }, { editorSaveLockAt: { $lt: staleLockBefore } }] },
    { $set: { title: snapshot.title, description: snapshot.description, descriptionHtml: snapshot.descriptionHtml ?? null, authorVisible: snapshot.authorVisible, sections: snapshot.sections, editorSaveLock: lockId, editorSaveLockAt: new Date() }, $inc: { revision: 1, __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!claimed) throw new DashboardError("This course is already being saved or changed elsewhere. Wait a moment and reload before editing further.", 409);

  let beforeLessons: Awaited<ReturnType<typeof Lesson.find>> | null = null;
  try {
    beforeLessons = await Lesson.find({ courseId: courseObjectId }).lean();
    const operations = lessonWriteOperations(courseObjectId, snapshot);
    if (operations.length) await Lesson.bulkWrite(operations);
    await Lesson.deleteMany({ courseId: courseObjectId, editorId: { $nin: snapshot.lessons.map((lesson) => lesson.id) } });
    const released = await Course.updateOne({ _id: courseObjectId, ownerId, revision: snapshot.revision + 1, editorSaveLock: lockId }, { $set: { editorSaveLock: null, editorSaveLockAt: null } });
    if (released.modifiedCount !== 1) throw new Error("Could not release the editor save lock.");
    return { revision: snapshot.revision + 1 };
  } catch (error) {
    try {
      if (beforeLessons) {
        await Lesson.deleteMany({ courseId: courseObjectId });
        if (beforeLessons.length) await Lesson.insertMany(beforeLessons);
      }
      await Course.updateOne(
        { _id: courseObjectId, ownerId, editorSaveLock: lockId },
        { $set: { title: before.title, description: before.description, descriptionHtml: before.descriptionHtml ?? null, authorVisible: before.authorVisible, sections: before.sections, revision: snapshot.revision, __v: before.__v, editorSaveLock: null, editorSaveLockAt: null } },
      );
    } catch (rollbackError) {
      console.error("Course editor save rollback failed", rollbackError);
      throw new Error("The save failed and automatic rollback could not finish. Reload the course before continuing.");
    }
    throw error;
  }
}

export async function getCourseEditor(ownerId: string, courseId: string) {
  ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(courseId)) throw new DashboardError("Course not found.", 404);

  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: null }).lean();
  if (!course) throw new DashboardError("Course not found.", 404);
  const lessons = await Lesson.find({ courseId: course._id }).sort({ sectionId: 1, order: 1, createdAt: 1 }).lean();
  const sections = course.sections?.length ? course.sections : [defaultSection()];
  const sectionIds = new Set(sections.map((section) => section.id));
  const lessonOrder = new Map<string, number>();

  return {
    courseId: course._id.toString(),
    title: course.title,
    description: course.description,
    descriptionHtml: course.descriptionHtml ?? undefined,
    authorVisible: course.authorVisible ?? true,
    revision: course.revision,
    sections,
    lessons: lessons.map((lesson) => {
      const sectionId = sectionIds.has(lesson.sectionId) ? lesson.sectionId : sections[0].id;
      const order = lessonOrder.get(sectionId) ?? 0;
      lessonOrder.set(sectionId, order + 1);
      return {
        id: lesson.editorId ?? String(lesson._id),
        sectionId,
        title: lesson.title,
        titleHtml: lesson.titleHtml ?? undefined,
        icon: lesson.icon ?? "file",
        lessonType: lesson.lessonType ?? "content",
        quizQuestions: lesson.quizQuestions ?? [],
        order,
      blocks: lesson.blocks.map((block: ContentBlock) => ({ ...block, width: block.widthCustom ? block.width : defaultBlockWidth(block.type), widthCustom: block.widthCustom ?? false, backgroundColor: block.backgroundColor ?? "#ffffff", blockPadding: normalizeBlockPadding(block.blockPadding, block.type) })),
      };
    }),
  };
}

export async function addCourseLesson(ownerId: string, courseId: string) {
  const owner = ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(courseId)) throw new DashboardError("Course not found.", 404);
  const course = await Course.findOne({ _id: courseId, ownerId: owner, deletedAt: null, editorSaveLock: null });
  if (!course) throw new DashboardError("Course not found or currently being saved.", 404);
  const sections = course.sections?.length ? course.sections : [defaultSection()];
  const section = sections[0];
  const [lastLesson] = await Lesson.find({ courseId: course._id, sectionId: section.id }).sort({ order: -1 }).limit(1).select("order").lean();
  const lessonNumber = await Lesson.countDocuments({ courseId: course._id }) + 1;
  const title = `Lesson ${lessonNumber}`;
  const editorId = randomUUID();
  const lesson = await Lesson.create({
    courseId: course._id,
    editorId,
    sectionId: section.id,
    title,
    order: (lastLesson?.order ?? -1) + 1,
    blocks: [],
  });
  const updated = await Course.findOneAndUpdate(
    { _id: course._id, ownerId: owner, revision: course.revision, editorSaveLock: null },
    { $set: { sections }, $inc: { revision: 1, __v: 1 } },
  );
  if (!updated) {
    await Lesson.deleteOne({ _id: lesson._id, courseId: course._id });
    throw new DashboardError("This course changed. Refresh and try again.", 409);
  }
  return { id: editorId, title: lesson.title, sectionId: section.id };
}

export async function copyCourseLesson(ownerId: string, sourceCourseId: string, destinationCourseId: string, lesson: EditorSnapshotInput["lessons"][number]) {
  const owner = ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(sourceCourseId) || !Types.ObjectId.isValid(destinationCourseId) || sourceCourseId === destinationCourseId) {
    throw new DashboardError("Choose a different destination course.", 400);
  }
  const [source, destination] = await Promise.all([
    Course.findOne({ _id: sourceCourseId, ownerId: owner, deletedAt: null }).select("_id"),
    Course.findOne({ _id: destinationCourseId, ownerId: owner, deletedAt: null, editorSaveLock: null }),
  ]);
  if (!source) throw new DashboardError("Course not found.", 404);
  if (!destination) throw new DashboardError("Destination course not found or currently being saved.", 404);

  const sections = destination.sections?.length ? destination.sections : [defaultSection()];
  const sectionId = sections[0].id;
  const [lastLesson] = await Lesson.find({ courseId: destination._id, sectionId }).sort({ order: -1 }).limit(1).select("order").lean();
  const id = randomUUID();
  const copied = await Lesson.create({
    courseId: destination._id,
    editorId: id,
    sectionId,
    title: lesson.title,
    titleHtml: lesson.titleHtml,
    icon: lesson.icon ?? "file",
    lessonType: lesson.lessonType,
    quizQuestions: lesson.quizQuestions.map((question) => ({ ...question, id: randomUUID(), choices: question.choices.map((choice) => ({ ...choice, id: randomUUID() })) })),
    order: (lastLesson?.order ?? -1) + 1,
    blocks: lesson.blocks.map((block) => ({ ...block, id: randomUUID() })),
  });
  const updated = await Course.findOneAndUpdate(
    { _id: destination._id, ownerId: owner, revision: destination.revision, editorSaveLock: null },
    { $set: { sections }, $inc: { revision: 1, __v: 1 } },
  );
  if (!updated) {
    await Lesson.deleteOne({ _id: copied._id, courseId: destination._id });
    throw new DashboardError("The destination course changed. Refresh it and try again.", 409);
  }
  return { id, title: copied.title };
}

export async function saveCourseEditor(ownerId: string, courseId: string, snapshot: EditorSnapshotInput) {
  ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(courseId)) throw new DashboardError("Course not found.", 404);

  const session = await mongoose.startSession();
  let nextRevision: number | null = null;
  let standaloneFallback = false;
  try {
    try {
      await session.withTransaction(async () => {
      const course = await Course.findOneAndUpdate(
        { _id: courseId, ownerId, deletedAt: null, revision: snapshot.revision },
        { $set: { title: snapshot.title, description: snapshot.description, descriptionHtml: snapshot.descriptionHtml ?? null, authorVisible: snapshot.authorVisible, sections: snapshot.sections }, $inc: { revision: 1, __v: 1 } },
        { new: true, runValidators: true, session },
      );
      if (!course) {
        const exists = await Course.exists({ _id: courseId, ownerId, deletedAt: null }).session(session);
        if (!exists) throw new DashboardError("Course not found.", 404);
        throw new DashboardError("This course changed elsewhere. Reload it before saving your edits.", 409);
      }

      const operations = lessonWriteOperations(course._id, snapshot);
      if (operations.length) await Lesson.bulkWrite(operations, { session });
      await Lesson.deleteMany({ courseId: course._id, editorId: { $nin: snapshot.lessons.map((lesson) => lesson.id) } }, { session });
      nextRevision = course.revision;
      });
    } catch (error) {
      if (!transactionUnsupported(error)) throw error;
      standaloneFallback = true;
    }
  } finally {
    await session.endSession();
  }

  if (standaloneFallback) return saveWithoutTransactions(ownerId, courseId, snapshot);
  if (nextRevision === null) throw new Error("The course editor save did not complete.");
  return { revision: nextRevision };
}
