import type { Permission } from "@/lib/auth/policy";
import type { CourseLayout } from "@/lib/editor/course-layout";

export type DashboardFolderBase = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardFolder = DashboardFolderBase & {
  courseCount: number;
  subfolderCount: number;
};

export type DashboardCourse = {
  id: string;
  title: string;
  description: string;
  coverImage: string | null;
  courseLayout: CourseLayout;
  folderId: string | null;
  status: "draft" | "published" | "archived";
  revision: number;
  updatedAt: string;
  lessonCount: number;
  accessRole: "owner" | "admin" | "editor" | "viewer";
  permissions?: Permission[];
};

export type DashboardWorkspace = {
  id: string;
  name: string;
  role: "owner" | "admin" | "editor" | "viewer";
  memberCount: number;
};

export type FolderOption = { id: string; label: string; depth: number };

export type FolderTreeNode = {
  id: string;
  name: string;
  courseCount: number;
  children: FolderTreeNode[];
};

export type DashboardData = {
  currentFolder: DashboardFolderBase | null;
  breadcrumbs: Array<{ id: string | null; name: string }>;
  folders: DashboardFolder[];
  courses: DashboardCourse[];
  folderOptions: FolderOption[];
  folderTree: FolderTreeNode[];
  workspaces: DashboardWorkspace[];
  workspaceId: string | null;
  workspaceName: string;
  workspaceRole: DashboardWorkspace["role"];
  permissions?: Permission[];
};

export type DashboardQuery = {
  workspaceId?: string | null;
  folderId?: string | null;
  q?: string;
  status?: "all" | "draft" | "published" | "archived";
  sort?: "updated" | "title" | "created";
};

export type DashboardNavigation = Pick<DashboardData, "folderOptions" | "folderTree" | "workspaces" | "workspaceId" | "workspaceName" | "workspaceRole" | "permissions">;
export type DashboardListing = Omit<DashboardData, keyof DashboardNavigation>;
export type DashboardFilters = Required<DashboardQuery>;
