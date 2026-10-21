"use client";
import { BookOpen, FolderPlus, Sparkles, Users, Plus } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FolderTreeNavigation } from "./(dashboard_sidebar_components)/folder-tree-navigation";

type SidebarProps = {
  data: Pick<
    DashboardData,
    | "folderTree"
    | "workspaces"
    | "workspaceId"
    | "workspaceName"
    | "workspaceRole"
    | "permissions"
  >;
  error?: string | null;
  currentFolderId: string | null;
  expandedFolders: Set<string>;
  disabled: boolean;
  onToggleFolder: (id: string) => void;
  onOpenFolder: (id: string | null) => void;
  onNewFolder: () => void;
  onNewCourse: () => void;
  onWorkspaceChange: (workspaceId: string | null) => void;
  onCreateWorkspace: () => void;
  onManageWorkspace: () => void;
};

export function DashboardSidebar({
  data,
  error,
  currentFolderId,
  expandedFolders,
  disabled,
  onToggleFolder,
  onOpenFolder,
  onNewFolder,
  onNewCourse,
  onWorkspaceChange,
  onCreateWorkspace,
  onManageWorkspace,
}: SidebarProps) {
  const canCreate =
    Boolean(data.permissions?.includes("courses.create")) &&
    data.workspaceRole !== "viewer";
  const canManageWorkspace = Boolean(
    data.permissions?.includes("workspaces.manage"),
  );
  return (
    <aside
      className="hidden border-r border-slate-200 bg-white lg:block"
      aria-label="Workspace navigation"
    >
      <div className="sticky top-16 flex min-h-[calc(100vh-4rem)] flex-col px-3 py-7 xl:px-5">
        <div className="flex items-center justify-between px-3">
          <label
            htmlFor="dashboard-workspace"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
          >
            Workspaces
          </label>
          {canManageWorkspace && (
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={onCreateWorkspace}
              aria-label="Create team workspace"
              title="Create team workspace"
            >
              <Plus size={16} />
            </Button>
          )}
        </div>
        <Select
          id="dashboard-workspace"
          value={data.workspaceId ?? ""}
          disabled={disabled}
          onChange={(event) => onWorkspaceChange(event.target.value || null)}
          className="mt-2 h-10 w-full"
        >
          <option value="">Personal</option>
          {data.workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} · {workspace.role}
            </option>
          ))}
        </Select>
        {canManageWorkspace &&
          data.workspaceId &&
          (data.workspaceRole === "owner" ||
            data.workspaceRole === "admin") && (
            <Button
              variant="ghost"
              onClick={onManageWorkspace}
              className="mt-1 w-full justify-start rounded-lg px-3 text-left text-xs text-slate-500"
            >
              <Users size={15} aria-hidden="true" /> Manage team
            </Button>
          )}
        <Button
          variant={currentFolderId === null ? "secondary" : "ghost"}
          onClick={() => onOpenFolder(null)}
          className="mt-3 w-full justify-start rounded-lg px-3 text-left"
        >
          <BookOpen size={17} aria-hidden="true" /> All courses
        </Button>
        <div className="mt-7 flex items-center justify-between px-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Folders
          </p>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled || !canCreate}
            onClick={onNewFolder}
            aria-label="Create folder"
          >
            <FolderPlus size={16} />
          </Button>
        </div>
        <div className="mt-2 space-y-1">
          {error ? (
            <p role="alert" className="px-3 py-2 text-sm text-amber-800">
              Folders are unavailable. Try reloading the page.
            </p>
          ) : data.folderTree.length > 0 ? (
            <FolderTreeNavigation
              nodes={data.folderTree}
              currentFolderId={currentFolderId}
              expanded={expandedFolders}
              onToggle={onToggleFolder}
              onOpen={onOpenFolder}
            />
          ) : (
            <p className="px-3 py-2 text-sm text-slate-400">
              Create a folder to organize your courses.
            </p>
          )}
        </div>
        <div className="mt-auto rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
          <Sparkles size={18} className="text-indigo-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold">
            {canCreate ? "Start with a course" : "Your shared courses"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {canCreate
              ? "Keep each learning project organized in one place."
              : "Open the courses you own or that have been shared with you."}
          </p>
          {canCreate && (
            <Button
              variant="link"
              disabled={disabled || !canCreate}
              onClick={onNewCourse}
              className="mt-3 text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-40"
            >
              Create a course <span aria-hidden="true">→</span>
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
