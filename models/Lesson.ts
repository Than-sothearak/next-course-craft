import { Schema, model, models } from "mongoose";

const LessonSchema = new Schema({
  courseId: { type: Schema.Types.ObjectId, required: true, index: true },
  editorId: { type: String, maxlength: 64 },
  sectionId: { type: String, required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  order: { type: Number, required: true, min: 0 },
  lessonType: { type: String, enum: ["content", "quiz"], default: "content" },
  blocks: { type: [Schema.Types.Mixed], default: [] },
  revision: { type: Number, default: 0, min: 0 },
  settings: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, optimisticConcurrency: true });
LessonSchema.index({ courseId: 1, sectionId: 1, order: 1 });
LessonSchema.index({ courseId: 1, editorId: 1 }, { unique: true, partialFilterExpression: { editorId: { $type: "string" } } });
export const Lesson = models.Lesson ?? model("Lesson", LessonSchema);
