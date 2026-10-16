import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["editor", "viewer"], required: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
schema.index({ courseId: 1, userId: 1 }, { unique: true });
schema.index({ userId: 1, courseId: 1 });
export type CourseAssignmentDocument = InferSchemaType<typeof schema>;
export const CourseAssignment = (models.CourseAssignment as Model<CourseAssignmentDocument> | undefined) ?? model<CourseAssignmentDocument>("CourseAssignment", schema);
