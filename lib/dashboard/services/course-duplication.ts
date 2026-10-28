import { Types } from "mongoose";
import { Asset, Course, Lesson } from "@/models";
import { getCourseEditor } from "@/lib/editor/services/course";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { copyMediaObject } from "@/lib/media/storage";
import { activeStorageConfiguration, deleteStoredMedia, mediaLocation, storageProvider, storedMediaBytes } from "@/lib/media/service";
import { DashboardError } from "../rules";
import { ownerObjectId } from "./internal";

export async function duplicateCourse(
  sourceOwnerId: string,
  courseId: string,
  destination?: { ownerId: string; workspaceId: string | null; createdBy?: string },
) {
  const sourceOwner = ownerObjectId(sourceOwnerId);
  const destinationOwnerId = destination?.ownerId ?? sourceOwnerId;
  const destinationOwner = ownerObjectId(destinationOwnerId);
  if (!Types.ObjectId.isValid(courseId)) throw new DashboardError("Course not found.", 404);
  const source = await Course.findOne({ _id: courseId, ownerId: sourceOwner, deletedAt: null, editorSaveLock: null }).lean();
  if (!source) {
    if (await Course.exists({ _id: courseId, ownerId: sourceOwner, deletedAt: null }))
      throw new DashboardError("This course is being saved. Try duplicating it again in a moment.", 409);
    throw new DashboardError("Course not found.", 404);
  }
  const createdBy = ownerObjectId(destination?.createdBy ?? source.createdBy?.toString() ?? sourceOwnerId);
  const parsed = editorSnapshotSchema.safeParse(await getCourseEditor(sourceOwnerId, courseId));
  if (!parsed.success) throw new DashboardError("The course content is invalid and could not be duplicated. Open the course and save it before trying again.", 422);
  const content = { ...parsed.data, coverImage: source.coverImage };
  const referencedIds = courseAssetIds(content);
  // Include referenced media owned by this author, including older cross-course copies.
  const assets = await Asset.find({
    ownerId: sourceOwner,
    status: "ready",
    $or: [{ courseId: source._id }, { _id: { $in: [...referencedIds] } }],
  }).lean();
  const availableIds = new Set(assets.map((asset) => asset._id.toString()));
  if ([...referencedIds].some((id) => !availableIds.has(id)))
    throw new DashboardError("One or more course media files are missing or unavailable. Restore or replace them before duplicating the course.", 409);
  if (source.revision !== parsed.data.revision || !await Course.exists({
    _id: source._id, ownerId: sourceOwner, deletedAt: null, revision: source.revision, editorSaveLock: null,
  })) throw new DashboardError("The course changed while preparing its copy. Try duplicating it again.", 409);

  const copyId = new Types.ObjectId();
  const targetWorkspaceId = destination ? destination.workspaceId : source.workspaceId?.toString() ?? null;
  const targetFolderId = targetWorkspaceId === (source.workspaceId?.toString() ?? null) ? source.folderId : null;
  const copiedKeys: string[] = [];
  const { provider, directory } = await activeStorageConfiguration();
  const mediaSources = new Map<string, string>();
  try {
    for (const asset of assets) {
      const assetId = new Types.ObjectId();
      const objectKey = `${destinationOwnerId}/${copyId}/${assetId}`;
      // Track attempted writes too: a lost response can leave a successfully copied object.
      copiedKeys.push(objectKey);
      try {
        if (provider === "s3" && mediaLocation(asset).provider === "s3") {
          await copyMediaObject({ sourceKey: mediaLocation(asset).key, objectKey, assetId: assetId.toString(), contentType: asset.mimeType });
        } else {
          await storageProvider(provider, directory).upload({ key: objectKey, assetId: assetId.toString(), contentType: asset.mimeType, size: asset.size, body: await storedMediaBytes(asset) });
        }
      } catch (error) {
        if (error instanceof DashboardError) throw error;
        throw new DashboardError(`Could not copy media file "${asset.originalName}". Please try duplicating the course again.`, 502);
      }
      await Asset.create({
        _id: assetId, ownerId: destinationOwner, courseId: copyId, objectKey,
        storageProvider: provider, storageKey: objectKey,
        ...(directory ? { storageDirectory: directory } : {}),
        originalName: asset.originalName, mimeType: asset.mimeType, size: asset.size,
        status: "ready", checksum: asset.checksum, metadata: structuredClone(asset.metadata ?? {}),
      });
      mediaSources.set(asset._id.toString(), `/api/assets/${assetId}/file`);
    }
    const copied = remapCourseAssetUrls(content, mediaSources);
    if (copied.lessons.length) await Lesson.insertMany(copied.lessons.map(({ id, ...lesson }) => ({
      ...lesson, courseId: copyId, editorId: id, revision: 0,
    })));
    // Publish the new course record only after its media and lessons are available.
    const copy = await Course.create({
      _id: copyId, ownerId: destinationOwner, createdBy, workspaceId: targetWorkspaceId, folderId: targetFolderId,
      title: `${source.title} (copy)`.slice(0, 160),
      description: copied.description, descriptionHtml: copied.descriptionHtml,
      authorVisible: copied.authorVisible, coverImage: copied.coverImage,
      sections: copied.sections, language: source.language, theme: copied.theme,
      navigationMode: copied.navigationMode, courseLayout: copied.courseLayout ?? "standard", slideMaster: copied.slideMaster, status: "draft", revision: 0,
      completionSettings: structuredClone(source.completionSettings),
    });
    return { id: copy._id.toString(), title: copy.title, folderId: copy.folderId?.toString() ?? null, status: copy.status };
  } catch (error) {
    const cleanup = await Promise.allSettled([
      Course.deleteOne({ _id: copyId, ownerId: destinationOwner }),
      Lesson.deleteMany({ courseId: copyId }),
      Asset.deleteMany({ courseId: copyId, ownerId: destinationOwner }),
      ...copiedKeys.map((key) => deleteStoredMedia({ objectKey: key, storageKey: key, storageProvider: provider, storageDirectory: directory, mimeType: "", size: 0 })),
    ]);
    if (cleanup.some((result) => result.status === "rejected"))
      console.error("Course duplication cleanup failed", { courseId: copyId.toString(), failedOperations: cleanup.filter((result) => result.status === "rejected").length });
    throw error;
  }
}
