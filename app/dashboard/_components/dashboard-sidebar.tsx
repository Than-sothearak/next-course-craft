"use client";
import { BookOpen, FolderPlus, Sparkles } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";
import { FolderTreeNavigation } from "./folder-tree-navigation";

type SidebarProps = {
  data: DashboardData;
  currentFolderId: string | null;
  expandedFolders: Set<string>;
  disabled: boolean;
  onToggleFolder: (id: string) => void;
  onOpenFolder: (id: string | null) => void;
  onNewFolder: () => void;
  onNewCourse: () => void;
};

export function DashboardSidebar({ data, currentFolderId, expandedFolders, disabled, onToggleFolder, onOpenFolder, onNewFolder, onNewCourse }: SidebarProps) {
  return <aside className="hidden border-r border-slate-200 bg-white lg:block" aria-label="Workspace navigation">
    <div className="sticky top-16 flex min-h-[calc(100vh-4rem)] flex-col px-3 py-7 xl:px-5">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
      <Button variant={currentFolderId === null ? "secondary" : "ghost"} onClick={() => onOpenFolder(null)} className="mt-3 w-full justify-start rounded-lg px-3 text-left"><BookOpen size={17} aria-hidden="true" /> All courses</Button>
      <div className="mt-7 flex items-center justify-between px-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Folders</p>
        <Button variant="ghost" size="icon" disabled={disabled} onClick={onNewFolder} aria-label="Create folder"><FolderPlus size={16} /></Button>
      </div>
      <div className="mt-2 space-y-1">
        {data.folderTree.length > 0 ? <FolderTreeNavigation nodes={data.folderTree} currentFolderId={currentFolderId} expanded={expandedFolders} onToggle={onToggleFolder} onOpen={onOpenFolder} /> : <p className="px-3 py-2 text-sm text-slate-400">Create a folder to organize your courses.</p>}
      </div>
      <div className="mt-auto rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
        <Sparkles size={18} className="text-indigo-600" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">Start with a course</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Keep each learning project organized in one place.</p>
        <button disabled={disabled} onClick={onNewCourse} className="mt-3 text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-40">Create a course <span aria-hidden="true">â†’</span></button>
      </div>
    </div>
  </aside>;
}
