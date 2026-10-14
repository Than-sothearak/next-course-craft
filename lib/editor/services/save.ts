import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { Course, Lesson } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import type { EditorSnapshotInput } from "../schemas";
import { ownerObjectId } from "./shared";

export function transactionUnsupported(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 20 &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("Transaction numbers are only allowed")
  );
}

function lessonWriteOperations(
  courseId: Types.ObjectId,
  snapshot: EditorSnapshotInput,
) {
  return snapshot.lessons.map((lesson) => ({
    updateOne: {
      filter: { courseId, editorId: lesson.id },
      update: {
        $set: {
          sectionId: lesson.sectionId,
          title: lesson.title,
          titleHtml: lesson.titleHtml ?? null,
          icon: lesson.icon ?? "file",
          lessonType: lesson.lessonType,
          quizQuestions: lesson.quizQuestions,
          order: lesson.order,
          blocks: lesson.blocks,
        },
        $setOnInsert: {
          courseId,
          editorId: lesson.id,
          revision: 0,
          settings: {},
        },
      },
      upsert: true,
    },
  }));
}

async function saveWithoutTransactions(
  ownerId: string,
  courseId: string,
  snapshot: EditorSnapshotInput,
) {
  const courseObjectId = new Types.ObjectId(courseId);
  const before = await Course.findOne({
    _id: courseObjectId,
    ownerId,
    deletedAt: null,
    revision: snapshot.revision,
  })
    .select(
      "title description descriptionHtml authorVisible sections revision __v",
    )
    .lean();
  if (!before) {
    const exists = await Course.exists({
      _id: courseObjectId,
      ownerId,
      deletedAt: null,
    });
    if (!exists) throw new DashboardError("Course not found.", 404);
    throw new DashboardError(
      "This course changed elsewhere. Reload it before saving your edits.",
      409,
    );
  }

  const lockId = randomUUID();
  const staleLockBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await Course.findOneAndUpdate(
    {
      _id: courseObjectId,
      ownerId,
      deletedAt: null,
      revision: snapshot.revision,
      $or: [
        { editorSaveLock: null },
        { editorSaveLockAt: { $lt: staleLockBefore } },
      ],
    },
    {
      $set: {
        title: snapshot.title,
        description: snapshot.description,
        descriptionHtml: snapshot.descriptionHtml ?? null,
        authorVisible: snapshot.authorVisible,
        sections: snapshot.sections,
        editorSaveLock: lockId,
        editorSaveLockAt: new Date(),
      },
      $inc: { revision: 1, __v: 1 },
    },
    { new: true, runValidators: true },
  );
  if (!claimed)
    throw new DashboardError(
      "This course is already being saved or changed elsewhere. Wait a moment and reload before editing further.",
      409,
    );

  let beforeLessons: Awaited<ReturnType<typeof Lesson.find>> | null = null;
  try {
    beforeLessons = await Lesson.find({ courseId: courseObjectId }).lean();
    const operations = lessonWriteOperations(courseObjectId, snapshot);
    if (operations.length) await Lesson.bulkWrite(operations);
    await Lesson.deleteMany({
      courseId: courseObjectId,
      editorId: { $nin: snapshot.lessons.map((lesson) => lesson.id) },
    });
    const released = await Course.updateOne(
      {
        _id: courseObjectId,
        ownerId,
        revision: snapshot.revision + 1,
        editorSaveLock: lockId,
      },
      { $set: { editorSaveLock: null, editorSaveLockAt: null } },
    );
    if (released.modifiedCount !== 1)
      throw new Error("Could not release the editor save lock.");
    return { revision: snapshot.revision + 1 };
  } catch (error) {
    try {
      if (beforeLessons) {
        await Lesson.deleteMany({ courseId: courseObjectId });
        if (beforeLessons.length) await Lesson.insertMany(beforeLessons);
      }
      await Course.updateOne(
        { _id: courseObjectId, ownerId, editorSaveLock: lockId },
        {
          $set: {
            title: before.title,
            description: before.description,
            descriptionHtml: before.descriptionHtml ?? null,
            authorVisible: before.authorVisible,
            sections: before.sections,
            revision: snapshot.revision,
            __v: before.__v,
            editorSaveLock: null,
            editorSaveLockAt: null,
          },
        },
      );
    } catch (rollbackError) {
      console.error("Course editor save rollback failed", rollbackError);
      throw new Error(
        "The save failed and automatic rollback could not finish. Reload the course before continuing.",
      );
    }
    throw error;
  }
}

export async function saveCourseEditor(
  ownerId: string,
  courseId: string,
  snapshot: EditorSnapshotInput,
) {
  ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(courseId))
    throw new DashboardError("Course not found.", 404);

  const session = await mongoose.startSession();
  let nextRevision: number | null = null;
  let standaloneFallback = false;
  try {
    try {
      await session.withTransaction(async () => {
        const course = await Course.findOneAndUpdate(
          {
            _id: courseId,
            ownerId,
            deletedAt: null,
            revision: snapshot.revision,
          },
          {
            $set: {
              title: snapshot.title,
              description: snapshot.description,
              descriptionHtml: snapshot.descriptionHtml ?? null,
              authorVisible: snapshot.authorVisible,
              sections: snapshot.sections,
            },
            $inc: { revision: 1, __v: 1 },
          },
          { new: true, runValidators: true, session },
        );
        if (!course) {
          const exists = await Course.exists({
            _id: courseId,
            ownerId,
            deletedAt: null,
          }).session(session);
          if (!exists) throw new DashboardError("Course not found.", 404);
          throw new DashboardError(
            "This course changed elsewhere. Reload it before saving your edits.",
            409,
          );
        }

        const operations = lessonWriteOperations(course._id, snapshot);
        if (operations.length) await Lesson.bulkWrite(operations, { session });
        await Lesson.deleteMany(
          {
            courseId: course._id,
            editorId: { $nin: snapshot.lessons.map((lesson) => lesson.id) },
          },
          { session },
        );
        nextRevision = course.revision;
      });
    } catch (error) {
      if (!transactionUnsupported(error)) throw error;
      standaloneFallback = true;
    }
  } finally {
    await session.endSession();
  }

  if (standaloneFallback)
    return saveWithoutTransactions(ownerId, courseId, snapshot);
  if (nextRevision === null)
    throw new Error("The course editor save did not complete.");
  return { revision: nextRevision };
}
