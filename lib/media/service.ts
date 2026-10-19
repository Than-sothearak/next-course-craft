import { randomUUID } from "node:crypto";
import { PlatformSettings } from "@/models/PlatformSettings";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { LocalStorageProvider } from "./providers/local";
import { S3StorageProvider } from "./providers/s3";
import type { StorageFile, StorageProvider, StorageProviderName } from "./providers/types";

export type StoredMedia = {
  _id?: unknown; storageProvider?: string | null; storageKey?: string | null;
  storageDirectory?: string | null;
  objectKey: string; mimeType: string; size: number;
};

export function mediaLocation(asset: StoredMedia): { provider: StorageProviderName; key: string } {
  const name = asset.storageProvider ?? "s3";
  if (name !== "local" && name !== "s3") throw new DashboardError("Unknown media storage provider.", 503);
  // Legacy S3 objects keep their original key, independently of active settings.
  return { provider: name, key: asset.storageKey || asset.objectKey };
}

export function storageProvider(name: StorageProviderName, directory?: string | null): StorageProvider {
  switch (name) {
    case "local": return new LocalStorageProvider(directory ?? undefined);
    case "s3": return new S3StorageProvider();
    default: throw new DashboardError("Unknown media storage provider.", 503);
  }
}

export async function activeStorageProvider(): Promise<StorageProviderName> {
  return (await activeStorageConfiguration()).provider;
}

export async function activeStorageConfiguration(): Promise<{ provider: StorageProviderName; directory?: string }> {
  await connectToDatabase();
  const settings = await PlatformSettings.findById("platform").lean();
  const provider = settings?.mediaStorageProvider ?? "s3";
  if (provider !== "local" && provider !== "s3") throw new DashboardError("Invalid active storage provider.", 503);
  return { provider, ...(provider === "local" ? { directory: settings?.mediaLocalDirectory || process.env.MEDIA_LOCAL_DIRECTORY } : {}) };
}

export function mediaStorageFile(asset: StoredMedia): StorageFile {
  return { key: mediaLocation(asset).key, size: asset.size, contentType: asset.mimeType, assetId: String(asset._id ?? "") };
}

export async function readStoredMedia(asset: StoredMedia, options?: { range?: string; signal?: AbortSignal }) {
  const provider = mediaLocation(asset).provider;
  try { return await storageProvider(provider, asset.storageDirectory).read(mediaStorageFile(asset), options); }
  catch (error) {
    if (error instanceof DashboardError || options?.signal?.aborted) throw error;
    throw new DashboardError(provider === "local" ? "The media file could not be read. Check the local storage mount and server permissions." : "The media file could not be read from S3. Check the bucket and server permissions.", 502);
  }
}

export function deleteStoredMedia(asset: StoredMedia) {
  const location = mediaLocation(asset);
  return storageProvider(location.provider, asset.storageDirectory).delete(location.key);
}

// Bound exports and copies even when storage returns a corrupt Content-Length.
export async function storedMediaBytes(asset: StoredMedia) {
  const response = await readStoredMedia(asset);
  if (!response.ok || !response.body) throw new DashboardError("The media file could not be read.", 502);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let count = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > asset.size) throw new DashboardError("Media changed while it was being read.", 409);
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  if (count !== asset.size) throw new DashboardError("Media changed while it was being read.", 409);
  return Buffer.concat(chunks, count);
}

export async function testStorageConnection(name: StorageProviderName, directory?: string) {
  const provider = storageProvider(name, directory);
  const key = `storage-probes/${randomUUID()}`;
  const body = Buffer.from(`CourseCraft storage probe ${randomUUID()}`);
  const file = { key, body, size: body.length, contentType: "application/octet-stream", assetId: "storage-probe" };
  let failure: unknown;
  try {
    await provider.upload(file);
    const metadata = await provider.metadata(key);
    if (metadata.size !== body.length) throw new Error("Size mismatch");
    const response = await provider.read(file);
    if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(body)) throw new Error("Read mismatch");
  } catch (error) { failure = error; }
  finally {
    // Attempt cleanup even after an ambiguous upload failure.
    try { await provider.delete(key); } catch (error) { failure ??= error; }
  }
  if (failure) {
    if (failure instanceof DashboardError) throw failure;
    throw new DashboardError(name === "local"
      ? "Local storage test failed. Check the persistent directory, free space, and the server user's read/write permissions."
      : "S3 connection test failed. Check the bucket, region, credentials or IAM role, and object read/write/delete permissions.", 503);
  }
  return { provider: name, connected: true, checkedAt: new Date().toISOString(), message: "Upload, metadata, read, and delete checks passed." };
}
