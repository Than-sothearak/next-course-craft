import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SlideObjectSchema = new Schema({
  id: { type: String, required: true, maxlength: 64 },
  type: { type: String, enum: ["text", "image", "video", "button", "shape"], required: true },
  x: { type: Number, required: true, min: 0, max: 1280 },
  y: { type: Number, required: true, min: 0, max: 720 },
  width: { type: Number, required: true, min: 1, max: 1280 },
  height: { type: Number, required: true, min: 1, max: 720 },
  rotation: { type: Number, default: 0, min: -180, max: 180 },
  zIndex: { type: Number, default: 1, min: 0, max: 500 },
  visible: { type: Boolean, default: true },
  content: { type: Schema.Types.Mixed, default: "" },
  alt: { type: String, maxlength: 500, default: undefined },
  style: { type: Schema.Types.Mixed, default: {} },
  actions: { type: [Schema.Types.Mixed], default: [] },
  states: { type: [Schema.Types.Mixed], default: [] },
  activeStateId: { type: String, maxlength: 64, default: undefined },
}, { _id: false, strict: true });

const SlideSchema = new Schema({
  courseId: { type: Schema.Types.ObjectId, required: true },
  slideId: { type: String, required: true, maxlength: 64 },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  order: { type: Number, required: true, min: 0, max: 500 },
  layout: { type: String, enum: ["blank", "title", "titleContent", "twoColumn"], default: "blank" },
  width: { type: Number, required: true, enum: [1280], default: 1280 },
  height: { type: Number, required: true, enum: [720], default: 720 },
  background: { type: new Schema({ color: { type: String, match: /^#[\da-fA-F]{6}$/, default: "#ffffff" } }, { _id: false }), default: () => ({}) },
  objects: { type: [SlideObjectSchema], default: [] },
  template: { type: Schema.Types.Mixed, default: undefined },
  composition: { type: Schema.Types.Mixed, default: undefined },
  masterOverrides: { type: Schema.Types.Mixed, default: undefined },
  numbering: { type: Schema.Types.Mixed, default: undefined },
  interactions: { type: [Schema.Types.Mixed], default: [] },
  notes: { type: String, maxlength: 10_000, default: "" },
  schemaVersion: { type: Number, enum: [1, 2, 3], default: 1 },
  revision: { type: Number, min: 0, default: 0 },
}, { timestamps: true, optimisticConcurrency: true, strict: true });
SlideSchema.index({ courseId: 1, order: 1 });
SlideSchema.index({ courseId: 1, slideId: 1 }, { unique: true });

export type SlideDocument = InferSchemaType<typeof SlideSchema>;
export const Slide = (models.Slide as Model<SlideDocument> | undefined) ?? model<SlideDocument>("Slide", SlideSchema);
