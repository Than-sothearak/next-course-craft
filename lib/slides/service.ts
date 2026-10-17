import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { Asset, Course, Slide } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import { ownerObjectId } from "@/lib/editor/services/shared";
import { slideSnapshotSchema, type SlideSnapshot } from "./schema";
import { createTemplateSlide } from "./templates";
import type { SlideTemplateId } from "./template-definitions";
import { normalizeSlideTheme, slideThemeUpdateSchema, type SlideThemeSnapshot } from "./themes";
import { courseAssetIds } from "@/lib/media/asset-references";
import { masterSettingsForSlide, resolveSlideMaster } from "./master-schema";

async function assertMasterImages(ownerId: string, courseId: Types.ObjectId, master: unknown) {
  const ids = [...courseAssetIds(master)];
  if (!ids.length) return;
  const assets = await Asset.find({ _id: { $in: ids }, ownerId: ownerObjectId(ownerId), courseId, status: "ready" }).select("_id mimeType").lean();
  if (assets.length !== ids.length || assets.some((asset) => !asset.mimeType.startsWith("image/")))
    throw new DashboardError("Choose ready images from this course's media library for the slide master.", 400);
}

function validCourseId(courseId: string) {
  if (!Types.ObjectId.isValid(courseId)) throw new DashboardError("Course not found.", 404);
  return new Types.ObjectId(courseId);
}

async function assertSlideCourse(ownerId: string, courseId: string) {
  const owner = ownerObjectId(ownerId);
  const courseObjectId = validCourseId(courseId);
  const course = await Course.findOne({ _id: courseObjectId, ownerId: owner, deletedAt: null })
    .select("editorType")
    .lean();
  if (!course) throw new DashboardError("Course not found.", 404);
  if (course.editorType !== "slide")
    throw new DashboardError("This course uses the responsive block editor.", 409);
  return courseObjectId;
}

function normalizeStoredObject(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const object = value as Record<string, unknown>;
  // Older Mongoose schemas added the image-only empty default to every object type.
  if (object.type !== "image" && object.alt === "") {
    const { alt: legacyDefault, ...normalized } = object;
    void legacyDefault;
    return normalized;
  }
  return value;
}

export function serializeStoredSlide(slide: { slideId: string; title: string; order: number; layout?: SlideSnapshot["layout"]; width: number; height: number; background?: SlideSnapshot["background"]; objects?: unknown[]; template?: unknown; composition?: unknown; masterOverrides?: unknown; numbering?: unknown; interactions?: SlideSnapshot["interactions"]; notes?: string; schemaVersion?: number; revision?: number }) {
  return {
    id: slide.slideId,
    ...slideSnapshotSchema.parse({
      title: slide.title,
      order: slide.order,
      layout: slide.layout ?? "blank",
      width: slide.width,
      height: slide.height,
      background: slide.background ?? { color: "#ffffff" },
      objects: (slide.objects ?? []).map(normalizeStoredObject),
      ...(slide.template ? { template: slide.template } : {}),
      ...(slide.composition ? { composition: slide.composition } : {}),
      ...(slide.masterOverrides ? { masterOverrides: slide.masterOverrides } : {}),
      ...(slide.numbering ? { numbering: slide.numbering } : {}),
      interactions: slide.interactions ?? [],
      notes: slide.notes ?? "",
      schemaVersion: slide.schemaVersion ?? 1,
      revision: slide.revision ?? 0,
    }),
  };
}

export async function getCourseSlides(ownerId: string, courseId: string) {
  const courseObjectId = await assertSlideCourse(ownerId, courseId);
  const slides = await Slide.find({ courseId: courseObjectId }).sort({ order: 1, createdAt: 1 }).lean();
  return slides.map((slide) => serializeStoredSlide(slide));
}

export async function createCourseSlide(ownerId: string, courseId: string, title?: string, templateId: SlideTemplateId | null = "title-description") {
  const courseObjectId = await assertSlideCourse(ownerId, courseId);
  const order = await Slide.countDocuments({ courseId: courseObjectId });
  if (order >= 500) throw new DashboardError("A course can contain up to 500 slides.", 400);
  const snapshot = templateId ? createTemplateSlide(templateId, order, title) : slideSnapshotSchema.parse({ title: title?.trim() || `Slide ${order + 1}`, order, objects: [], revision: 0 });
  const slide = await Slide.create({
    ...snapshot,
    courseId: courseObjectId,
    slideId: randomUUID(),
  });
  return serializeStoredSlide(slide.toObject());
}

export async function saveCourseSlide(ownerId: string, courseId: string, slideId: string, value: SlideSnapshot) {
  const courseObjectId = await assertSlideCourse(ownerId, courseId);
  const snapshot = slideSnapshotSchema.parse(value);
  const { masterOverrides } = masterSettingsForSlide(snapshot);
  if (masterOverrides) {
    const { theme } = await getSlideCourseTheme(ownerId, courseId);
    try { resolveSlideMaster(theme.master, masterOverrides); }
    catch { throw new DashboardError("The slide master override does not leave a valid content region. Reset it to the master or adjust its bounds.", 400); }
    await assertMasterImages(ownerId, courseObjectId, masterOverrides);
  }
  const referencedAssets = [...courseAssetIds(snapshot)];
  if (referencedAssets.length) {
    const media = await Asset.find({ _id: { $in: referencedAssets }, ownerId: ownerObjectId(ownerId), courseId: courseObjectId, status: "ready" }).select("_id mimeType").lean();
    if (media.length !== referencedAssets.length)
      throw new DashboardError("Choose media that belongs to this course and is ready to use.", 400);
    for (const layer of snapshot.composition?.layers ?? []) {
      if (layer.kind !== "audio" && layer.kind !== "video" && layer.kind !== "image") continue;
      const ids = courseAssetIds({ src: layer.src });
      if (media.some((asset) => ids.has(asset._id.toString()) && !asset.mimeType.startsWith(`${layer.kind}/`)))
        throw new DashboardError(`Choose a ${layer.kind} asset for this block.`, 400);
    }
  }
  const availableSlides = await Slide.find({ courseId: courseObjectId }).select("slideId").lean();
  const slideIds = new Set(availableSlides.map((slide) => slide.slideId));
  for (const action of [...snapshot.interactions.map((interaction) => interaction.action), ...snapshot.objects.flatMap((object) => object.actions)]) {
    if (action.type === "goToSlide" && !slideIds.has(action.slideId))
      throw new DashboardError("Choose a slide in this course for the interaction.", 400);
  }
  const saved = await Slide.findOneAndUpdate(
    { courseId: courseObjectId, slideId, revision: snapshot.revision },
    { $set: {
      title: snapshot.title,
      layout: snapshot.layout,
      width: snapshot.width,
      height: snapshot.height,
      background: snapshot.background,
      objects: snapshot.objects,
      template: snapshot.template ?? null,
      composition: snapshot.composition ?? null,
      masterOverrides: snapshot.masterOverrides ?? null,
      numbering: snapshot.numbering ?? null,
      interactions: snapshot.interactions,
      notes: snapshot.notes,
      schemaVersion: snapshot.schemaVersion,
    }, $inc: { revision: 1 } },
    { new: true, runValidators: true },
  ).lean();
  if (!saved) {
    const exists = await Slide.exists({ courseId: courseObjectId, slideId });
    if (!exists) throw new DashboardError("Slide not found.", 404);
    throw new DashboardError("This slide changed elsewhere. Reload it before saving.", 409);
  }
  return serializeStoredSlide(saved);
}

async function normalizeSlideOrder(courseId: Types.ObjectId) {
  const slides = await Slide.find({ courseId }).sort({ order: 1, createdAt: 1 }).select("_id order").lean();
  const operations = slides.flatMap((slide, order) => slide.order === order ? [] : [{ updateOne: { filter: { _id: slide._id }, update: { $set: { order }, $inc: { revision: 1 } } } }]);
  if (operations.length) await Slide.bulkWrite(operations);
}

export async function deleteCourseSlide(ownerId: string, courseId: string, slideId: string) {
  const courseObjectId = await assertSlideCourse(ownerId, courseId);
  if (await Slide.countDocuments({ courseId: courseObjectId }) <= 1)
    throw new DashboardError("A slide course must keep at least one slide.", 409);
  const deleted = await Slide.findOneAndDelete({ courseId: courseObjectId, slideId }).select("_id").lean();
  if (!deleted) throw new DashboardError("Slide not found.", 404);
  await Slide.updateMany(
    { courseId: courseObjectId, "objects.actions": { $elemMatch: { type: "goToSlide", slideId } } },
    { $pull: { "objects.$[].actions": { type: "goToSlide", slideId } }, $inc: { revision: 1 } },
  );
  await normalizeSlideOrder(courseObjectId);
}

export async function duplicateCourseSlide(ownerId: string, courseId: string, slideId: string) {
  const courseObjectId = await assertSlideCourse(ownerId, courseId);
  const source = await Slide.findOne({ courseId: courseObjectId, slideId }).lean();
  if (!source) throw new DashboardError("Slide not found.", 404);
  serializeStoredSlide(source);
  const count = await Slide.countDocuments({ courseId: courseObjectId });
  if (count >= 500) throw new DashboardError("A course can contain up to 500 slides.", 400);
  const copy = await Slide.create({
    courseId: courseObjectId,
    slideId: randomUUID(),
    title: `${source.title} copy`.slice(0, 160),
    order: count,
    layout: source.layout,
    width: 1280,
    height: 720,
    background: structuredClone(source.background),
    template: structuredClone(source.template),
    composition: structuredClone(source.composition),
    masterOverrides: structuredClone(source.masterOverrides),
    numbering: structuredClone(source.numbering),
    objects: structuredClone(source.objects),
    interactions: structuredClone(source.interactions ?? []),
    notes: source.notes,
    schemaVersion: source.schemaVersion,
    revision: 0,
  });
  return serializeStoredSlide(copy.toObject());
}

export async function reorderCourseSlides(ownerId: string, courseId: string, slideIds: string[]) {
  const courseObjectId = await assertSlideCourse(ownerId, courseId);
  if (new Set(slideIds).size !== slideIds.length)
    throw new DashboardError("Slide identifiers must be unique.", 400);
  const slides = await Slide.find({ courseId: courseObjectId }).select("_id slideId").lean();
  if (slides.length !== slideIds.length || slideIds.some((id) => !slides.some((slide) => slide.slideId === id)))
    throw new DashboardError("The slide order does not match this course.", 409);
  await Slide.bulkWrite(slideIds.map((slideId, order) => ({
    updateOne: { filter: { courseId: courseObjectId, slideId }, update: { $set: { order }, $inc: { revision: 1 } } },
  })));
  return getCourseSlides(ownerId, courseId);
}

export async function getSlideCourseTheme(ownerId: string, courseId: string): Promise<SlideThemeSnapshot> {
  await assertSlideCourse(ownerId, courseId);
  const course = await Course.findOne({ _id: validCourseId(courseId), ownerId: ownerObjectId(ownerId), deletedAt: null }).select("slideTheme slideThemeRevision").lean();
  if (!course) throw new DashboardError("Course not found.", 404);
  return { theme: normalizeSlideTheme(course.slideTheme), revision: course.slideThemeRevision ?? 0 };
}

export async function saveSlideCourseTheme(ownerId: string, courseId: string, value: SlideThemeSnapshot): Promise<SlideThemeSnapshot> {
  const courseObjectId = await assertSlideCourse(ownerId, courseId);
  const input = slideThemeUpdateSchema.parse(value);
  await assertMasterImages(ownerId, courseObjectId, input.theme.master);
  // A new master must also leave existing partial slide overrides valid.
  const inheritingSlides = await Slide.find({ courseId: courseObjectId, $or: [{ masterOverrides: { $exists: true } }, { "composition.masterOverrides": { $exists: true } }] }).select("title composition masterOverrides").lean();
  for (const slide of inheritingSlides) {
    const overrides = slide.masterOverrides ?? slide.composition?.masterOverrides;
    if (!overrides) continue;
    try { resolveSlideMaster(input.theme.master, overrides); }
    catch { throw new DashboardError(`The master conflicts with the content bounds on “${slide.title}”. Reset that slide's master override before applying this design.`, 400); }
  }
  const saved = await Course.findOneAndUpdate({
    _id: courseObjectId, ownerId: ownerObjectId(ownerId), deletedAt: null, editorType: "slide",
    ...(input.revision === 0 ? { $or: [{ slideThemeRevision: 0 }, { slideThemeRevision: { $exists: false } }] } : { slideThemeRevision: input.revision }),
  }, { $set: { slideTheme: input.theme }, $inc: { slideThemeRevision: 1 } }, { new: true, runValidators: true }).select("slideTheme slideThemeRevision").lean();
  if (!saved) throw new DashboardError("The course theme changed elsewhere. Your local theme is kept; reload the saved version before editing further.", 409);
  return { theme: normalizeSlideTheme(saved.slideTheme), revision: saved.slideThemeRevision ?? 0 };
}
