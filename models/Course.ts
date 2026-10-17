import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { courseEditorTypes } from "@/lib/editor/editor-type";
import { slideThemeIds } from "@/lib/slides/themes";

const SectionSchema = new Schema({
  id: { type: String, required: true, maxlength: 64 },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  order: { type: Number, required: true, min: 0 },
}, { _id: false });

const CourseThemeSchema = new Schema({
  preset: { type: String, enum: ["ocean", "forest", "sunset", "violet", "slate", "custom"], default: "ocean" },
  primaryColor: { type: String, match: /^#[\da-fA-F]{6}$/, default: "#2f5f9f" },
  accentColor: { type: String, match: /^#[\da-fA-F]{6}$/, default: "#ff876c" },
  fontFamily: { type: String, enum: ["sans", "serif", "rounded"], default: "sans" },
  cover: { type: new Schema({
    template: { type: String, enum: ["gradient", "solid", "image", "waves", "geometric", "editorial"], default: "gradient" },
    backgroundColor: { type: String, match: /^#[\da-fA-F]{6}$/ },
    textColor: { type: String, match: /^#[\da-fA-F]{6}$/, default: "#ffffff" },
    alignment: { type: String, enum: ["left", "center"], default: "center" },
    imageSrc: { type: String, default: "" },
    imageAlt: { type: String, maxlength: 500, default: "" },
    imagePosition: { type: String, enum: ["center", "top", "bottom"], default: "center" },
    overlayOpacity: { type: Number, min: 0, max: 90, default: 55 },
  }, { _id: false }), default: undefined },
}, { _id: false });

const CourseSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  workspaceId: { type: Schema.Types.ObjectId, default: null, index: true },
  folderId: { type: Schema.Types.ObjectId, default: null, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  editorType: { type: String, enum: courseEditorTypes, default: "block" },
  description: { type: String, default: "", maxlength: 5_000 },
  descriptionHtml: { type: String, maxlength: 100_000 },
  authorVisible: { type: Boolean, default: true },
  coverImage: { type: String, default: null },
  sections: { type: [SectionSchema], default: [] },
  language: { type: String, default: "en" },
  theme: { type: CourseThemeSchema, default: () => ({}) },
  slideTheme: { type: new Schema({
    preset: { type: String, enum: [...slideThemeIds, "custom"], default: "minimal" },
    primaryColor: { type: String, match: /^#[\da-fA-F]{6}$/, default: "#5546d9" },
    secondaryColor: { type: String, match: /^#[\da-fA-F]{6}$/, default: "#243052" },
    accentColor: { type: String, match: /^#[\da-fA-F]{6}$/, default: "#c45d32" },
    backgroundColor: { type: String, match: /^#[\da-fA-F]{6}$/, default: "#faf9f6" },
    fontFamily: { type: String, enum: ["sans", "serif", "rounded"], default: "sans" },
    headingScale: { type: Number, min: 0.8, max: 1.25, default: 1 },
    bodyScale: { type: Number, min: 0.9, max: 1.2, default: 1 },
    radius: { type: Number, min: 0, max: 32, default: 20 },
    density: { type: String, enum: ["compact", "comfortable", "spacious"], default: "comfortable" },
    buttonStyle: { type: String, enum: ["solid", "outline"], default: "solid" },
    cardStyle: { type: String, enum: ["flat", "outline", "elevated"], default: "flat" },
    master: { type: Schema.Types.Mixed, default: undefined },
  }, { _id: false, strict: true }), default: undefined },
  slideThemeRevision: { type: Number, default: 0, min: 0 },
  navigationMode: { type: String, enum: ["free", "sequential", "restricted"], default: "sequential" },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
  revision: { type: Number, default: 0, min: 0 },
  editorSaveLock: { type: String, default: null, select: false },
  editorSaveLockAt: { type: Date, default: null, select: false },
  generationLockToken: { type: String, default: null, select: false },
  generationLockUntil: { type: Date, default: null, select: false },
  deletedAt: { type: Date, default: null, index: true },
  completionSettings: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, optimisticConcurrency: true });
CourseSchema.index({ ownerId: 1, folderId: 1, updatedAt: -1 });
CourseSchema.index({ workspaceId: 1, folderId: 1, updatedAt: -1 });
export type CourseDocument = InferSchemaType<typeof CourseSchema>;
export const Course = (models.Course as Model<CourseDocument> | undefined) ?? model<CourseDocument>("Course", CourseSchema);
