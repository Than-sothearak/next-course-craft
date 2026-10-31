import { colorValueSchema } from "@/lib/color";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { courseThemeFontFamilyIds } from "@/lib/editor/theme";

const navigationAppearanceFields = {
  style: { type: String, enum: ["outline", "solid", "soft", "modern", "glass", "threeD"], default: "outline" },
  backgroundColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#4f46e5" },
  textColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#172033" },
  borderColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#172033" },
  fillOpacity: { type: Number, min: 0, max: 100, default: 100, validate: Number.isInteger },
  height: { type: Number, min: 28, max: 72, default: 36, validate: Number.isInteger },
  minWidth: { type: Number, min: 64, max: 200, default: 88, validate: Number.isInteger },
  paddingX: { type: Number, min: 4, max: 32, default: 12, validate: Number.isInteger },
  fontSize: { type: Number, min: 10, max: 18, default: 12, validate: Number.isInteger },
  iconSize: { type: Number, min: 12, max: 28, default: 15, validate: Number.isInteger },
  radius: { type: Number, min: 0, max: 36, default: 6, validate: Number.isInteger },
  borderWidth: { type: Number, min: 0, max: 4, default: 1, validate: Number.isInteger },
  depth: { type: Number, min: 2, max: 10, default: 4, validate: Number.isInteger },
};
const NavigationAppearanceSchema = new Schema(navigationAppearanceFields, { _id: false });
const NavigationButtonsSchema = new Schema({ ...navigationAppearanceFields,
  gap: { type: Number, min: 0, max: 24, default: 8, validate: Number.isInteger },
  overrides: { type: new Schema({
    previous: { type: NavigationAppearanceSchema, default: undefined }, restart: { type: NavigationAppearanceSchema, default: undefined }, next: { type: NavigationAppearanceSchema, default: undefined },
  }, { _id: false }), default: undefined },
}, { _id: false });

const SectionSchema = new Schema({
  id: { type: String, required: true, maxlength: 64 },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  order: { type: Number, required: true, min: 0 },
}, { _id: false });

const CourseThemeSchema = new Schema({
  preset: { type: String, enum: ["ocean", "forest", "sunset", "violet", "slate", "custom"], default: "ocean" },
  primaryColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#2f5f9f" },
  accentColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#ff876c" },
  fontFamily: { type: String, enum: [...courseThemeFontFamilyIds], default: "sans" },
  cover: { type: new Schema({
    template: { type: String, enum: ["gradient", "solid", "image", "waves", "geometric", "editorial"], default: "gradient" },
    backgroundColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success },
    textColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#ffffff" },
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
  description: { type: String, default: "", maxlength: 5_000 },
  descriptionHtml: { type: String, maxlength: 100_000 },
  authorVisible: { type: Boolean, default: true },
  coverImage: { type: String, default: null },
  sections: { type: [SectionSchema], default: [] },
  language: { type: String, default: "en" },
  theme: { type: CourseThemeSchema, default: () => ({}) },
  navigationMode: { type: String, enum: ["free", "sequential", "restricted"], default: "sequential" },
  courseLayout: { type: String, enum: ["standard", "slides"], default: "standard" },
  slideMaster: { type: new Schema({
    size: { type: new Schema({
      width: { type: Number, required: true, min: 480, max: 3840, validate: Number.isInteger },
      height: { type: Number, required: true, min: 480, max: 3840, validate: Number.isInteger },
    }, { _id: false }), default: undefined },
    template: { type: String, enum: ["paper", "midnight", "gradient", "warm"], default: "paper" },
    backgroundColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#ffffff" },
    textColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#172033" },
    accentColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#4f46e5" },
    footerText: { type: String, maxlength: 120, default: "" },
    showSlideNumber: { type: Boolean, default: true },
    navigationButtons: { type: NavigationButtonsSchema, default: undefined },
    navigationGuide: { type: new Schema({
      enabled: { type: Boolean, default: false },
      firstVisitOnly: { type: Boolean, default: true },
      nextText: { type: String, required: true, maxlength: 300, default: "Click Next to continue to the next slide. Complete any required activities first." },
      previousText: { type: String, required: true, maxlength: 300, default: "Use Previous to return to a slide you have already opened." },
      restartText: { type: String, required: true, maxlength: 300, default: "Restart replays this slide's video and audio without clearing your progress." },
    }, { _id: false }), default: undefined },
    header: { type: new Schema({
      background: { type: String, enum: ["transparent", "color", "image"], default: "transparent" },
      backgroundColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#ffffff" },
      textColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: undefined },
      imageSrc: { type: String, match: /^(?:|\/api\/assets\/[a-f\d]{24}\/file)$/i, default: "" },
      imagePosition: { type: String, enum: ["center", "top", "bottom"], default: "center" },
      overlayOpacity: { type: Number, min: 0, max: 90, default: 20 },
    }, { _id: false }), default: undefined },
    footer: { type: new Schema({
      height: { type: Number, min: 48, max: 160, default: 64, validate: Number.isInteger },
      fontSize: { type: Number, min: 10, max: 24, default: 12, validate: Number.isInteger },
      contentGap: { type: Number, min: 0, max: 32, default: 16, validate: Number.isInteger },
      content: { type: String, enum: ["text", "logos", "both"], default: "text" },
      logos: { type: [new Schema({
        id: { type: String, required: true, maxlength: 64 },
        src: { type: String, required: true, match: /^\/api\/assets\/[a-f\d]{24}\/file$/i },
        alt: { type: String, maxlength: 160, default: "" },
      }, { _id: false })], default: [], validate: { validator: (logos: unknown[]) => logos.length <= 12, message: "Use up to 12 footer logos." } },
      paddingX: { type: Number, min: 0, max: 64, default: 20 },
      paddingY: { type: Number, min: 0, max: 32, default: 8 },
      logoGapX: { type: Number, min: 0, max: 32, default: 8 },
      logoGapY: { type: Number, min: 0, max: 12, default: 4 },
      logoJustify: { type: String, enum: ["left", "center", "right", "between"], default: "center" },
      logoAlign: { type: String, enum: ["top", "middle", "bottom"], default: "middle" },
      backgroundColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#ffffff" },
      textColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#172033" },
      borderTop: { type: Boolean, default: true },
      borderColor: { type: String, validate: (value: string) => colorValueSchema.safeParse(value).success, default: "#cbd5e1" },
      borderWidth: { type: Number, min: 1, max: 6, default: 1 },
    }, { _id: false }), default: undefined },
    background: { type: new Schema({
      type: { type: String, enum: ["solid", "abstract", "image"], required: true },
      design: { type: String, enum: ["waves", "orbits", "prism", "ribbons", "dots", "glow"] },
      imageSrc: { type: String, match: /^(?:|\/api\/assets\/[a-f\d]{24}\/file)$/i, default: "" },
      imagePosition: { type: String, enum: ["center", "top", "bottom"], default: "center" },
      overlayOpacity: { type: Number, min: 0, max: 90, default: 30 },
    }, { _id: false }), default: undefined },
  }, { _id: false }), default: undefined },
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
