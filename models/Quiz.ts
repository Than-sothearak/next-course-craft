import { Schema, model, models } from "mongoose";

const QuizSchema = new Schema({
  courseId: { type: Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, required: true, index: true },
  questions: { type: [Schema.Types.Mixed], default: [] },
  passingScore: { type: Number, default: 80, min: 0, max: 100 },
  attemptSettings: { type: Schema.Types.Mixed, default: {} },
  feedbackRules: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
export const Quiz = models.Quiz ?? model("Quiz", QuizSchema);
