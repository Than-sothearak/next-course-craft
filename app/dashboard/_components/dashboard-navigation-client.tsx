"use client";

import { useState } from "react";
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
  const { navigation, filters, navigating, busy, navigateToFolder, navigateToWorkspace, setShowNewFolder, setShowNewCourse, setShowWorkspaceManager } = useDashboard();
  const data = navigation ?? initialNavigation;
  const [expandedFolders, setExpandedFolders] = useState(() => expandedFolderIds(data.folderTree));

  return <DashboardSidebar
    data={data}
    error={initialError}
    currentFolderId={filters.folderId}
    expandedFolders={expandedFolders}
    disabled={Boolean(initialError) || busy || navigating}
    onToggleFolder={(id) => setExpandedFolders((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    })}
    onOpenFolder={navigateToFolder}
    onNewFolder={() => setShowNewFolder(true)}
    onNewCourse={() => setShowNewCourse(true)}
    onWorkspaceChange={navigateToWorkspace}
    onCreateWorkspace={() => setShowWorkspaceManager(true)}
    onManageWorkspace={() => setShowWorkspaceManager(true)}
  />;
}
