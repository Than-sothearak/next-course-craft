import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Asset, Course, Slide } from "../models";
import { createCourseSlide, deleteCourseSlide, duplicateCourseSlide, getCourseSlides, getSlideCourseTheme, saveCourseSlide, saveSlideCourseTheme } from "../lib/slides/service";
import { createTemplateSlide } from "../lib/slides/templates";
import { defaultSlideTheme } from "../lib/slides/themes";
import { composeLearningPage } from "../lib/slides/pages";
import { createLearningBlock } from "../lib/slides/blocks";
import { institutionalGreenMaster } from "../lib/slides/master-schema";

vi.mock("../models", () => ({ Asset: { find: vi.fn() }, Course: { findOne: vi.fn(), findOneAndUpdate: vi.fn() }, Slide: { find: vi.fn(), create: vi.fn(), countDocuments: vi.fn(), findOneAndUpdate: vi.fn(), exists: vi.fn(), findOne: vi.fn(), findOneAndDelete: vi.fn(), updateMany: vi.fn(), bulkWrite: vi.fn() } }));
const ownerId = "507f1f77bcf86cd799439011", courseId = "507f1f77bcf86cd799439012";
function query<T>(value: T) { const result = { select: () => result, sort: () => result, lean: async () => value }; return result; }
const document = () => ({ ...createTemplateSlide("image-text", 0), slideId: "slide-one", _id: new Types.ObjectId(), courseId: new Types.ObjectId(courseId) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Course.findOne).mockReturnValue(query({ editorType: "slide", slideThemeRevision: 0 }) as never);
  vi.mocked(Slide.find).mockImplementation(() => query([document()]) as never);
  vi.mocked(Slide.countDocuments).mockResolvedValue(2 as never);
  vi.mocked(Slide.create).mockImplementation(async (value) => ({ toObject: () => value }) as never);
  vi.mocked(Asset.find).mockReturnValue(query([]) as never);
});
describe("owner-scoped slide persistence", () => {
  it("persists and duplicates a version 3 page with its complete block timeline", async () => {
    const { id, ...snapshot } = composeLearningPage({ ...createTemplateSlide("cover", 0), id: "page" });
    snapshot.composition!.layers.push(createLearningBlock("audio"), createLearningBlock("quiz"));
    const stored = { ...snapshot, slideId: id, courseId: new Types.ObjectId(courseId), revision: 1 };
    vi.mocked(Slide.findOneAndUpdate).mockReturnValue(query(stored) as never);
    const result = await saveCourseSlide(ownerId, courseId, id, snapshot);
    expect(result.composition).toEqual(snapshot.composition);
    expect(Slide.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ revision: 0 }), expect.objectContaining({ $set: expect.objectContaining({ composition: snapshot.composition, template: null, schemaVersion: 3 }) }), expect.anything());
    vi.mocked(Slide.findOne).mockReturnValue(query(stored) as never);
    const copy = await duplicateCourseSlide(ownerId, courseId, id);
    expect(copy.composition).toEqual(snapshot.composition); expect(copy.composition).not.toBe(snapshot.composition);
  });
  it("enforces ready course-owned assets nested in audio/video blocks before writing a page", async () => {
    const { id, ...snapshot } = composeLearningPage({ ...createTemplateSlide("cover", 0), id: "page" });
    snapshot.composition!.layers.push({ ...createLearningBlock("audio"), src: "/api/assets/507f1f77bcf86cd799439013/file" } as never);
    await expect(saveCourseSlide(ownerId, courseId, id, snapshot)).rejects.toMatchObject({ status: 400 });
    expect(Slide.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Asset.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: new Types.ObjectId(ownerId), courseId: new Types.ObjectId(courseId), status: "ready" }));
  });
  it("reads validated template slides through the parent course owner", async () => {
    const slides = await getCourseSlides(ownerId, courseId);
    expect(Course.findOne).toHaveBeenCalledWith({ _id: new Types.ObjectId(courseId), ownerId: new Types.ObjectId(ownerId), deletedAt: null });
    expect(Slide.find).toHaveBeenCalledWith({ courseId: new Types.ObjectId(courseId) });
    expect(slides[0]).toMatchObject({ id: "slide-one", schemaVersion: 2, template: { id: "image-text" } });
  });
  it("rejects missing ownership and block courses before querying slides", async () => {
    vi.mocked(Course.findOne).mockReturnValueOnce(query(null) as never);
    await expect(getCourseSlides(ownerId, courseId)).rejects.toMatchObject({ status: 404 });
    vi.mocked(Course.findOne).mockReturnValueOnce(query({ editorType: "block" }) as never);
    await expect(getCourseSlides(ownerId, courseId)).rejects.toMatchObject({ status: 409 });
    expect(Slide.find).not.toHaveBeenCalled();
  });
  it("creates an editable template independently and can explicitly create a blank canvas", async () => {
    const slide = await createCourseSlide(ownerId, courseId, undefined, "three-cards");
    expect(slide).toMatchObject({ schemaVersion: 2, order: 2, template: { id: "three-cards" } });
    const blank = await createCourseSlide(ownerId, courseId, "My canvas", null);
    expect(blank.template).toBeUndefined(); expect(blank.schemaVersion).toBe(1);
  });
  it("saves all structured data with a revision check without overwriting slide ordering", async () => {
    const snapshot = createTemplateSlide("image-text", 0);
    snapshot.template!.slots.title = { type: "text", content: "My updated heading" };
    vi.mocked(Slide.findOneAndUpdate).mockReturnValue(query({ ...snapshot, slideId: "slide-one", order: 3, revision: 1 }) as never);
    const saved = await saveCourseSlide(ownerId, courseId, "slide-one", snapshot);
    expect(saved.order).toBe(3); expect(saved.revision).toBe(1);
    expect(Slide.findOneAndUpdate).toHaveBeenCalledWith({ courseId: new Types.ObjectId(courseId), slideId: "slide-one", revision: 0 }, expect.objectContaining({ $set: expect.objectContaining({ template: snapshot.template, schemaVersion: 2 }), $inc: { revision: 1 } }), { new: true, runValidators: true });
    const write = vi.mocked(Slide.findOneAndUpdate).mock.calls[0][1] as { $set: Record<string, unknown> };
    expect(write.$set).not.toHaveProperty("order");
  });
  it("rejects stale saves and media references outside this owner and course", async () => {
    const snapshot = createTemplateSlide("image-text", 0);
    vi.mocked(Slide.findOneAndUpdate).mockReturnValue(query(null) as never);
    vi.mocked(Slide.exists).mockResolvedValue({ _id: new Types.ObjectId() } as never);
    await expect(saveCourseSlide(ownerId, courseId, "slide-one", snapshot)).rejects.toMatchObject({ status: 409 });
    snapshot.template!.slots.image = { type: "image", src: "/api/assets/507f1f77bcf86cd799439013/file", alt: "Foreign image" };
    await expect(saveCourseSlide(ownerId, courseId, "slide-one", snapshot)).rejects.toMatchObject({ status: 400 });
    expect(Asset.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: new Types.ObjectId(ownerId), courseId: new Types.ObjectId(courseId), status: "ready" }));
    expect(Slide.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
  it("duplicates template content and design with fresh slide identity", async () => {
    const source = document(); source.template!.design.background = "primary";
    vi.mocked(Slide.findOne).mockReturnValue(query(source) as never);
    const copy = await duplicateCourseSlide(ownerId, courseId, source.slideId);
    expect(copy.id).not.toBe(source.slideId); expect(copy.revision).toBe(0);
    expect(copy.template).toEqual(source.template); expect(copy.template).not.toBe(source.template);
    copy.template!.slots.title = { type: "text", content: "Only the copy" };
    expect(source.template!.slots.title).not.toEqual(copy.template!.slots.title);
  });
  it("keeps the last slide and clears navigation references when a slide is deleted", async () => {
    vi.mocked(Slide.countDocuments).mockResolvedValueOnce(1 as never);
    await expect(deleteCourseSlide(ownerId, courseId, "slide-one")).rejects.toMatchObject({ status: 409 });
    expect(Slide.findOneAndDelete).not.toHaveBeenCalled();
    vi.mocked(Slide.findOneAndDelete).mockReturnValue(query({ _id: new Types.ObjectId() }) as never);
    await deleteCourseSlide(ownerId, courseId, "slide-one");
    expect(Slide.updateMany).toHaveBeenCalledWith({ courseId: new Types.ObjectId(courseId), "objects.actions": { $elemMatch: { type: "goToSlide", slideId: "slide-one" } } }, { $pull: { "objects.$[].actions": { type: "goToSlide", slideId: "slide-one" } }, $inc: { revision: 1 } });
  });
});
describe("course slide themes", () => {
  it("requires ready course-owned images for master logos and backgrounds", async () => {
    const master = structuredClone(institutionalGreenMaster);
    master.header.logo.src = "/api/assets/507f1f77bcf86cd799439013/file";
    const theme = { ...defaultSlideTheme, master };
    await expect(saveSlideCourseTheme(ownerId, courseId, { theme, revision: 0 })).rejects.toMatchObject({ status: 400 });
    expect(Course.findOneAndUpdate).not.toHaveBeenCalled();
    vi.mocked(Asset.find).mockReturnValue(query([{ _id: new Types.ObjectId("507f1f77bcf86cd799439013"), mimeType: "video/mp4" }]) as never);
    await expect(saveSlideCourseTheme(ownerId, courseId, { theme, revision: 0 })).rejects.toMatchObject({ status: 400 });
    vi.mocked(Asset.find).mockReturnValue(query([{ _id: new Types.ObjectId("507f1f77bcf86cd799439013"), mimeType: "image/png" }]) as never);
    vi.mocked(Course.findOneAndUpdate).mockReturnValue(query({ slideTheme: theme, slideThemeRevision: 1 }) as never);
    await expect(saveSlideCourseTheme(ownerId, courseId, { theme, revision: 0 })).resolves.toEqual({ theme, revision: 1 });
    expect(Asset.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: new Types.ObjectId(ownerId), courseId: new Types.ObjectId(courseId), status: "ready" }));
  });
  it("validates merged slide overrides and their image MIME type before writing", async () => {
    const { id, ...snapshot } = composeLearningPage({ ...createTemplateSlide("cover", 0), id: "page" });
    snapshot.composition!.masterOverrides = { content: { x: 1180, width: 1256 } };
    await expect(saveCourseSlide(ownerId, courseId, id, snapshot)).rejects.toMatchObject({ status: 400 });
    snapshot.composition!.masterOverrides = { header: { logo: { src: "/api/assets/507f1f77bcf86cd799439013/file" } } };
    vi.mocked(Asset.find).mockReturnValue(query([{ _id: new Types.ObjectId("507f1f77bcf86cd799439013"), mimeType: "audio/mpeg" }]) as never);
    await expect(saveCourseSlide(ownerId, courseId, id, snapshot)).rejects.toMatchObject({ status: 400 });
    expect(Slide.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("saves legacy per-slide master metadata with the existing slide revision boundary", async () => {
    const snapshot = { ...createTemplateSlide("image-text", 0), masterOverrides: { enabled: true, header: { color: "#123456" } }, numbering: { value: "B2" } };
    vi.mocked(Slide.findOneAndUpdate).mockReturnValue(query({ ...snapshot, slideId: "legacy", revision: 1 }) as never);
    const saved = await saveCourseSlide(ownerId, courseId, "legacy", snapshot);
    expect(saved).toMatchObject({ template: snapshot.template, masterOverrides: snapshot.masterOverrides, numbering: snapshot.numbering, revision: 1, schemaVersion: 2 });
    expect(Slide.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ revision: 0 }), expect.objectContaining({ $set: expect.objectContaining({ masterOverrides: snapshot.masterOverrides, numbering: snapshot.numbering }) }), expect.anything());
  });
  it("rejects course changes that would invalidate a slide's partial content region", async () => {
    vi.mocked(Slide.find).mockReturnValue(query([{ title: "Override slide", composition: { masterOverrides: { content: { y: 620 } } } }]) as never);
    await expect(saveSlideCourseTheme(ownerId, courseId, { theme: { ...defaultSlideTheme, master: institutionalGreenMaster }, revision: 0 })).rejects.toMatchObject({ status: 400 });
    expect(Course.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("provides a legacy default without requiring a migration", async () => {
    await expect(getSlideCourseTheme(ownerId, courseId)).resolves.toEqual({ theme: defaultSlideTheme, revision: 0 });
  });
  it("persists an independently revisioned theme on an owned slide course", async () => {
    const theme = { ...defaultSlideTheme, primaryColor: "#123456", preset: "custom" as const };
    vi.mocked(Course.findOneAndUpdate).mockReturnValue(query({ slideTheme: theme, slideThemeRevision: 1 }) as never);
    await expect(saveSlideCourseTheme(ownerId, courseId, { theme, revision: 0 })).resolves.toEqual({ theme, revision: 1 });
    expect(Course.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ ownerId: new Types.ObjectId(ownerId), editorType: "slide", $or: [{ slideThemeRevision: 0 }, { slideThemeRevision: { $exists: false } }] }), { $set: { slideTheme: theme }, $inc: { slideThemeRevision: 1 } }, { new: true, runValidators: true });
  });
  it("rejects theme conflicts", async () => {
    vi.mocked(Course.findOneAndUpdate).mockReturnValue(query(null) as never);
    await expect(saveSlideCourseTheme(ownerId, courseId, { theme: defaultSlideTheme, revision: 2 })).rejects.toMatchObject({ status: 409 });
  });
});
