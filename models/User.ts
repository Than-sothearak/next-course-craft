import { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
  name: { type: String, trim: true, maxlength: 160 },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  emailVerified: { type: Date, default: null },
  image: { type: String, default: null },
  role: { type: String, enum: ["author", "admin"], default: "author" },
  preferences: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export const User = models.User ?? model("User", UserSchema);
