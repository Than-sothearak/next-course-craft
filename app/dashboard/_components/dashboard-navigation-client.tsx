"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { DashboardNavigation, FolderTreeNode } from "@/lib/dashboard/types";
import { DashboardSidebar } from "./(dashboard_client_components)/dashboard-sidebar";
import { useDashboard } from "./dashboard-provider";

function expandedFolderIds(nodes: FolderTreeNode[]): Set<string> {
  return new Set(nodes.flatMap((node) => [
    ...(node.children.length ? [node.id] : []),
    ...expandedFolderIds(node.children),
  ]));
}

export function DashboardNavigationClient({ initialNavigation, initialError }: { initialNavigation: DashboardNavigation; initialError: string | null }) {
  const { navigation, filters, navigating, busy, navigateToWorkspace, setShowNewFolder, setShowNewCourse, setGenerateCourseAfterCreate, setWorkspaceDialogMode } = useDashboard();
  const data = navigation ?? initialNavigation;
  const [expandedFolders, setExpandedFolders] = useState(() => expandedFolderIds(data.folderTree));
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    const desktop = window.matchMedia?.("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop?.matches) setMobileOpen(false); };
    desktop?.addEventListener("change", closeOnDesktop);
    return () => desktop?.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen && restoreFocus.current) {
      restoreFocus.current = false;
      mobileTriggerRef.current?.focus({ preventScroll: true });
    }
  }, [mobileOpen]);

  const sidebarProps = {
    data,
    error: initialError,
    filters,
    expandedFolders,
    disabled: Boolean(initialError) || busy || navigating,
    onToggleFolder: (id: string) => setExpandedFolders((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }),
    onNewFolder: () => { setMobileOpen(false); setShowNewFolder(true); },
    onNewCourse: () => {
      setMobileOpen(false);
      setGenerateCourseAfterCreate(false);
      setShowNewCourse(true);
    },
    onGenerateCourse: () => {
      setMobileOpen(false);
      setGenerateCourseAfterCreate(true);
      setShowNewCourse(true);
    },
    onWorkspaceChange: (workspaceId: string | null) => { setMobileOpen(false); navigateToWorkspace(workspaceId); },
    onCreateWorkspace: () => { setMobileOpen(false); setWorkspaceDialogMode("create"); },
    onManageWorkspace: () => { setMobileOpen(false); setWorkspaceDialogMode("manage"); },
  };

  return <>
    <div className="flex min-w-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-8 lg:hidden">
      <Button ref={mobileTriggerRef} variant="outline" size="sm" className="min-h-11" aria-label="Open folders and workspaces" aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
        <Menu size={16} aria-hidden="true" />Folders
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-500" title={data.workspaceName}>{data.workspaceName}</span>
    </div>
    <DashboardSidebar {...sidebarProps} />
    {mobileOpen && <Dialog open title="Folders & workspaces" onClose={() => { restoreFocus.current = true; setMobileOpen(false); }} className="max-w-sm">
      <DashboardSidebar {...sidebarProps} mobile onNavigate={() => setMobileOpen(false)} />
    </Dialog>}
  </>;
}
