import { maintenanceDatabase, existingId, initializeControl } from "./admin-maintenance.mjs";

export async function bootstrapSuperAdmin(client, db, userId) {
  await initializeControl(db);
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const control = await db.collection("securitycontrols").findOneAndUpdate({ _id: "platform" }, { $inc: { revision: 1 } }, { session, returnDocument: "after" });
      const user = await db.collection("users").findOne({ _id: userId }, { session });
      if (!user || user.deletedAt) throw new Error("The protected account does not exist or has been removed.");
      if (control.bootstrapUserId) {
        if (control.bootstrapUserId.equals(userId) && user.role === "super_admin" && user.status === "active") return;
        throw new Error("Bootstrap already completed. Use the existing Super Admin to manage further administrators.");
      }
      if (await db.collection("users").countDocuments({ role: "super_admin" }, { session })) throw new Error("A Super Admin already exists. Bootstrap is refused.");
      const now = new Date();
      await db.collection("users").updateOne({ _id: userId }, { $set: { role: "super_admin", status: "active", approvedBy: userId, approvedAt: now, updatedAt: now } }, { session });
      await db.collection("securitycontrols").updateOne({ _id: "platform" }, { $set: { bootstrapUserId: userId, updatedAt: now } }, { session });
      await db.collection("auditlogs").insertOne({ actorId: userId, action: "users.bootstrap", targetType: "user", targetId: userId, metadata: { role: "super_admin", status: "active" }, createdAt: now }, { session });
    });
    console.log("Super Admin bootstrap complete (safe to repeat for this same active account).");
  } finally {
    await session.endSession();
  }
}

export async function runBootstrap() {
  const userId = existingId(process.env.BOOTSTRAP_SUPER_ADMIN_USER_ID, "BOOTSTRAP_SUPER_ADMIN_USER_ID");
  if (!process.argv.includes(`--confirm-user-id=${userId.toHexString()}`)) throw new Error("Explicitly confirm the protected account ID with --confirm-user-id=<same account ID>.");
  const { client, db } = await maintenanceDatabase();
  try { await bootstrapSuperAdmin(client, db, userId); }
  finally { await client.close(); }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) await runBootstrap();
