import { randomUUID } from "node:crypto";
import { Course } from "@/models/Course";
import { DashboardError } from "@/lib/dashboard/rules";

export async function acquireGenerationLease(ownerId: string, courseId: string) {
  const token = randomUUID();
  const course = await Course.findOneAndUpdate({ _id: courseId, ownerId, deletedAt: null, $or: [{ generationLockUntil: null }, { generationLockUntil: { $lte: new Date() } }] }, { $set: { generationLockToken: token, generationLockUntil: new Date(Date.now() + 360000) } }, { new: true }).select("_id").lean();
  if (!course) throw new DashboardError("Generation is already running or this course changed. Try again shortly.", 409);
  return { courseId, token };
}

export async function releaseGenerationLease(lease: { courseId: string; token: string }) {
  await Course.updateOne({ _id: lease.courseId, generationLockToken: lease.token }, { $set: { generationLockToken: null, generationLockUntil: null } });
}
