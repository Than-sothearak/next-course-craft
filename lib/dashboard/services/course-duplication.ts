import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import { Asset, Course, Lesson, Slide } from "@/models";
import { getCourseEditor } from "@/lib/editor/services/course";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { copyMediaObject, deleteMediaObject } from "@/lib/media/storage";
import { DashboardError } from "../rules";
import { ownerObjectId } from "./internal";
import { serializeStoredSlide } from "@/lib/slides/service";

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
  const rawSlides = source.editorType === "slide"
    ? await Slide.find({ courseId: source._id }).sort({ order: 1 }).lean()
    : [];
  const sourceSlides = rawSlides.map((slide) => {
    try { return { ...slide, ...serializeStoredSlide(slide) }; }
    catch { throw new DashboardError("A slide contains invalid content and could not be duplicated. Open it and correct the content first.", 422); }
  });
  const referencedIds = courseAssetIds({ content, slides: sourceSlides, slideTheme: source.slideTheme });
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
  const mediaSources = new Map<string, string>();
  try {
    for (const asset of assets) {
      const assetId = new Types.ObjectId();
      const objectKey = `${destinationOwnerId}/${copyId}/${assetId}`;
      // Track attempted writes too: a lost response can leave a successfully copied object.
      copiedKeys.push(objectKey);
      try {
        await copyMediaObject({ sourceKey: asset.objectKey, objectKey, assetId: assetId.toString(), contentType: asset.mimeType });
      } catch (error) {
        if (error instanceof DashboardError) throw error;
        throw new DashboardError(`Could not copy media file "${asset.originalName}". Please try duplicating the course again.`, 502);
      }
      await Asset.create({
        _id: assetId, ownerId: destinationOwner, courseId: copyId, objectKey,
        originalName: asset.originalName, mimeType: asset.mimeType, size: asset.size,
        status: "ready", checksum: asset.checksum, metadata: structuredClone(asset.metadata ?? {}),
      });
      mediaSources.set(asset._id.toString(), `/api/assets/${assetId}/file`);
    }
    const copied = remapCourseAssetUrls(content, mediaSources);
    if (copied.lessons.length) await Lesson.insertMany(copied.lessons.map(({ id, ...lesson }) => ({
      ...lesson, courseId: copyId, editorId: id, revision: 0,
    })));
    if (sourceSlides.length) {
      const copiedSlides = remapCourseAssetUrls(sourceSlides, mediaSources);
      const copiedSlideIds = new Map(copiedSlides.map((slide) => [slide.slideId, randomUUID()]));
      const remapAction = <T extends { type: string; slideId?: string }>(action: T) => action.type === "goToSlide" && action.slideId
        ? { ...action, slideId: copiedSlideIds.get(action.slideId) ?? action.slideId }
        : action;
      await Slide.insertMany(copiedSlides.map((slide) => ({
        courseId: copyId,
        slideId: copiedSlideIds.get(slide.slideId)!,
        title: slide.title,
        order: slide.order,
        layout: slide.layout,
        width: slide.width,
        height: slide.height,
        background: structuredClone(slide.background),
        template: structuredClone(slide.template),
        composition: structuredClone(slide.composition),
        masterOverrides: structuredClone(slide.masterOverrides),
        numbering: structuredClone(slide.numbering),
        objects: structuredClone(slide.objects).map((object) => ({ ...object, actions: (object.actions ?? []).map(remapAction) })),
        interactions: structuredClone(slide.interactions ?? []).map((interaction) => ({ ...interaction, action: remapAction(interaction.action) })),
        notes: slide.notes,
        schemaVersion: slide.schemaVersion,
        revision: 0,
      })));
    }
    // Publish the new course record only after its media and lessons are available.
    const copy = await Course.create({
      _id: copyId, ownerId: destinationOwner, createdBy, workspaceId: targetWorkspaceId, folderId: targetFolderId,
      title: `${source.title} (copy)`.slice(0, 160),
      editorType: source.editorType ?? "block",
      description: copied.description, descriptionHtml: copied.descriptionHtml,
      authorVisible: copied.authorVisible, coverImage: copied.coverImage,
      sections: copied.sections, language: source.language, theme: copied.theme,
      slideTheme: remapCourseAssetUrls(source.slideTheme, mediaSources), slideThemeRevision: 0,
      navigationMode: copied.navigationMode, status: "draft", revision: 0,
      completionSettings: structuredClone(source.completionSettings),
    });
    return { id: copy._id.toString(), title: copy.title, editorType: copy.editorType ?? "block", folderId: copy.folderId?.toString() ?? null, status: copy.status };
  } catch (error) {
    const cleanup = await Promise.allSettled([
      Course.deleteOne({ _id: copyId, ownerId: destinationOwner }),
      Lesson.deleteMany({ courseId: copyId }),
      Slide.deleteMany({ courseId: copyId }),
      Asset.deleteMany({ courseId: copyId, ownerId: destinationOwner }),
      ...copiedKeys.map((key) => deleteMediaObject(key)),
    ]);
    if (cleanup.some((result) => result.status === "rejected"))
      console.error("Course duplication cleanup failed", { courseId: copyId.toString(), failedOperations: cleanup.filter((result) => result.status === "rejected").length });
    throw error;
  }
}
