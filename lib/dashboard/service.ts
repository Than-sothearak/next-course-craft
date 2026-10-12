import { Types } from "mongoose";
import { Course, Folder, Lesson } from "@/models";
import type { CreateCourseInput, CreateFolderInput, UpdateCourseInput, UpdateFolderInput } from "./schemas";
import { DashboardError, assertNoFolderCycle, escapeRegex, normalizeFolderName } from "./rules";

function ownerObjectId(ownerId: string) {
  if (!Types.ObjectId.isValid(ownerId)) throw new DashboardError("Your account session is invalid. Sign in again.", 401);
  return new Types.ObjectId(ownerId);
}

function objectId(value: string | null | undefined) {
  return value ? new Types.ObjectId(value) : null;
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function duplicateFolderName() {
  return new DashboardError("A folder with that name already exists here.", 409);
}

function folderResponse(folder: { _id: Types.ObjectId; name: string; parentId?: Types.ObjectId | null; createdAt: Date; updatedAt: Date }) {
  return { id: folder._id.toString(), name: folder.name, parentId: folder.parentId?.toString() ?? null, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString() };
}

export type DashboardFolder = ReturnType<typeof folderResponse> & { courseCount: number; subfolderCount: number };
export type DashboardCourse = {
  id: string;
  title: string;
  description: string;
  coverImage: string | null;
  folderId: string | null;
  status: "draft" | "published" | "archived";
  revision: number;
  updatedAt: string;
  lessonCount: number;
};
export type FolderOption = { id: string; label: string; depth: number };
export type FolderTreeNode = {
  id: string;
  name: string;
  courseCount: number;
  children: FolderTreeNode[];
};
export type DashboardData = {
  currentFolder: ReturnType<typeof folderResponse> | null;
  breadcrumbs: Array<{ id: string | null; name: string }>;
  folders: DashboardFolder[];
  courses: DashboardCourse[];
  folderOptions: FolderOption[];
  folderTree: FolderTreeNode[];
};

export type DashboardQuery = { folderId?: string | null; q?: string; status?: "all" | "draft" | "published" | "archived"; sort?: "updated" | "title" | "created" };

export async function getDashboardData(ownerId: string, query: DashboardQuery = {}): Promise<DashboardData> {
  const owner = ownerObjectId(ownerId);
  const folderId = query.folderId ?? null;
  let currentFolder: DashboardData["currentFolder"] = null;
  const breadcrumbs: DashboardData["breadcrumbs"] = [{ id: null, name: "All courses" }];

  if (folderId) {
    let currentId: Types.ObjectId | null = objectId(folderId);
    const seen = new Set<string>();
    const parents: Array<{ id: string; name: string }> = [];
    while (currentId) {
      const id = currentId.toString();
      if (seen.has(id) || seen.size >= 100) throw new DashboardError("This folder path is invalid.", 409);
      seen.add(id);
      const folder = await Folder.findOne({ _id: currentId, ownerId }).lean();
      if (!folder) throw new DashboardError("Folder not found.", 404);
      parents.push({ id, name: folder.name });
      if (id === folderId) currentFolder = folderResponse(folder);
      currentId = folder.parentId ?? null;
    }
    breadcrumbs.push(...parents.reverse());
  }

  const directFolder = objectId(folderId);
  const folderFilter: Record<string, unknown> = { ownerId, parentId: directFolder };
  if (query.q?.trim()) folderFilter.name = new RegExp(escapeRegex(query.q.trim().slice(0, 100)), "i");
  const folderSort: Record<string, 1 | -1> = query.sort === "updated" ? { updatedAt: -1 } : query.sort === "created" ? { createdAt: -1 } : { name: 1 };
  const folders = await Folder.find(folderFilter).sort(folderSort).lean();
  const courseCounts = await Course.aggregate<{ _id: Types.ObjectId | null; count: number }>([
    { $match: { ownerId: owner, deletedAt: null, folderId: { $in: folders.map((folder) => folder._id) } } },
    { $group: { _id: "$folderId", count: { $sum: 1 } } },
  ]);
  const subfolderCounts = await Folder.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ownerId: owner, parentId: { $in: folders.map((folder) => folder._id) } } },
    { $group: { _id: "$parentId", count: { $sum: 1 } } },
  ]);
  const courseCountMap = new Map(courseCounts.map((item) => [item._id?.toString() ?? "", item.count]));
  const subfolderCountMap = new Map(subfolderCounts.map((item) => [item._id.toString(), item.count]));
  const dashboardFolders: DashboardFolder[] = folders.map((folder) => ({
    ...folderResponse(folder),
    courseCount: courseCountMap.get(folder._id.toString()) ?? 0,
    subfolderCount: subfolderCountMap.get(folder._id.toString()) ?? 0,
  }));

  const courseFilter: Record<string, unknown> = { ownerId, folderId: directFolder, deletedAt: null };
  if (query.status && query.status !== "all") courseFilter.status = query.status;
  if (query.q?.trim()) {
    const pattern = new RegExp(escapeRegex(query.q.trim().slice(0, 100)), "i");
    courseFilter.$or = [{ title: pattern }, { description: pattern }];
  }
  const sort: Record<string, 1 | -1> = query.sort === "title" ? { title: 1 } : query.sort === "created" ? { createdAt: -1 } : { updatedAt: -1 };
  const courses = await Course.find(courseFilter).sort(sort).limit(200).select("title description coverImage folderId status revision updatedAt").lean();
  const ids = courses.map((course) => course._id);
  const lessonCounts = await Lesson.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { courseId: { $in: ids } } },
    { $group: { _id: "$courseId", count: { $sum: 1 } } },
  ]);
  const lessonCountMap = new Map(lessonCounts.map((item) => [item._id.toString(), item.count]));
  const dashboardCourses: DashboardCourse[] = courses.map((course) => ({
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    coverImage: course.coverImage ?? null,
    folderId: course.folderId?.toString() ?? null,
    status: course.status,
    revision: course.revision,
    updatedAt: course.updatedAt.toISOString(),
    lessonCount: lessonCountMap.get(course._id.toString()) ?? 0,
  }));

  const allFolders = await Folder.find({ ownerId }).sort({ name: 1 }).select("_id name parentId").lean();
  const folderMap = new Map(allFolders.map((folder) => [folder._id.toString(), folder]));
  const folderOptions: FolderOption[] = [];
  const allCourseCounts = await Course.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ownerId: owner, deletedAt: null, folderId: { $ne: null } } },
    { $group: { _id: "$folderId", count: { $sum: 1 } } },
  ]);
  const allCourseCountMap = new Map(allCourseCounts.map((item) => [item._id.toString(), item.count]));
  const childrenByParent = new Map<string, typeof allFolders>();
  for (const folder of allFolders) {
    const parentId = folder.parentId?.toString() ?? null;
    const key = parentId && folderMap.has(parentId) ? parentId : "root";
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), folder]);
  }

  const folderTree: FolderTreeNode[] = [];
  const visited = new Set<string>();
  const appendChildren = (parentKey: string, depth: number, path: Set<string>): FolderTreeNode[] => {
    if (depth > 100) return [];
    const children: FolderTreeNode[] = [];
    for (const folder of childrenByParent.get(parentKey) ?? []) {
      const id = folder._id.toString();
      if (visited.has(id) || path.has(id)) continue;
      visited.add(id);
      const nextPath = new Set(path).add(id);
      const node: FolderTreeNode = { id, name: folder.name, courseCount: allCourseCountMap.get(id) ?? 0, children: [] };
      const label = [...Array.from(nextPath, (pathId) => folderMap.get(pathId)?.name).filter((name): name is string => Boolean(name))].join(" / ");
      folderOptions.push({ id, label, depth });
      node.children = appendChildren(id, depth + 1, nextPath);
      children.push(node);
    }
    return children;
  };
  folderTree.push(...appendChildren("root", 0, new Set()));
  // Surface any corrupt cycle/orphan data as a root item without serializing a cyclic tree.
  for (const folder of allFolders) {
    if (visited.has(folder._id.toString())) continue;
    const id = folder._id.toString();
    visited.add(id);
    const node: FolderTreeNode = { id, name: folder.name, courseCount: allCourseCountMap.get(id) ?? 0, children: [] };
    node.children = appendChildren(id, 1, new Set([id]));
    folderTree.push(node);
    folderOptions.push({ id, label: folder.name, depth: 0 });
  }

  return { currentFolder, breadcrumbs, folders: dashboardFolders, courses: dashboardCourses, folderOptions, folderTree };
}

async function assertFolderOwned(ownerId: string, folderId: string | null) {
  if (folderId && !(await Folder.exists({ _id: folderId, ownerId }))) throw new DashboardError("Destination folder not found.", 404);
}

async function assertUniqueFolderName(ownerId: string, parentId: string | null, name: string, excludeId?: string) {
  const filter: Record<string, unknown> = { ownerId, parentId: objectId(parentId), normalizedName: normalizeFolderName(name) };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Folder.exists(filter)) throw duplicateFolderName();
}

export async function createFolder(ownerId: string, input: CreateFolderInput) {
  ownerObjectId(ownerId);
  await assertFolderOwned(ownerId, input.parentId);
  await assertUniqueFolderName(ownerId, input.parentId, input.name);
  try {
    const folder = await Folder.create({ name: input.name, normalizedName: normalizeFolderName(input.name), ownerId, parentId: objectId(input.parentId) });
    return folderResponse(folder);
  } catch (error) {
    if (isDuplicateKey(error)) throw duplicateFolderName();
    throw error;
  }
}

export async function updateFolder(ownerId: string, folderId: string, input: UpdateFolderInput) {
  ownerObjectId(ownerId);
  const folder = await Folder.findOne({ _id: folderId, ownerId });
  if (!folder) throw new DashboardError("Folder not found.", 404);
  const nextParentId = input.parentId === undefined ? folder.parentId?.toString() ?? null : input.parentId;
  const nextName = input.name ?? folder.name;
  await assertFolderOwned(ownerId, nextParentId);

  if (input.parentId !== undefined && nextParentId) {
    let parentId: string | null = nextParentId;
    const ancestors: string[] = [];
    const seen = new Set<string>();
    while (parentId) {
      if (seen.has(parentId)) throw new DashboardError("This folder path is invalid.", 409);
      seen.add(parentId);
      ancestors.push(parentId);
      const parent: { parentId?: Types.ObjectId | null } | null = await Folder.findOne({ _id: parentId, ownerId }).select("parentId").lean();
      parentId = parent?.parentId?.toString() ?? null;
    }
    assertNoFolderCycle(folder._id.toString(), ancestors);
  }

  const parentChanged = (folder.parentId?.toString() ?? null) !== nextParentId;
  const nameChanged = normalizeFolderName(folder.name) !== normalizeFolderName(nextName);
  if (parentChanged || nameChanged) await assertUniqueFolderName(ownerId, nextParentId, nextName, folderId);
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
  ownerObjectId(ownerId);
  const folder = await Folder.findOne({ _id: folderId, ownerId }).select("_id").lean();
  if (!folder) throw new DashboardError("Folder not found.", 404);
  const [hasChildren, hasCourses] = await Promise.all([
    Folder.exists({ ownerId, parentId: folder._id }),
    Course.exists({ ownerId, folderId: folder._id, deletedAt: null }),
  ]);
  if (hasChildren || hasCourses) throw new DashboardError("Move the subfolders and courses out before deleting this folder.", 409);
  await Folder.deleteOne({ _id: folder._id, ownerId });
}

export async function createCourse(ownerId: string, input: CreateCourseInput) {
  const owner = ownerObjectId(ownerId);
  await assertFolderOwned(ownerId, input.folderId);
  const course = await Course.create({ ownerId: owner, folderId: objectId(input.folderId), title: input.title, description: input.description, coverImage: input.coverImage ?? null, status: "draft", sections: [{ id: new Types.ObjectId().toString(), title: "Getting started", order: 0 }] });
  return { id: course._id.toString(), title: course.title, folderId: course.folderId?.toString() ?? null, status: course.status };
}

export async function updateCourse(ownerId: string, courseId: string, input: UpdateCourseInput) {
  ownerObjectId(ownerId);
  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: null, editorSaveLock: null });
  if (!course) {
    if (await Course.exists({ _id: courseId, ownerId, deletedAt: null })) throw new DashboardError("This course is being saved. Try again in a moment.", 409);
    throw new DashboardError("Course not found.", 404);
  }
  if (input.folderId !== undefined) await assertFolderOwned(ownerId, input.folderId);
  if (input.title !== undefined) course.title = input.title;
  if (input.description !== undefined) course.description = input.description;
  if (input.coverImage !== undefined) course.coverImage = input.coverImage;
  if (input.folderId !== undefined) course.folderId = objectId(input.folderId);
  if (input.status !== undefined) course.status = input.status;
  course.revision += 1;
  await course.save();
  return { id: course._id.toString(), title: course.title, folderId: course.folderId?.toString() ?? null, status: course.status, revision: course.revision };
}

export async function duplicateCourse(ownerId: string, courseId: string) {
  const owner = ownerObjectId(ownerId);
  const source = await Course.findOne({ _id: courseId, ownerId, deletedAt: null }).lean();
  if (!source) throw new DashboardError("Course not found.", 404);
  const copy = await Course.create({
    ownerId: owner,
    folderId: source.folderId,
    title: `${source.title} (copy)`.slice(0, 160),
    description: source.description,
    coverImage: source.coverImage,
    language: source.language,
    theme: structuredClone(source.theme),
    status: "draft",
    revision: 0,
    completionSettings: structuredClone(source.completionSettings),
  });
  return { id: copy._id.toString(), title: copy.title, folderId: copy.folderId?.toString() ?? null, status: copy.status };
}

export async function softDeleteCourse(ownerId: string, courseId: string, confirmTitle: string) {
  ownerObjectId(ownerId);
  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: null, editorSaveLock: null });
  if (!course) {
    if (await Course.exists({ _id: courseId, ownerId, deletedAt: null })) throw new DashboardError("This course is being saved. Try again in a moment.", 409);
    throw new DashboardError("Course not found.", 404);
  }
  if (course.title !== confirmTitle) throw new DashboardError("The title did not match. The course was not deleted.", 400);
  course.deletedAt = new Date();
  await course.save();
}

export async function restoreCourse(ownerId: string, courseId: string) {
  ownerObjectId(ownerId);
  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: { $ne: null } });
  if (!course) throw new DashboardError("Recently deleted course not found.", 404);
  course.deletedAt = null;
  await course.save();
  return { id: course._id.toString(), title: course.title };
}

