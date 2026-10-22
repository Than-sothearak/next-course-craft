"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import type {
  DashboardFilters,
  DashboardNavigation,
} from "@/lib/dashboard/types";
import { dashboardHref } from "@/lib/dashboard/query";

type WorkspaceDialogMode = "create" | "manage" | null;

type DashboardContextValue = {
  filters: DashboardFilters;
  setFilters: Dispatch<SetStateAction<DashboardFilters>>;
  navigation: DashboardNavigation | null;
  setNavigation: Dispatch<SetStateAction<DashboardNavigation | null>>;
  navigating: boolean;
  setLinkPending: (id: string, pending: boolean) => void;
  navigateToFolder: (folderId: string | null) => void;
  navigateToWorkspace: (workspaceId: string | null) => void;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  showNewFolder: boolean;
  setShowNewFolder: Dispatch<SetStateAction<boolean>>;
  showNewCourse: boolean;
  setShowNewCourse: Dispatch<SetStateAction<boolean>>;
  workspaceDialogMode: WorkspaceDialogMode;
  setWorkspaceDialogMode: Dispatch<SetStateAction<WorkspaceDialogMode>>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  initialFilters,
  children,
}: {
  initialFilters: DashboardFilters;
  children: ReactNode;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [navigation, setNavigation] = useState<DashboardNavigation | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [workspaceDialogMode, setWorkspaceDialogMode] =
    useState<WorkspaceDialogMode>(null);
  const [navigating, startTransition] = useTransition();
  const [pendingLinks, setPendingLinks] = useState<Set<string>>(() => new Set());
  const setLinkPending = useCallback((id: string, pending: boolean) => {
    setPendingLinks((previous) => {
      if (previous.has(id) === pending) return previous;
      const next = new Set(previous);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  function navigateToFolder(folderId: string | null) {
    if (folderId === filters.folderId) return;
    startTransition(() => router.push(dashboardHref({ ...filters, folderId })));
  }

  function navigateToWorkspace(workspaceId: string | null) {
    if (workspaceId === filters.workspaceId) return;
    startTransition(() =>
      router.push(dashboardHref({ ...filters, workspaceId, folderId: null })),
    );
  }

  return (
    <DashboardContext.Provider
      value={{
        filters,
        setFilters,
        navigation,
        setNavigation,
        navigating: navigating || pendingLinks.size > 0,
        setLinkPending,
        navigateToFolder,
        navigateToWorkspace,
        busy,
        setBusy,
        showNewFolder,
        setShowNewFolder,
        showNewCourse,
        setShowNewCourse,
        workspaceDialogMode,
        setWorkspaceDialogMode,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context)
    throw new Error("Dashboard components require DashboardProvider.");
  return context;
}
