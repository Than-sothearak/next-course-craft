import { Types } from "mongoose";
import { Course, Folder } from "@/models";
import { resolveDashboardAccess, resolveFolderAccess } from "@/lib/workspaces/access";
import type { CreateFolderInput, UpdateFolderInput } from "../schemas";
import {
  DashboardError,
  assertNoFolderCycle,
  normalizeFolderName,
} from "../rules";
import {
  assertFolderOwned,
  assertUniqueFolderName,
  duplicateFolderName,
  folderResponse,
  isDuplicateKey,
  objectId,
  ownerObjectId,
} from "./internal";

export async function createFolder(userId: string, input: CreateFolderInput) {
  const scope = await resolveDashboardAccess(userId, input.workspaceId, "edit");
  const ownerId = scope.ownerId;
  ownerObjectId(ownerId);
  await assertFolderOwned(ownerId, input.parentId, scope.workspaceId);
  await assertUniqueFolderName(ownerId, input.parentId, input.name, undefined, scope.workspaceId);
  try {
    const folder = await Folder.create({
      name: input.name,
      normalizedName: normalizeFolderName(input.name),
      ownerId,
      workspaceId: scope.workspaceId,
      parentId: objectId(input.parentId),
    });
    return folderResponse(folder);
  } catch (error) {
    if (isDuplicateKey(error)) throw duplicateFolderName();
    throw error;
  }
}

export async function updateFolder(
  userId: string,
  folderId: string,
  input: UpdateFolderInput,
) {
  const access = await resolveFolderAccess(userId, folderId, "edit");
  const { ownerId, workspaceId } = access;
  ownerObjectId(ownerId);
  const folder = await Folder.findOne({ _id: folderId, ownerId, workspaceId });
  if (!folder) throw new DashboardError("Folder not found.", 404);
  const nextParentId =
    input.parentId === undefined
      ? (folder.parentId?.toString() ?? null)
      : input.parentId;
  const nextName = input.name ?? folder.name;
  await assertFolderOwned(ownerId, nextParentId, workspaceId);

  if (input.parentId !== undefined && nextParentId) {
    let parentId: string | null = nextParentId;
    const ancestors: string[] = [];
    const seen = new Set<string>();
    while (parentId) {
      if (seen.has(parentId))
        throw new DashboardError("This folder path is invalid.", 409);
      seen.add(parentId);
      ancestors.push(parentId);
      const parent: { parentId?: Types.ObjectId | null } | null =
        await Folder.findOne({ _id: parentId, ownerId, workspaceId })
          .select("parentId")
          .lean();
      parentId = parent?.parentId?.toString() ?? null;
    }
    assertNoFolderCycle(folder._id.toString(), ancestors);
  }

  const parentChanged = (folder.parentId?.toString() ?? null) !== nextParentId;
  const nameChanged =
    normalizeFolderName(folder.name) !== normalizeFolderName(nextName);
  if (parentChanged || nameChanged)
    await assertUniqueFolderName(ownerId, nextParentId, nextName, folderId, workspaceId);
  folder.name = nextName;
  folder.normalizedName = normalizeFolderName(nextName);
  folder.parentId = objectId(nextParentId);
  try {
    await folder.save();
  } catch (error) {
    if (isDuplicateKey(error)) throw duplicateFolderName();
    throw error;
  }
  return folderResponse(folder);
}

export async function deleteFolder(ownerId: string, folderId: string) {
  const access = await resolveFolderAccess(ownerId, folderId, "edit");
  ownerId = access.ownerId;
  const workspaceId = access.workspaceId;
  ownerObjectId(ownerId);
  const folder = await Folder.findOne({ _id: folderId, ownerId, workspaceId })
    .select("_id")
    .lean();
  if (!folder) throw new DashboardError("Folder not found.", 404);
  const [hasChildren, hasCourses] = await Promise.all([
    Folder.exists({ ownerId, workspaceId, parentId: folder._id }),
    Course.exists({ ownerId, workspaceId, folderId: folder._id, deletedAt: null }),
  ]);
  if (hasChildren || hasCourses)
    throw new DashboardError(
      "Move the subfolders and courses out before deleting this folder.",
      409,
    );
  await Folder.deleteOne({ _id: folder._id, ownerId, workspaceId });
}
