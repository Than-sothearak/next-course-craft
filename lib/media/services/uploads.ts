import { Types } from "mongoose";
import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { mediaUploadInputSchema, type MediaUploadInput } from "../schemas";
import {
  createMediaUploadPost,
  deleteMediaObject,
  inspectMediaObject,
} from "../storage";

export async function beginMediaUpload(
  ownerId: string,
  courseId: string,
  input: MediaUploadInput,
) {
  const parsed = mediaUploadInputSchema.parse(input);
  const assetId = new Types.ObjectId();
  const objectKey = `${ownerId}/${courseId}/${assetId.toString()}`;
  const safeName = parsed.fileName.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const asset = await Asset.create({
    _id: assetId,
    ownerId,
    courseId,
    objectKey,
    originalName: safeName,
    mimeType: parsed.contentType,
    size: parsed.size,
    status: "pending",
  });

  try {
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
    uploaded = await inspectMediaObject(asset.objectKey);
  } catch (error) {
    if (error instanceof DashboardError) throw error;
    throw new DashboardError(
      "The uploaded file could not be verified. Please try the upload again.",
      400,
    );
  }

  const metadataAssetId = uploaded.Metadata?.["asset-id"];
  if (
    uploaded.ContentLength !== asset.size ||
    uploaded.ContentType !== asset.mimeType ||
    metadataAssetId !== assetId
  ) {
    try {
      await deleteMediaObject(asset.objectKey);
    } finally {
      await Asset.deleteOne({ _id: asset._id, ownerId });
    }
    throw new DashboardError(
      "The uploaded file did not match its validated details.",
      400,
    );
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
