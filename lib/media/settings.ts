import type { ClientSession } from "mongoose";
import { PlatformSettings } from "@/models/PlatformSettings";
import { requireRole } from "@/lib/auth/authorization";
import { audit, securityTransaction } from "@/lib/admin/transactions";
import { DashboardError } from "@/lib/dashboard/rules";
import { testStorageConnection } from "./service";
import { mediaStorageSettingsSchema, mediaStorageTestSchema, type MediaStorageSettings } from "./settings-schema";
import { localBrowserRoot, validateLocalDirectorySelection } from "./local-browser";

export async function requireStorageAdmin(actorId: string, session?: ClientSession) {
  return requireRole(["super_admin"], actorId, session);
}

export async function getMediaStorageSettings(actorId: string): Promise<MediaStorageSettings> {
  await requireStorageAdmin(actorId);
  const settings = await PlatformSettings.findById("platform").lean();
  return {
    provider: settings?.mediaStorageProvider === "local" ? "local" : "s3",
    revision: settings?.mediaStorageRevision ?? 0,
    local: { directory: settings?.mediaLocalDirectory || process.env.MEDIA_LOCAL_DIRECTORY || null, browseRoot: localBrowserRoot() },
    s3: { bucket: process.env.AWS_S3_BUCKET || null, region: process.env.AWS_REGION || null },
  };
}

async function selectedLocalDirectory(input: { provider: string; localDirectory?: string }) {
  if (input.provider !== "local") return undefined;
  if (input.localDirectory) return (await validateLocalDirectorySelection(input.localDirectory)).path;
  const settings = await PlatformSettings.findById("platform").lean();
  return settings?.mediaLocalDirectory || process.env.MEDIA_LOCAL_DIRECTORY || undefined;
}

export async function testMediaStorageSettings(actorId: string, input: unknown) {
  const parsed = mediaStorageTestSchema.parse(input);
  await requireStorageAdmin(actorId);
  return testStorageConnection(parsed.provider, await selectedLocalDirectory(parsed));
}

export async function updateMediaStorageSettings(actorId: string, input: unknown) {
  const parsed = mediaStorageSettingsSchema.parse(input);
  await requireStorageAdmin(actorId);
  const directory = await selectedLocalDirectory(parsed);
  // Do not hold a transaction open during network/filesystem operations.
  // Every save performs a fresh probe, including when the UI already tested it.
  await testStorageConnection(parsed.provider, directory);
  return securityTransaction(async (session) => {
    await requireStorageAdmin(actorId, session);
    const previous = await PlatformSettings.findById("platform").session(session).lean();
    if ((previous?.mediaStorageRevision ?? 0) !== parsed.revision) throw new DashboardError("Storage settings changed. Reload this page before saving again.", 409);
    await PlatformSettings.updateOne({ _id: "platform" }, {
      $set: { mediaStorageProvider: parsed.provider, ...(directory ? { mediaLocalDirectory: directory } : {}) }, $inc: { mediaStorageRevision: 1 },
    }, { upsert: true, runValidators: true, session });
    await audit(session, { actorId, action: "settings.media-storage", targetType: "settings", metadata: { previousProvider: previous?.mediaStorageProvider ?? "s3", provider: parsed.provider, ...(directory ? { previousDirectory: previous?.mediaLocalDirectory || process.env.MEDIA_LOCAL_DIRECTORY || null, directory } : {}) } });
    return { provider: parsed.provider, revision: parsed.revision + 1 };
  });
}
