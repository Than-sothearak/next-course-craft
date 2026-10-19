import { Types } from "mongoose";
import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { mediaUploadInputSchema, type MediaUploadInput } from "../schemas";
import { createMediaUploadPost } from "../storage";
import { activeStorageConfiguration, deleteStoredMedia, mediaLocation, storageProvider } from "../service";
import { validateStoredMediaType } from "../validate-file";

export async function beginMediaUpload(
  ownerId: string,
  courseId: string,
  input: MediaUploadInput,
) {
  const parsed = mediaUploadInputSchema.parse(input);
  const assetId = new Types.ObjectId();
  const { provider, directory } = await activeStorageConfiguration();
  const objectKey = `${ownerId}/${courseId}/${assetId.toString()}`;
  const safeName = parsed.fileName.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const asset = await Asset.create({
    _id: assetId,
    ownerId,
    courseId,
    objectKey,
    storageProvider: provider,
    storageKey: objectKey,
    ...(directory ? { storageDirectory: directory } : {}),
    originalName: safeName,
    mimeType: parsed.contentType,
    size: parsed.size,
    status: "pending",
  });

  try {
    if (provider === "local") return {
      assetId: assetId.toString(),
      uploadUrl: `/api/courses/${courseId}/assets/${assetId}/upload`,
      method: "PUT" as const,
      fields: {},
      storageProvider: provider,
    };
    const upload = await createMediaUploadPost({
      objectKey,
      assetId: assetId.toString(),
      contentType: parsed.contentType,
      size: parsed.size,
    });
    return {
      assetId: assetId.toString(),
      uploadUrl: upload.url,
      fields: upload.fields,
      method: "POST" as const,
      storageProvider: provider,
    };
  } catch (error) {
    await Asset.deleteOne({ _id: asset._id, ownerId });
    throw error;
  }
}

export async function completeMediaUpload(
  ownerId: string,
  courseId: string,
  assetId: string,
) {
  const asset = await Asset.findOne({
    _id: assetId,
    ownerId,
    courseId,
    status: "pending",
  });
  if (!asset) throw new DashboardError("Pending upload not found.", 404);

  let uploaded;
  try {
    const location = mediaLocation(asset);
    uploaded = await storageProvider(location.provider, asset.storageDirectory).metadata(location.key);
  } catch (error) {
    if (error instanceof DashboardError) throw error;
    throw new DashboardError(
      "The uploaded file could not be verified. Please try the upload again.",
      400,
    );
  }

  if (
    uploaded.size !== asset.size ||
    (mediaLocation(asset).provider === "s3" && (uploaded.contentType !== asset.mimeType || uploaded.assetId !== assetId))
  ) {
    await deleteStoredMedia(asset);
    await Asset.deleteOne({ _id: asset._id, ownerId, courseId, status: "pending" });
    throw new DashboardError(
      "The uploaded file did not match its validated details.",
      400,
    );
  }

  try {
    await validateStoredMediaType(asset);
  } catch (error) {
    if (!(error instanceof DashboardError) || error.status !== 400) throw error;
    // Preserve the record on cleanup failure so operators can retry deletion.
    await deleteStoredMedia(asset);
    await Asset.deleteOne({ _id: asset._id, ownerId, courseId, status: "pending" });
    throw error;
  }

  asset.status = "ready";
  await asset.save();
  return {
    id: String(asset._id),
    originalName: asset.originalName,
    contentType: asset.mimeType,
    size: asset.size,
    fileUrl: `/api/assets/${asset._id}/file`,
    createdAt: asset.createdAt,
  };
}
