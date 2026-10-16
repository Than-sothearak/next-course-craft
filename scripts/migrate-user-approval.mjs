import { maintenanceDatabase, existingId, initializeControl } from "./admin-maintenance.mjs";

export function migrationFields(user, now = new Date()) {
  const changes = {};
  if (!["super_admin", "admin", "editor", "viewer"].includes(user.role)) {
    changes.role = user.role === "author" ? "editor" : "viewer";
    if (user.role) changes.legacyRole = user.role;
  }
  if (!["pending", "active", "rejected", "suspended"].includes(user.status)) changes.status = "pending";
  if (!user.createdAt) changes.createdAt = user._id.getTimestamp();
  if (typeof user.email === "string" && user.email !== user.email.trim().toLowerCase()) changes.email = user.email.trim().toLowerCase();
  if (Object.keys(changes).length || !user.updatedAt) changes.updatedAt = now;
  return changes;
}

async function inspectUsers(db) {
  const users = await db.collection("users").find({}, { projection: { role: 1, status: 1, email: 1, createdAt: 1, updatedAt: 1 } }).toArray();
  const seen = new Set();
  for (const user of users) {
    if (!user.email) continue;
    const email = user.email.trim().toLowerCase();
    if (seen.has(email)) throw new Error("Duplicate email addresses exist after normalization. Resolve account identities deliberately before migration; no records were changed.");
    seen.add(email);
  }
  return users;
}

export async function applyUserApprovalMigration(client, db, actorId) {
  const users = await inspectUsers(db);
  if (!(await db.collection("users").findOne({ _id: actorId }))) throw new Error("The maintenance actor must be an existing account.");
  const changed = users.filter((user) => Object.keys(migrationFields(user)).length);
  await initializeControl(db);
  for (const user of changed) {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection("securitycontrols").updateOne({ _id: "platform" }, { $inc: { revision: 1 } }, { session });
        const current = await db.collection("users").findOne({ _id: user._id }, { session });
        if (!current) return;
        const changes = migrationFields(current);
        if (!Object.keys(changes).length) return;
        await db.collection("users").updateOne({ _id: user._id }, { $set: changes }, { session });
        await db.collection("auditlogs").insertOne({ actorId, action: "users.migrate", targetType: "user", targetId: user._id, metadata: { previousRole: current.role ?? null, role: changes.role ?? current.role, previousStatus: current.status ?? null, status: changes.status ?? current.status }, createdAt: new Date() }, { session });
      });
    } finally { await session.endSession(); }
  }
  await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection("users").createIndex({ status: 1, createdAt: -1 });
  await db.collection("users").createIndex({ role: 1, status: 1 });
  await db.collection("rolepermissions").createIndex({ role: 1 }, { unique: true });
  await db.collection("courseassignments").createIndex({ courseId: 1, userId: 1 }, { unique: true });
  await db.collection("courseassignments").createIndex({ userId: 1, courseId: 1 });
  await db.collection("auditlogs").createIndex({ createdAt: -1, _id: -1 });
  return changed.length;
}

export async function runMigration() {
  const { client, db } = await maintenanceDatabase();
  try {
    const users = await inspectUsers(db);
    const changed = users.filter((user) => Object.keys(migrationFields(user)).length);
    console.log(`${users.length} existing accounts; ${changed.length} need migration. Missing statuses become pending. Course ownership is untouched.`);
    if (!process.argv.includes("--apply")) { console.log("Dry run only. Apply with --apply --confirm=MIGRATE_USERS and protected ADMIN_MAINTENANCE_ACTOR_ID."); return; }
    if (!process.argv.includes("--confirm=MIGRATE_USERS")) throw new Error("Explicit migration confirmation is required.");
    const actorId = existingId(process.env.ADMIN_MAINTENANCE_ACTOR_ID, "ADMIN_MAINTENANCE_ACTOR_ID");
    await applyUserApprovalMigration(client, db, actorId);
    console.log("User approval migration complete. Existing approved statuses were preserved; no account was automatically approved.");
  } finally { await client.close(); }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) await runMigration();
