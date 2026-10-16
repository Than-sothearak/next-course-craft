import { Types } from "mongoose";
import { Folder } from "@/models";
import { DashboardError, normalizeFolderName } from "../rules";

export function ownerObjectId(ownerId: string) {
  if (!Types.ObjectId.isValid(ownerId)) {
    throw new DashboardError(
      "Your account session is invalid. Sign in again.",
      401,
    );
  }
  return new Types.ObjectId(ownerId);
}

export function objectId(value: string | null | undefined) {
  return value ? new Types.ObjectId(value) : null;
}

export function isDuplicateKey(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export function duplicateFolderName() {
  return new DashboardError(
    "A folder with that name already exists here.",
    409,
  );
}

export function folderResponse(folder: {
  _id: Types.ObjectId;
  name: string;
  parentId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: folder._id.toString(),
    name: folder.name,
    parentId: folder.parentId?.toString() ?? null,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export async function assertFolderOwned(
  ownerId: string,
  folderId: string | null,
  workspaceId: string | null = null,
) {
  if (folderId && !(await Folder.exists({ _id: folderId, ownerId, workspaceId }))) {
    throw new DashboardError("Destination folder not found.", 404);
  }
}

export async function assertUniqueFolderName(
  ownerId: string,
  parentId: string | null,
  name: string,
  excludeId?: string,
  workspaceId: string | null = null,
) {
  const filter: Record<string, unknown> = {
    ownerId,
    parentId: objectId(parentId),
    normalizedName: normalizeFolderName(name),
    workspaceId,
  };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Folder.exists(filter)) throw duplicateFolderName();
}
