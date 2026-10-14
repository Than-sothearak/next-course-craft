import { Types } from "mongoose";
import { Course } from "@/models";
import type { CreateCourseInput, UpdateCourseInput } from "../schemas";
import { DashboardError } from "../rules";
import { assertFolderOwned, objectId, ownerObjectId } from "./internal";

export async function createCourse(ownerId: string, input: CreateCourseInput) {
  const owner = ownerObjectId(ownerId);
  await assertFolderOwned(ownerId, input.folderId);
  const course = await Course.create({
    ownerId: owner,
    folderId: objectId(input.folderId),
    title: input.title,
    description: input.description,
    coverImage: input.coverImage ?? null,
    status: "draft",
    sections: [
      {
        id: new Types.ObjectId().toString(),
        title: "Getting started",
        order: 0,
      },
    ],
  });
  return {
    id: course._id.toString(),
    title: course.title,
    folderId: course.folderId?.toString() ?? null,
    status: course.status,
  };
}

export async function getCourseCopyDestinations(
  ownerId: string,
  sourceCourseId: string,
) {
  const owner = ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(sourceCourseId)) {
    throw new DashboardError("Course not found.", 404);
  }
  const source = await Course.exists({
    _id: sourceCourseId,
    ownerId: owner,
    deletedAt: null,
  });
  if (!source) throw new DashboardError("Course not found.", 404);
  const courses = await Course.find({
    ownerId: owner,
    deletedAt: null,
    _id: { $ne: sourceCourseId },
  })
    .sort({ title: 1 })
    .limit(200)
    .select("title folderId")
    .lean();
  return courses.map((course) => ({
    id: course._id.toString(),
    title: course.title,
    folderId: course.folderId?.toString() ?? null,
  }));
}

export async function updateCourse(
  ownerId: string,
  courseId: string,
  input: UpdateCourseInput,
) {
  ownerObjectId(ownerId);
  const course = await Course.findOne({
    _id: courseId,
    ownerId,
    deletedAt: null,
    editorSaveLock: null,
  });
  if (!course) {
    if (await Course.exists({ _id: courseId, ownerId, deletedAt: null }))
      throw new DashboardError(
        "This course is being saved. Try again in a moment.",
        409,
      );
    throw new DashboardError("Course not found.", 404);
  }
  if (input.folderId !== undefined)
    await assertFolderOwned(ownerId, input.folderId);
  if (input.title !== undefined) course.title = input.title;
  if (input.description !== undefined) course.description = input.description;
  if (input.coverImage !== undefined) course.coverImage = input.coverImage;
  if (input.folderId !== undefined) course.folderId = objectId(input.folderId);
  if (input.status !== undefined) course.status = input.status;
  course.revision += 1;
  await course.save();
  return {
    id: course._id.toString(),
    title: course.title,
    folderId: course.folderId?.toString() ?? null,
    status: course.status,
    revision: course.revision,
  };
}

export async function duplicateCourse(ownerId: string, courseId: string) {
  const owner = ownerObjectId(ownerId);
  const source = await Course.findOne({
    _id: courseId,
    ownerId,
    deletedAt: null,
  }).lean();
  if (!source) throw new DashboardError("Course not found.", 404);
  const copy = await Course.create({
    ownerId: owner,
    folderId: source.folderId,
    title: `${source.title} (copy)`.slice(0, 160),
    description: source.description,
    descriptionHtml: source.descriptionHtml,
    authorVisible: source.authorVisible ?? true,
    coverImage: source.coverImage,
    language: source.language,
    theme: structuredClone(source.theme),
    status: "draft",
    revision: 0,
    completionSettings: structuredClone(source.completionSettings),
  });
  return {
    id: copy._id.toString(),
    title: copy.title,
    folderId: copy.folderId?.toString() ?? null,
    status: copy.status,
  };
}

export async function softDeleteCourse(
  ownerId: string,
  courseId: string,
  confirmTitle: string,
) {
  ownerObjectId(ownerId);
  const course = await Course.findOne({
    _id: courseId,
    ownerId,
    deletedAt: null,
    editorSaveLock: null,
  });
  if (!course) {
    if (await Course.exists({ _id: courseId, ownerId, deletedAt: null }))
      throw new DashboardError(
        "This course is being saved. Try again in a moment.",
        409,
      );
    throw new DashboardError("Course not found.", 404);
  }
  if (course.title !== confirmTitle)
    throw new DashboardError(
      "The title did not match. The course was not deleted.",
      400,
    );
  course.deletedAt = new Date();
  await course.save();
}

export async function restoreCourse(ownerId: string, courseId: string) {
  ownerObjectId(ownerId);
  const course = await Course.findOne({
    _id: courseId,
    ownerId,
    deletedAt: { $ne: null },
  });
  if (!course)
    throw new DashboardError("Recently deleted course not found.", 404);
  course.deletedAt = null;
  await course.save();
  return { id: course._id.toString(), title: course.title };
}
