import { Types } from "mongoose";
import { User } from "@/models";
import { requireAdmin } from "@/lib/auth/authorization";
import { DashboardError } from "@/lib/dashboard/rules";
import { audit, securityTransaction } from "./transactions";
import { decideUserMutation } from "./user-policy";
import type { UserMutation } from "./schemas";
import { idSchema } from "./schemas";

export async function mutateUser(actorId: string, userId: string, input: UserMutation) {
  idSchema.parse(userId);
  return securityTransaction(async (session) => {
    const permission = input.action === "approve" || input.action === "reject" ? "users.approve" : input.action === "role" ? "roles.assign" : "users.manage";
    const actor = await requireAdmin(permission, actorId, session);
    const target = await User.findById(userId).session(session);
    if (!target) throw new DashboardError("Account not found.", 404);
    if (!target.updatedAt || target.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new DashboardError("This account changed. Refresh and try again.", 409);
    const current = { id: userId, role: target.role, status: target.status ?? "pending", deletedAt: target.deletedAt };
    const count = await User.countDocuments({ role: "super_admin", status: "active", deletedAt: null }).session(session);
    const next = decideUserMutation(actor, current, input, count);
    const now = new Date();
    if (input.action === "approve") {
      target.approvedBy = new Types.ObjectId(actor.id);
      target.approvedAt = now;
      target.suspendedBy = null;
      target.suspendedAt = null;
      target.suspensionReason = "";
    }
    if (input.action === "suspend") {
      target.suspendedBy = new Types.ObjectId(actor.id);
      target.suspendedAt = now;
      target.suspensionReason = input.reason;
    }
    if (input.action === "reactivate") {
      target.suspendedBy = null;
      target.suspendedAt = null;
      target.suspensionReason = "";
    }
    if (input.action === "delete") {
      if (!target.email || input.confirmEmail.toLowerCase() !== target.email.toLowerCase()) throw new DashboardError("The email confirmation did not match.", 400);
      target.deletedAt = now;
    }
    target.set({ role: next.role, status: next.status });
    await target.save({ session });
    await audit(session, {
      actorId, action: `users.${input.action}`, targetType: "user", targetId: userId,
      metadata: { previousRole: current.role, role: next.role, previousStatus: current.status, status: next.status },
    });
    return { id: userId, role: next.role, status: next.status };
  });
}
