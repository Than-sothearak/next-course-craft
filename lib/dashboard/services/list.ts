import { Types } from "mongoose";
import { Course, CourseAssignment, Folder, Lesson } from "@/models";
import { DashboardError, escapeRegex } from "../rules";
import type {
  DashboardCourse,
  DashboardData,
  DashboardFolder,
  DashboardQuery,
  DashboardListing,
  DashboardNavigation,
  FolderOption,
  FolderTreeNode,
} from "../types";
import { folderResponse, objectId, ownerObjectId } from "./internal";
import { courseScopeCan, resolveDashboardAccess, roleCan, type WorkspaceRole } from "@/lib/workspaces/access";
import { requirePermission } from "@/lib/auth/authorization";
import { listWorkspaces } from "@/lib/workspaces/services";

export async function getDashboardListing(
  userId: string,
  query: DashboardQuery = {},
): Promise<DashboardListing> {
  const principal = await requirePermission("courses.view", userId);
  const assignments = await CourseAssignment.find({ userId }).select("courseId role").lean();
  const assignedRoles = new Map(assignments.map((assignment) => [assignment.courseId.toString(), assignment.role]));
  const scope = await resolveDashboardAccess(userId, query.workspaceId ?? null);
  const ownerId = scope.ownerId;
  const owner = ownerObjectId(ownerId);
  const workspaceId = objectId(scope.workspaceId);
  const folderId = query.folderId ?? null;
  let currentFolder: DashboardData["currentFolder"] = null;
  const breadcrumbs: DashboardData["breadcrumbs"] = [
    { id: null, name: "All courses" },
  ];

  if (folderId) {
    let currentId: Types.ObjectId | null = objectId(folderId);
    const seen = new Set<string>();
    const parents: Array<{ id: string; name: string }> = [];
    while (currentId) {
      const id = currentId.toString();
      if (seen.has(id) || seen.size >= 100)
        throw new DashboardError("This folder path is invalid.", 409);
      seen.add(id);
      const folder = await Folder.findOne({ _id: currentId, ownerId, workspaceId }).lean();
      if (!folder) throw new DashboardError("Folder not found.", 404);
      parents.push({ id, name: folder.name });
      if (id === folderId) currentFolder = folderResponse(folder);
      currentId = folder.parentId ?? null;
    }
    breadcrumbs.push(...parents.reverse());
  }

  const directFolder = objectId(folderId);
  const folderFilter: Record<string, unknown> = {
    ownerId,
    workspaceId,
    parentId: directFolder,
  };
  if (query.q?.trim())
    folderFilter.name = new RegExp(
      escapeRegex(query.q.trim().slice(0, 100)),
      "i",
    );
  const folderSort: Record<string, 1 | -1> =
    query.sort === "updated"
      ? { updatedAt: -1 }
      : query.sort === "created"
        ? { createdAt: -1 }
        : { name: 1 };
  const folders = await Folder.find(folderFilter).sort(folderSort).lean();
  const courseCounts = await Course.aggregate<{
    _id: Types.ObjectId | null;
    count: number;
  }>([
    {
      $match: {
        ownerId: owner,
        workspaceId,
        deletedAt: null,
        folderId: { $in: folders.map((folder) => folder._id) },
      },
    },
    { $group: { _id: "$folderId", count: { $sum: 1 } } },
  ]);
  const subfolderCounts = await Folder.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        ownerId: owner,
        workspaceId,
        parentId: { $in: folders.map((folder) => folder._id) },
      },
    },
    { $group: { _id: "$parentId", count: { $sum: 1 } } },
  ]);
  const courseCountMap = new Map(
    courseCounts.map((item) => [item._id?.toString() ?? "", item.count]),
  );
  const subfolderCountMap = new Map(
    subfolderCounts.map((item) => [item._id.toString(), item.count]),
  );
  const dashboardFolders: DashboardFolder[] = folders.map((folder) => ({
    ...folderResponse(folder),
    courseCount: courseCountMap.get(folder._id.toString()) ?? 0,
    subfolderCount: subfolderCountMap.get(folder._id.toString()) ?? 0,
  }));

  const courseFilter: Record<string, unknown> = {
    ownerId,
    workspaceId,
    folderId: directFolder,
    deletedAt: null,
  };
  if (!workspaceId && !folderId && assignments.length) {
    delete courseFilter.ownerId;
    delete courseFilter.workspaceId;
    delete courseFilter.folderId;
    courseFilter.$and = [{ $or: [{ ownerId: owner, workspaceId: null, folderId: null }, { _id: { $in: assignments.map((assignment) => assignment.courseId) } }] }];
  }
  if (query.status && query.status !== "all")
    courseFilter.status = query.status;
  if (query.q?.trim()) {
    const pattern = new RegExp(escapeRegex(query.q.trim().slice(0, 100)), "i");
    courseFilter.$or = [{ title: pattern }, { description: pattern }];
  }
  const sort: Record<string, 1 | -1> =
    query.sort === "title"
      ? { title: 1 }
      : query.sort === "created"
        ? { createdAt: -1 }
        : { updatedAt: -1 };
  const courses = await Course.find(courseFilter)
    .sort(sort)
    .limit(200)
    .select("title description coverImage folderId status revision updatedAt ownerId workspaceId")
    .lean();
  const ids = courses.map((course) => course._id);
  const lessonCounts = await Lesson.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    { $match: { courseId: { $in: ids } } },
    { $group: { _id: "$courseId", count: { $sum: 1 } } },
  ]);
  const lessonCountMap = new Map(
    lessonCounts.map((item) => [item._id.toString(), item.count]),
  );
  const dashboardCourses: DashboardCourse[] = courses.map((course) => {
    const assignmentRole = assignedRoles.get(course._id.toString()) as WorkspaceRole | undefined;
    const rawRole: WorkspaceRole = course.ownerId.toString() === userId ? "owner" : course.workspaceId?.toString() === scope.workspaceId && roleCan(scope.role, "edit") ? scope.role : assignmentRole ?? scope.role;
    const permissions = principal.permissions.filter((permission) => courseScopeCan(rawRole, permission));
    return ({
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    coverImage: course.coverImage ?? null,
    folderId: course.folderId?.toString() ?? null,
    status: course.status,
    revision: course.revision,
    updatedAt: course.updatedAt.toISOString(),
    lessonCount: lessonCountMap.get(course._id.toString()) ?? 0,
    accessRole: permissions.includes("courses.edit") ? rawRole : "viewer",
    permissions,
  }); });

  return {
    currentFolder,
    breadcrumbs,
    folders: dashboardFolders,
    courses: dashboardCourses,
  };
}

export async function getDashboardNavigation(userId: string, workspaceId: string | null = null): Promise<DashboardNavigation> {
  const principal = await requirePermission("courses.view", userId);
  const [scope, workspaces] = await Promise.all([
    resolveDashboardAccess(userId, workspaceId),
    listWorkspaces(userId),
  ]);
  const owner = ownerObjectId(scope.ownerId);
  const folderScope = { ownerId: owner, workspaceId: objectId(scope.workspaceId) };
  const allFolders = await Folder.find(folderScope)
    .sort({ name: 1 })
    .select("_id name parentId")
    .lean();
  const folderMap = new Map(
    allFolders.map((folder) => [folder._id.toString(), folder]),
  );
  const folderOptions: FolderOption[] = [];
  const allCourseCounts = await Course.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    { $match: { ...folderScope, deletedAt: null, folderId: { $ne: null } } },
    { $group: { _id: "$folderId", count: { $sum: 1 } } },
  ]);
  const allCourseCountMap = new Map(
    allCourseCounts.map((item) => [item._id.toString(), item.count]),
  );
  const childrenByParent = new Map<string, typeof allFolders>();
  for (const folder of allFolders) {
    const parentId = folder.parentId?.toString() ?? null;
    const key = parentId && folderMap.has(parentId) ? parentId : "root";
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), folder]);
  }

  const folderTree: FolderTreeNode[] = [];
  const visited = new Set<string>();
  const appendChildren = (
    parentKey: string,
    depth: number,
    path: Set<string>,
  ): FolderTreeNode[] => {
    if (depth > 100) return [];
    const children: FolderTreeNode[] = [];
    for (const folder of childrenByParent.get(parentKey) ?? []) {
      const id = folder._id.toString();
      if (visited.has(id) || path.has(id)) continue;
      visited.add(id);
      const nextPath = new Set(path).add(id);
      const node: FolderTreeNode = {
        id,
        name: folder.name,
        courseCount: allCourseCountMap.get(id) ?? 0,
        children: [],
      };
      const label = [
        ...Array.from(nextPath, (pathId) => folderMap.get(pathId)?.name).filter(
          (name): name is string => Boolean(name),
        ),
      ].join(" / ");
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
    const node: FolderTreeNode = {
      id,
      name: folder.name,
      courseCount: allCourseCountMap.get(id) ?? 0,
      children: [],
    };
    node.children = appendChildren(id, 1, new Set([id]));
    folderTree.push(node);
    folderOptions.push({ id, label: folder.name, depth: 0 });
  }

  return {
    folderOptions,
    folderTree,
    workspaces,
    workspaceId: scope.workspaceId,
    workspaceName: scope.workspaceName,
    workspaceRole: scope.role,
    permissions: principal.permissions,
  };
}

export async function getDashboardData(userId: string, query: DashboardQuery = {}): Promise<DashboardData> {
  const [listing, navigation] = await Promise.all([
    getDashboardListing(userId, query),
    getDashboardNavigation(userId, query.workspaceId ?? null),
  ]);
  return { ...listing, ...navigation };
}
