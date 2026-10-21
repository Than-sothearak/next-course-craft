import { randomUUID } from "node:crypto";
import mongoose, { Types, type HydratedDocument } from "mongoose";
import type { MongoClient, ObjectId } from "mongodb";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { User, Course, CourseAssignment, AuditLog, RolePermission, SecurityControl, PlatformSettings, Workspace, WorkspaceMembership, WorkspaceInvitation, Folder, Asset, GenerationJob, GenerationCheckpoint, ExportJob, Lesson } from "@/models";
import { approvalAdapter } from "@/lib/auth/adapter";
import { requireActiveUser, requirePermission } from "@/lib/auth/authorization";
import { requireOwnerId } from "@/lib/dashboard/http";
import { resolveCourseAccess, courseAccessFilter } from "@/lib/workspaces/access";
import { mutateUser } from "@/lib/admin/users";
import { updateRolePermissions, updateSettings } from "@/lib/admin/roles";
import { assignCourse, mutateCourse } from "@/lib/admin/courses";
import { deleteAdminWorkspace, getAdminWorkspace, listAdminWorkspaces, updateAdminWorkspace } from "@/lib/admin/workspaces";
import { listQuerySchema } from "@/lib/admin/schemas";
import { listWorkspaces } from "@/lib/workspaces/services";
import { getDashboardListing } from "@/lib/dashboard/services/list";
import { acquireGenerationLease, releaseGenerationLease } from "@/lib/ai/generation-lease";
import type { UserDocument } from "@/models/User";
import { roleCeilings } from "@/lib/auth/policy";
import { bootstrapSuperAdmin } from "../scripts/bootstrap-super-admin.mjs";
import { applyUserApprovalMigration } from "../scripts/migrate-user-approval.mjs";
import { POST as createCourseApi } from "@/app/api/courses/route";
import { GET as usersApi, } from "@/app/api/admin/users/route";
import { PATCH as userMutationApi } from "@/app/api/admin/users/[userId]/route";
import { POST as htmlExport } from "@/app/api/courses/[courseId]/publish/route";
import { POST as scorm12Export } from "@/app/api/courses/[courseId]/publish/scorm12/route";
import { POST as scorm2004Export } from "@/app/api/courses/[courseId]/publish/scorm2004/route";
import { POST as pdfExport } from "@/app/api/courses/[courseId]/publish/pdf/route";
import { GET as mediaFile } from "@/app/api/assets/[assetId]/file/route";
import { POST as mediaUpload } from "@/app/api/courses/[courseId]/assets/route";
import { PUT as editorSave } from "@/app/api/courses/[courseId]/editor/route";
import { POST as lessonCreate } from "@/app/api/courses/[courseId]/lessons/route";
import { GET as storageSettingsApi, PUT as saveStorageSettingsApi } from "@/app/api/admin/settings/media-storage/route";
import { POST as testStorageApi } from "@/app/api/admin/settings/media-storage/test/route";
import * as mediaService from "@/lib/media/service";
import { updateMediaStorageSettings } from "@/lib/media/settings";
import { POST as generation } from "@/app/api/courses/[courseId]/generate/route";

const identity = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => identity.id ? { user: { id: identity.id, role: "super_admin", status: "active" } } : null) }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: async () => mongoose }));
vi.mock("@/lib/scorm/package", () => ({ buildScorm12Package: vi.fn(async () => ({ archive: Buffer.from("test-archive"), filename: "course.zip" })), buildScorm2004Package: vi.fn() }));
vi.mock("@/lib/pdf/course-handout", () => ({ buildCourseHandoutPdf: vi.fn() }));
vi.mock("@/lib/media/storage", async (original) => ({ ...await original<typeof import("@/lib/media/storage")>(), createMediaReadUrl: vi.fn(async () => "https://storage.invalid/private-url") }));

const uri = process.env.RBAC_TEST_MONGODB_URI;
const database = `coursecraft_rbac_test_${randomUUID().replaceAll("-", "")}`;
const models = [User, Course, CourseAssignment, AuditLog, RolePermission, SecurityControl, PlatformSettings, Workspace, WorkspaceMembership, WorkspaceInvitation, Folder, Asset, GenerationJob, GenerationCheckpoint, ExportJob, Lesson];
type Account = HydratedDocument<UserDocument>;
let users: Record<"super" | "admin" | "editor" | "other" | "viewer" | "pending", Account>;
const id = (account: Account) => account._id.toString();
const jsonRequest = (path: string, body: unknown, method = "POST") => new NextRequest(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(body) });

// Always creates and drops a randomly named database; never uses the URI's
// default database. The URI must point to an explicitly selected test server.
describe.skipIf(!uri)("administration against transactional MongoDB", () => {
  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: database, serverSelectionTimeoutMS: 10000 });
    const hello = await mongoose.connection.db!.command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("RBAC integration tests require transactions.");
    await Promise.all(models.map((model) => model.init()));
  }, 30000);
  afterAll(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    await Promise.all(models.map((model) => mongoose.connection.db!.collection(model.collection.collectionName).deleteMany({})));
    const entries = await Promise.all((["super", "admin", "editor", "other", "viewer", "pending"] as const).map(async (key) => [key, await User.create({ name: key, email: `${key}@example.com`, role: key === "super" ? "super_admin" : key === "other" ? "editor" : key === "pending" ? "viewer" : key, status: key === "pending" ? "pending" : "active" })] as const));
    users = Object.fromEntries(entries) as typeof users;
    identity.id = id(users.editor);
  });

  it.each(["google", "github"])("keeps a new %s OAuth account pending and blocks course creation", async (provider) => {
    const adapter = approvalAdapter(MongoDBAdapter(mongoose.connection.getClient() as unknown as MongoClient, { databaseName: database }));
    const created = await adapter.createUser!({ id: new Types.ObjectId().toString(), email: `${provider}@example.com`, name: provider, emailVerified: null });
    const stored = await User.findById(created.id).lean();
    expect(stored).toMatchObject({ role: "viewer", status: "pending" });
    identity.id = created.id;
    const response = await createCourseApi(jsonRequest("/api/courses", { title: "Denied course" }));
    expect(response.status).toBe(403);
    expect(await Course.countDocuments()).toBe(0);
  });

  it("approves a registration, assigns Editor, creates an owned course, and audits the approval", async () => {
    await mutateUser(id(users.admin), id(users.pending), { action: "approve", role: "editor", expectedUpdatedAt: users.pending.updatedAt.toISOString() });
    const approved = await User.findById(users.pending._id).lean();
    expect(approved?.status).toBe("active");
    expect(approved?.approvedBy?.toString()).toBe(id(users.admin));
    identity.id = id(users.pending);
    const response = await createCourseApi(jsonRequest("/api/courses", { title: "Approved course" }));
    expect(response.status).toBe(201);
    expect((await Course.findOne().lean())?.ownerId.toString()).toBe(identity.id);
    expect(await AuditLog.countDocuments({ action: "users.approve", targetId: users.pending._id })).toBe(1);
  });

  it("restricts workspace administration to Super Admin and reflects renamed workspaces for members", async () => {
    const workspace = await Workspace.create({ name: "Original team", ownerId: users.other._id });
    await WorkspaceMembership.create({ workspaceId: workspace._id, userId: users.editor._id, role: "editor" });
    for (const account of [users.admin, users.editor, users.viewer, users.pending]) {
      await expect(listAdminWorkspaces(id(account), listQuerySchema.parse({}))).rejects.toMatchObject({ status: 403 });
      await expect(getAdminWorkspace(id(account), workspace._id.toString())).rejects.toMatchObject({ status: 403 });
    }
    expect((await listAdminWorkspaces(id(users.super), listQuerySchema.parse({ q: "Original team" }))).items).toMatchObject([{ name: "Original team", memberCount: 2 }]);
    await updateAdminWorkspace(id(users.super), workspace._id.toString(), { name: "Renamed team", expectedUpdatedAt: workspace.updatedAt.toISOString() });
    expect(await listWorkspaces(id(users.editor))).toMatchObject([{ name: "Renamed team" }]);
    expect(await AuditLog.countDocuments({ targetType: "workspace", targetId: workspace._id, action: "workspaces.update" })).toBe(1);
  });

  it("blocks workspace deletion for active/deleted courses and folders, then removes only the empty workspace relationships", async () => {
    const workspace = await Workspace.create({ name: "Empty only", ownerId: users.other._id });
    const other = await Workspace.create({ name: "Keep team", ownerId: users.other._id });
    await WorkspaceMembership.create([{ workspaceId: workspace._id, userId: users.editor._id, role: "editor" }, { workspaceId: other._id, userId: users.editor._id, role: "viewer" }]);
    await WorkspaceInvitation.create([{ workspaceId: workspace._id, inviterId: users.other._id, email: "invite@example.com", role: "editor", tokenHash: "first", expiresAt: new Date(Date.now() + 86400000) }, { workspaceId: other._id, inviterId: users.other._id, email: "keep@example.com", role: "viewer", tokenHash: "second", expiresAt: new Date(Date.now() + 86400000) }]);
    const course = await Course.create({ title: "Must move first", ownerId: users.other._id, workspaceId: workspace._id });
    const input = { confirmName: workspace.name, expectedUpdatedAt: workspace.updatedAt.toISOString() };
    const remove = () => deleteAdminWorkspace(id(users.super), workspace._id.toString(), input);
    await expect(remove()).rejects.toMatchObject({ status: 409 });
    await Course.updateOne({ _id: course._id }, { $set: { deletedAt: new Date() } });
    await expect(remove()).rejects.toMatchObject({ status: 409 });
    await Course.updateOne({ _id: course._id }, { $set: { workspaceId: null } });
    const folder = await Folder.create({ name: "Folder", normalizedName: "folder", ownerId: users.other._id, workspaceId: workspace._id });
    await expect(remove()).rejects.toMatchObject({ status: 409 });
    await Folder.deleteOne({ _id: folder._id });
    await remove();
    expect(await Workspace.findById(workspace._id)).toBeNull();
    expect(await WorkspaceMembership.countDocuments({ workspaceId: workspace._id })).toBe(0);
    expect(await WorkspaceInvitation.countDocuments({ workspaceId: workspace._id })).toBe(0);
    expect(await WorkspaceMembership.countDocuments({ workspaceId: other._id })).toBe(1);
    expect(await WorkspaceInvitation.countDocuments({ workspaceId: other._id })).toBe(1);
    expect(await Course.findById(course._id)).not.toBeNull();
    expect(await AuditLog.countDocuments({ targetId: workspace._id, action: "workspaces.delete" })).toBe(1);
  });

  it("rolls back workspace deletion and relationship cleanup when audit logging fails", async () => {
    const workspace = await Workspace.create({ name: "Keep if audit fails", ownerId: users.other._id });
    await WorkspaceMembership.create({ workspaceId: workspace._id, userId: users.editor._id, role: "editor" });
    const failedAudit = vi.spyOn(AuditLog, "create").mockRejectedValueOnce(new Error("Audit unavailable"));
    try {
      await expect(deleteAdminWorkspace(id(users.super), workspace._id.toString(), { confirmName: workspace.name, expectedUpdatedAt: workspace.updatedAt.toISOString() })).rejects.toThrow("Audit unavailable");
      expect(await Workspace.findById(workspace._id)).not.toBeNull();
      expect(await WorkspaceMembership.countDocuments({ workspaceId: workspace._id })).toBe(1);
      expect(await AuditLog.countDocuments({ action: "workspaces.delete" })).toBe(0);
    } finally { failedAudit.mockRestore(); }
  });

  it("combines assigned course roles with global permissions and hides unassigned private courses", async () => {
    const course = await Course.create({ title: "Private course", ownerId: users.other._id });
    await expect(resolveCourseAccess(id(users.editor), course._id.toString(), "edit")).rejects.toMatchObject({ status: 404 });
    await assignCourse(id(users.other), course._id.toString(), { email: users.editor.email!, role: "editor" });
    await expect(resolveCourseAccess(id(users.editor), course._id.toString(), "edit")).resolves.toMatchObject({ ownerId: id(users.other), role: "editor" });
    await expect(resolveCourseAccess(id(users.editor), course._id.toString(), "courses.delete")).rejects.toMatchObject({ status: 403 });
    await assignCourse(id(users.other), course._id.toString(), { email: users.viewer.email!, role: "viewer" });
    await expect(resolveCourseAccess(id(users.viewer), course._id.toString(), "view")).resolves.toMatchObject({ role: "viewer" });
    await expect(resolveCourseAccess(id(users.viewer), course._id.toString(), "edit")).rejects.toMatchObject({ status: 403 });
    await expect(assignCourse(id(users.other), course._id.toString(), { email: users.viewer.email!, role: "editor" })).rejects.toMatchObject({ status: 400 });
    const listing = await getDashboardListing(id(users.editor));
    expect(listing.courses.map((item) => item.id)).toContain(course._id.toString());
    const hidden = await Course.create({ title: "Never assigned", ownerId: users.other._id });
    const accessible = await Course.find(await courseAccessFilter(id(users.editor), "courses.edit")).lean();
    expect(accessible.map((item) => item._id.toString())).not.toContain(hidden._id.toString());
  });

  it("lets Admin manage courses while blocking privileged user changes and role ceiling escalation", async () => {
    const course = await Course.create({ title: "Another author's course", ownerId: users.editor._id });
    await expect(resolveCourseAccess(id(users.admin), course._id.toString(), "edit")).resolves.toMatchObject({ role: "admin" });
    await expect(mutateUser(id(users.admin), id(users.pending), { action: "approve", role: "super_admin", expectedUpdatedAt: users.pending.updatedAt.toISOString() })).rejects.toMatchObject({ status: 403 });
    await expect(mutateUser(id(users.admin), id(users.super), { action: "suspend", reason: "No authority", expectedUpdatedAt: users.super.updatedAt.toISOString() })).rejects.toMatchObject({ status: 403 });
    await expect(updateRolePermissions(id(users.super), { role: "viewer", permissions: ["courses.view", "courses.edit"] })).rejects.toMatchObject({ status: 403 });
    await expect(updateRolePermissions(id(users.admin), { role: "editor", permissions: ["courses.view"] })).rejects.toMatchObject({ status: 403 });
  });

  it("revokes an existing session immediately on its next protected request after suspension or a policy change", async () => {
    expect(await requireOwnerId()).toBe(id(users.editor));
    await mutateUser(id(users.super), id(users.editor), { action: "suspend", reason: "Account review", expectedUpdatedAt: users.editor.updatedAt.toISOString() });
    await expect(requireOwnerId()).rejects.toMatchObject({ status: 403 });
    expect((await createCourseApi(jsonRequest("/api/courses", { title: "Blocked" }))).status).toBe(403);
    identity.id = id(users.other);
    await updateRolePermissions(id(users.super), { role: "editor", permissions: ["courses.view"] });
    await expect(requirePermission("courses.create")).rejects.toMatchObject({ status: 403 });
  });

  it("denies direct admin API calls and does not trust forged role claims in the session", async () => {
    const request = new NextRequest("http://localhost/api/admin/users");
    expect((await usersApi(request)).status).toBe(403);
    expect((await userMutationApi(jsonRequest("/api/admin/users/target", { action: "approve", role: "super_admin", expectedUpdatedAt: users.pending.updatedAt.toISOString() }, "PATCH"), { params: Promise.resolve({ userId: id(users.pending) }) })).status).toBe(403);
    identity.id = null;
    expect((await usersApi(request)).status).toBe(401);
  });

  it.each([htmlExport, scorm12Export, scorm2004Export, pdfExport])("blocks every publishing format for Viewers and pending/suspended sessions", async (handler) => {
    const course = await Course.create({ title: "Protected export", ownerId: users.viewer._id });
    for (const account of [users.viewer, users.pending]) {
      identity.id = id(account);
      const response = await handler(new NextRequest(`http://localhost/api/courses/${course._id}/publish`, { method: "POST" }), { params: Promise.resolve({ courseId: course._id.toString() }) });
      expect(response.status).toBe(403);
    }
    await User.updateOne({ _id: users.editor._id }, { $set: { status: "suspended" } });
    identity.id = id(users.editor);
    expect((await handler(new NextRequest("http://localhost/api/courses/export", { method: "POST" }), { params: Promise.resolve({ courseId: course._id.toString() }) })).status).toBe(403);
  });

  it("exports SCORM for an assigned Editor with the real course owner scope", async () => {
    const course = await Course.create({ title: "Assigned SCORM", ownerId: users.other._id });
    await assignCourse(id(users.other), course._id.toString(), { email: users.editor.email!, role: "editor" });
    const response = await scorm12Export(new NextRequest("http://localhost/api/courses/export", { method: "POST" }), { params: Promise.resolve({ courseId: course._id.toString() }) });
    expect(response.status).toBe(200);
    const { buildScorm12Package } = await import("@/lib/scorm/package");
    expect(buildScorm12Package).toHaveBeenCalledWith(expect.objectContaining({ ownerId: id(users.other) }));
  });

  it("serializes competing Super Admin suspensions so at least one active Super Admin remains", async () => {
    const second = await User.create({ name: "Second", email: "second@example.com", role: "super_admin", status: "active" });
    const result = await Promise.allSettled([
      mutateUser(id(users.super), second._id.toString(), { action: "suspend", reason: "Review", expectedUpdatedAt: second.updatedAt.toISOString() }),
      mutateUser(second._id.toString(), id(users.super), { action: "suspend", reason: "Review", expectedUpdatedAt: users.super.updatedAt.toISOString() }),
    ]);
    expect(result.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(await User.countDocuments({ role: "super_admin", status: "active" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "users.suspend" })).toBe(1);
    const active = await User.findOne({ role: "super_admin", status: "active" });
    await expect(mutateUser(active!._id.toString(), active!._id.toString(), { action: "delete", confirmEmail: active!.email!, expectedUpdatedAt: active!.updatedAt.toISOString() })).rejects.toMatchObject({ status: 403 });
  });

  it("transfers ownership, preserves content and creator identity, and audits deletion atomically", async () => {
    const workspace = await Workspace.create({ name: "Original team", ownerId: users.editor._id });
    const course = await Course.create({ title: "Transfer me", ownerId: users.editor._id, workspaceId: workspace._id });
    const lesson = await Lesson.create({ courseId: course._id, sectionId: "section", title: "Keep me", order: 0 });
    const asset = await Asset.create({ ownerId: users.editor._id, courseId: course._id, originalName: "image.png", objectKey: "stable/private/key", mimeType: "image/png", size: 5, status: "ready" });
    await mutateCourse(id(users.super), course._id.toString(), { action: "transfer", email: users.other.email!, confirmTitle: course.title });
    const moved = await Course.findById(course._id).lean();
    expect(moved?.ownerId.toString()).toBe(id(users.other));
    expect(moved?.createdBy?.toString()).toBe(id(users.editor));
    expect(moved?.workspaceId).toBeNull();
    expect((await Asset.findById(asset._id).lean())?.ownerId.toString()).toBe(id(users.other));
    expect((await Asset.findById(asset._id).lean())?.objectKey).toBe("stable/private/key");
    expect((await Lesson.findById(lesson._id).lean<{ title: string }>())?.title).toBe("Keep me");
    await expect(resolveCourseAccess(id(users.editor), course._id.toString(), "edit")).rejects.toMatchObject({ status: 404 });
    await mutateCourse(id(users.other), course._id.toString(), { action: "delete", confirmTitle: course.title }, false);
    expect(await AuditLog.countDocuments({ targetId: course._id, action: { $in: ["courses.transfer", "courses.delete"] } })).toBe(2);
  });

  it("blocks transfer while prompt generation is running and releases only the matching lease", async () => {
    const course = await Course.create({ title: "Generating", ownerId: users.editor._id });
    const lease = await acquireGenerationLease(id(users.editor), course._id.toString());
    await expect(mutateCourse(id(users.super), course._id.toString(), { action: "transfer", email: users.other.email!, confirmTitle: course.title })).rejects.toMatchObject({ status: 409 });
    await releaseGenerationLease({ ...lease, token: "incorrect" });
    await expect(acquireGenerationLease(id(users.editor), course._id.toString())).rejects.toMatchObject({ status: 409 });
    await releaseGenerationLease(lease);
    await expect(mutateCourse(id(users.super), course._id.toString(), { action: "transfer", email: users.other.email!, confirmTitle: course.title })).resolves.toMatchObject({ id: course._id.toString() });
  });

  it("bootstraps once by existing ID and refuses a different bootstrap account", async () => {
    await User.deleteMany({ role: "super_admin" });
    const client = mongoose.connection.getClient() as unknown as MongoClient;
    const db = client.db(database);
    const chosen = users.pending._id as unknown as ObjectId;
    await bootstrapSuperAdmin(client, db, chosen);
    await bootstrapSuperAdmin(client, db, chosen);
    await expect(bootstrapSuperAdmin(client, db, users.other._id as unknown as ObjectId)).rejects.toThrow("Bootstrap already");
    expect(await User.countDocuments({ role: "super_admin", status: "active" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "users.bootstrap" })).toBe(1);
  });

  it("migrates legacy users explicitly without approving them or changing OAuth accounts, courses, or ownership", async () => {
    const client = mongoose.connection.getClient() as unknown as MongoClient;
    const db = client.db(database);
    const legacyId = new Types.ObjectId();
    await db.collection("users").insertOne({ _id: legacyId, name: "Legacy", email: "Legacy@Example.com", role: "author" });
    const account = { userId: legacyId, provider: "github", providerAccountId: "stable-github-identity" };
    await db.collection("accounts").insertOne(account);
    const course = await Course.create({ title: "Keep ownership", ownerId: legacyId });
    expect(await applyUserApprovalMigration(client, db, users.super._id as unknown as ObjectId)).toBe(1);
    expect(await applyUserApprovalMigration(client, db, users.super._id as unknown as ObjectId)).toBe(0);
    expect(await User.findById(legacyId).lean()).toMatchObject({ role: "editor", status: "pending", email: "legacy@example.com" });
    expect((await Course.findById(course._id).lean())?.ownerId.toString()).toBe(legacyId.toString());
    expect(await db.collection("accounts").findOne({ userId: legacyId })).toMatchObject(account);
    await expect(requireActiveUser(legacyId.toString())).rejects.toMatchObject({ status: 403 });
    expect(await User.findById(users.super._id).lean()).toMatchObject({ role: "super_admin", status: "active" });
  });

  it("denies Media Storage reads, probes and saves to every non-Super Admin session", async () => {
    const probe = vi.spyOn(mediaService, "testStorageConnection");
    try {
      for (const account of [users.admin, users.editor, users.other, users.viewer, users.pending, null]) {
        identity.id = account ? id(account) : null;
        const status = account ? 403 : 401;
        expect((await storageSettingsApi(new NextRequest("http://localhost/api/admin/settings/media-storage"))).status).toBe(status);
        expect((await testStorageApi(jsonRequest("/api/admin/settings/media-storage/test", { provider: "local" }))).status).toBe(status);
        expect((await saveStorageSettingsApi(jsonRequest("/api/admin/settings/media-storage", { provider: "local", revision: 0 }, "PUT"))).status).toBe(status);
      }
      expect(probe).not.toHaveBeenCalled();
      expect(await PlatformSettings.countDocuments()).toBe(0);
    } finally { probe.mockRestore(); }
  });

  it("atomically switches Media Storage without changing AI settings or existing asset locations", async () => {
    await PlatformSettings.create({ _id: "platform", aiEnabled: false });
    const legacy = await Asset.create({ ownerId: users.editor._id, objectKey: "legacy/s3-key", originalName: "image.png", mimeType: "image/png", size: 8, status: "ready" });
    const probe = vi.spyOn(mediaService, "testStorageConnection").mockResolvedValue({ provider: "local", connected: true, checkedAt: new Date().toISOString(), message: "Passed" });
    try {
      identity.id = id(users.super);
      const response = await saveStorageSettingsApi(jsonRequest("/api/admin/settings/media-storage", { provider: "local", revision: 0 }, "PUT"));
      expect(response.status).toBe(200);
      expect(await PlatformSettings.findById("platform").lean()).toMatchObject({ aiEnabled: false, mediaStorageProvider: "local", mediaStorageRevision: 1 });
      expect(await mediaService.activeStorageProvider()).toBe("local");
      const original = await Asset.findById(legacy._id).lean();
      expect(mediaService.mediaLocation(original!)).toEqual({ provider: "s3", key: "legacy/s3-key" });
      expect(await AuditLog.countDocuments({ action: "settings.media-storage" })).toBe(1);
    } finally { probe.mockRestore(); }
  });

  it("does not change the active storage provider after a connection failure", async () => {
    await PlatformSettings.create({ _id: "platform", mediaStorageProvider: "s3" });
    const probe = vi.spyOn(mediaService, "testStorageConnection").mockRejectedValue(new Error("Disconnected"));
    try {
      await expect(updateMediaStorageSettings(id(users.super), { provider: "local", revision: 0 })).rejects.toThrow("Disconnected");
      expect(await PlatformSettings.findById("platform").lean()).toMatchObject({ mediaStorageProvider: "s3", mediaStorageRevision: 0 });
      expect(await AuditLog.countDocuments({ action: "settings.media-storage" })).toBe(0);
    } finally { probe.mockRestore(); }
  });

  it("serializes competing storage saves and rejects the stale revision", async () => {
    await PlatformSettings.create({ _id: "platform" });
    const probe = vi.spyOn(mediaService, "testStorageConnection").mockResolvedValue({ provider: "local", connected: true, checkedAt: new Date().toISOString(), message: "Passed" });
    try {
      const results = await Promise.allSettled([
        updateMediaStorageSettings(id(users.super), { provider: "local", revision: 0 }),
        updateMediaStorageSettings(id(users.super), { provider: "s3", revision: 0 }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { status: 409 } });
      expect((await PlatformSettings.findById("platform").lean())?.mediaStorageRevision).toBe(1);
      expect(await AuditLog.countDocuments({ action: "settings.media-storage" })).toBe(1);
    } finally { probe.mockRestore(); }
  });

  it("rolls back a storage switch if its audit event cannot be recorded", async () => {
    await PlatformSettings.create({ _id: "platform", aiEnabled: false });
    const probe = vi.spyOn(mediaService, "testStorageConnection").mockResolvedValue({ provider: "local", connected: true, checkedAt: new Date().toISOString(), message: "Passed" });
    const failedAudit = vi.spyOn(AuditLog, "create").mockRejectedValueOnce(new Error("Audit unavailable"));
    try {
      await expect(updateMediaStorageSettings(id(users.super), { provider: "local", revision: 0 })).rejects.toThrow("Audit unavailable");
      expect(await PlatformSettings.findById("platform").lean()).toMatchObject({ aiEnabled: false, mediaStorageProvider: "s3", mediaStorageRevision: 0 });
    } finally { failedAudit.mockRestore(); probe.mockRestore(); }
  });

  it("applies protected settings only for Super Admin and rolls back failed mutations with their audit events", async () => {
    await expect(updateSettings(id(users.admin), false)).rejects.toMatchObject({ status: 403 });
    await updateSettings(id(users.super), false);
    expect((await PlatformSettings.findById("platform").lean())?.aiEnabled).toBe(false);
    const before = await AuditLog.countDocuments();
    const course = await Course.create({ title: "Exact title", ownerId: users.editor._id });
    await expect(mutateCourse(id(users.super), course._id.toString(), { action: "delete", confirmTitle: "Wrong title" })).rejects.toMatchObject({ status: 400 });
    expect((await Course.findById(course._id).lean())?.deletedAt).toBeNull();
    expect(await AuditLog.countDocuments()).toBe(before);
  });

  it("rolls back an account decision if the mandatory audit record cannot be written", async () => {
    const failedAudit = vi.spyOn(AuditLog, "create").mockRejectedValueOnce(new Error("Audit unavailable"));
    try {
      await expect(mutateUser(id(users.super), id(users.editor), { action: "suspend", reason: "Review", expectedUpdatedAt: users.editor.updatedAt.toISOString() })).rejects.toThrow("Audit unavailable");
      expect((await User.findById(users.editor._id).lean())?.status).toBe("active");
      expect(await AuditLog.countDocuments()).toBe(0);
    } finally { failedAudit.mockRestore(); }
  });

  it("streams authorized media without a reusable storage redirect and denies new ranges after suspension", async () => {
    const course = await Course.create({ title: "Video", ownerId: users.other._id });
    const asset = await Asset.create({ ownerId: users.other._id, courseId: course._id, originalName: "clip.mp4", objectKey: "private/video", mimeType: "video/mp4", size: 10, status: "ready" });
    await assignCourse(id(users.other), course._id.toString(), { email: users.viewer.email!, role: "viewer" });
    identity.id = id(users.viewer);
    const fetchMedia = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("clip", { status: 206, headers: { "Content-Range": "bytes 0-3/10", "Accept-Ranges": "bytes" } }));
    try {
      const request = new NextRequest(`http://localhost/api/assets/${asset._id}/file`, { headers: { Range: "bytes=0-3" } });
      const context = { params: Promise.resolve({ assetId: asset._id.toString() }) };
      const response = await mediaFile(request, context);
      expect(response.status).toBe(206);
      expect(response.headers.get("Location")).toBeNull();
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.text()).toBe("clip");
      await mutateUser(id(users.super), id(users.viewer), { action: "suspend", reason: "Review", expectedUpdatedAt: users.viewer.updatedAt.toISOString() });
      expect((await mediaFile(request, context)).status).toBe(403);
      expect(fetchMedia).toHaveBeenCalledTimes(1);
    } finally { fetchMedia.mockRestore(); }
  });

  it.each([mediaUpload, editorSave, lessonCreate, generation])("denies authoring, uploads, lessons, and AI for a Viewer even with a course assignment", async (handler) => {
    const course = await Course.create({ title: "Read only", ownerId: users.other._id });
    await assignCourse(id(users.other), course._id.toString(), { email: users.viewer.email!, role: "viewer" });
    identity.id = id(users.viewer);
    const response = await handler(jsonRequest(`/api/courses/${course._id}`, {}), { params: Promise.resolve({ courseId: course._id.toString() }) });
    expect(response.status).toBe(403);
  });

  it("requires publishing permission independently of editing and exporting permissions", async () => {
    const course = await Course.create({ title: "Policy controlled", ownerId: users.editor._id });
    await updateRolePermissions(id(users.super), { role: "editor", permissions: roleCeilings.editor.filter((permission) => permission !== "courses.publish") });
    expect((await scorm12Export(new NextRequest("http://localhost/api/courses/export", { method: "POST" }), { params: Promise.resolve({ courseId: course._id.toString() }) })).status).toBe(403);
  });

  it("allows an approved course editor to cancel a saved job when AI is disabled", async () => {
    const course = await Course.create({ title: "Cancel safely", ownerId: users.editor._id });
    const job = await GenerationJob.create({ ownerId: users.editor._id, courseId: course._id, status: "planning", input: {}, sourceFileName: "source.pdf", sourceContentType: "application/pdf", expiresAt: new Date(Date.now() + 86400000) });
    await updateSettings(id(users.super), false);
    const form = new FormData(); form.set("action", "cancelGeneration"); form.set("jobId", job._id.toString());
    const response = await generation(new NextRequest("http://localhost/api/courses/generate", { method: "POST", body: form }), { params: Promise.resolve({ courseId: course._id.toString() }) });
    expect(response.status).toBe(200);
    expect((await GenerationJob.findById(job._id).lean<{ status: string }>())?.status).toBe("cancelled");
    await expect(mutateCourse(id(users.super), course._id.toString(), { action: "transfer", email: users.other.email!, confirmTitle: course.title })).resolves.toMatchObject({ id: course._id.toString() });
  });

  it("denies access for missing or invalid database authorization fields despite an active-looking session", async () => {
    await User.collection.updateOne({ _id: users.editor._id }, { $set: { role: "unknown-role" } });
    await expect(requireOwnerId()).rejects.toMatchObject({ status: 403 });
    await User.collection.updateOne({ _id: users.editor._id }, { $set: { role: "editor" }, $unset: { status: "" } });
    await expect(requireOwnerId()).rejects.toMatchObject({ status: 403 });
  });
});
