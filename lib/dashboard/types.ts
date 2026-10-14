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
  currentFolder: DashboardFolderBase | null;
  breadcrumbs: Array<{ id: string | null; name: string }>;
  folders: DashboardFolder[];
  courses: DashboardCourse[];
  folderOptions: FolderOption[];
  folderTree: FolderTreeNode[];
};

export type DashboardQuery = {
  folderId?: string | null;
  q?: string;
  status?: "all" | "draft" | "published" | "archived";
  sort?: "updated" | "title" | "created";
};
