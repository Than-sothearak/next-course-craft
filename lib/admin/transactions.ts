import mongoose, { type ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { AuditLog, SecurityControl, RolePermission, CourseAssignment, PlatformSettings } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";

export async function securityTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  await connectToDatabase();
  await Promise.all([SecurityControl.init(), AuditLog.init(), RolePermission.init(), CourseAssignment.init(), PlatformSettings.init()]);
  await SecurityControl.updateOne({ _id: "platform" }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      // Every authorization mutation writes this document first. Concurrent
      // demotions cannot both observe themselves as the penultimate admin.
      await SecurityControl.updateOne({ _id: "platform" }, { $inc: { revision: 1 } }, { session });
      return work(session);
    });
    return result as T;
  } catch (error) {
    if (error instanceof Error && /Transaction numbers are only allowed|does not support retryable writes/i.test(error.message)) {
      throw new DashboardError("Administration requires a MongoDB replica set with transactions enabled.", 503);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function audit(session: ClientSession, event: {
  actorId: string;
  action: string;
  targetType: "user" | "course" | "role" | "settings";
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await AuditLog.create([event], { session });
}
