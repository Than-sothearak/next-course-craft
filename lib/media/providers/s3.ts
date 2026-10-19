import { DashboardError } from "@/lib/dashboard/rules";
import { createMediaReadUrl, deleteMediaObject, inspectMediaObject, putMediaObject } from "../storage";
import type { StorageFile, StorageMetadata, StorageProvider, StorageUpload } from "./types";

// Reuse the existing private bucket, credential chain, signing and object operations.
export class S3StorageProvider implements StorageProvider {
  async upload(input: StorageUpload) {
    if (!Buffer.isBuffer(input.body)) throw new DashboardError("S3 browser uploads must use the presigned upload policy.", 400);
    if (input.body.length !== input.size) throw new DashboardError("Invalid upload size.", 400);
    await putMediaObject({ objectKey: input.key, assetId: input.assetId, contentType: input.contentType, body: input.body });
  }
  async read(file: StorageFile, options: { range?: string; signal?: AbortSignal } = {}) {
    const url = await createMediaReadUrl({ objectKey: file.key, contentType: file.contentType });
    const response = await fetch(url, { cache: "no-store", headers: options.range ? { Range: options.range } : undefined, signal: options.signal ?? AbortSignal.timeout(60_000) });
    if (!response.ok && response.status !== 416) throw new DashboardError("The media file could not be read from S3.", 502);
    return response;
  }
  async metadata(key: string): Promise<StorageMetadata> {
    const object = await inspectMediaObject(key);
    return { size: object.ContentLength ?? -1, contentType: object.ContentType, assetId: object.Metadata?.["asset-id"] };
  }
  async delete(key: string) { await deleteMediaObject(key); }
}
