import { Types } from "mongoose";
import { Asset, Course } from "@/models";
import type { CreateCourseInput, UpdateCourseInput } from "../schemas";
import { DashboardError } from "../rules";
import { assertFolderOwned, objectId, ownerObjectId } from "./internal";
import { resolveDashboardAccess } from "@/lib/workspaces/access";

export { duplicateCourse } from "./course-duplication";

export async function createCourse(userId: string, input: CreateCourseInput) {
  const scope = await resolveDashboardAccess(userId, input.workspaceId, "edit");
  const ownerId = scope.ownerId;
  const owner = ownerObjectId(ownerId);
  await assertFolderOwned(ownerId, input.folderId, scope.workspaceId);
  const course = await Course.create({
    ownerId: owner,
    createdBy: ownerObjectId(userId),
    workspaceId: scope.workspaceId,
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
  const sourceCourse = await Course.findById(sourceCourseId).select("workspaceId").lean();
  const courses = await Course.find({
    ownerId: owner,
    workspaceId: sourceCourse?.workspaceId ?? null,
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
    await assertFolderOwned(ownerId, input.folderId, course.workspaceId?.toString() ?? null);
  const coverAssetId = input.coverImage?.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
  if (coverAssetId) {
    const coverAsset = await Asset.findOne({
      _id: coverAssetId,
      ownerId,
      courseId,
      status: "ready",
      mimeType: /^image\//,
    }).select("_id").lean();
    if (!coverAsset)
      throw new DashboardError("Choose an image from this course’s media library.", 400);
  }
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
