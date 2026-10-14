import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { Course, Lesson } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import type { EditorSnapshotInput } from "../schemas";
import { defaultSection, ownerObjectId } from "./shared";

export async function addCourseLesson(ownerId: string, courseId: string) {
  const owner = ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(courseId))
    throw new DashboardError("Course not found.", 404);
  const course = await Course.findOne({
    _id: courseId,
    ownerId: owner,
    deletedAt: null,
    editorSaveLock: null,
  });
  if (!course)
    throw new DashboardError("Course not found or currently being saved.", 404);
  const sections = course.sections?.length
    ? course.sections
    : [defaultSection()];
  const section = sections[0];
  const [lastLesson] = await Lesson.find({
    courseId: course._id,
    sectionId: section.id,
  })
    .sort({ order: -1 })
    .limit(1)
    .select("order")
    .lean();
  const lessonNumber =
    (await Lesson.countDocuments({ courseId: course._id })) + 1;
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
    {
      _id: course._id,
      ownerId: owner,
      revision: course.revision,
      editorSaveLock: null,
    },
    { $set: { sections }, $inc: { revision: 1, __v: 1 } },
  );
  if (!updated) {
    await Lesson.deleteOne({ _id: lesson._id, courseId: course._id });
    throw new DashboardError(
      "This course changed. Refresh and try again.",
      409,
    );
  }
  return { id: editorId, title: lesson.title, sectionId: section.id };
}

export async function copyCourseLesson(
  ownerId: string,
  sourceCourseId: string,
  destinationCourseId: string,
  lesson: EditorSnapshotInput["lessons"][number],
) {
  const owner = ownerObjectId(ownerId);
  if (
    !Types.ObjectId.isValid(sourceCourseId) ||
    !Types.ObjectId.isValid(destinationCourseId) ||
    sourceCourseId === destinationCourseId
  ) {
    throw new DashboardError("Choose a different destination course.", 400);
  }
  const [source, destination] = await Promise.all([
    Course.findOne({
      _id: sourceCourseId,
      ownerId: owner,
      deletedAt: null,
    }).select("_id"),
    Course.findOne({
      _id: destinationCourseId,
      ownerId: owner,
      deletedAt: null,
      editorSaveLock: null,
    }),
  ]);
  if (!source) throw new DashboardError("Course not found.", 404);
  if (!destination)
    throw new DashboardError(
      "Destination course not found or currently being saved.",
      404,
    );

  const sections = destination.sections?.length
    ? destination.sections
    : [defaultSection()];
  const sectionId = sections[0].id;
  const [lastLesson] = await Lesson.find({
    courseId: destination._id,
    sectionId,
  })
    .sort({ order: -1 })
    .limit(1)
    .select("order")
    .lean();
  const id = randomUUID();
  const copied = await Lesson.create({
    courseId: destination._id,
    editorId: id,
    sectionId,
    title: lesson.title,
    titleHtml: lesson.titleHtml,
    icon: lesson.icon ?? "file",
    lessonType: lesson.lessonType,
    quizQuestions: lesson.quizQuestions.map((question) => ({
      ...question,
      id: randomUUID(),
      choices: question.choices.map((choice) => ({
        ...choice,
        id: randomUUID(),
      })),
    })),
    order: (lastLesson?.order ?? -1) + 1,
    blocks: lesson.blocks.map((block) => ({ ...block, id: randomUUID() })),
  });
  const updated = await Course.findOneAndUpdate(
    {
      _id: destination._id,
      ownerId: owner,
      revision: destination.revision,
      editorSaveLock: null,
    },
    { $set: { sections }, $inc: { revision: 1, __v: 1 } },
  );
  if (!updated) {
    await Lesson.deleteOne({ _id: copied._id, courseId: destination._id });
    throw new DashboardError(
      "The destination course changed. Refresh it and try again.",
      409,
    );
  }
  return { id, title: copied.title };
}
