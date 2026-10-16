"use client";

import { createContext, useContext, useState, useTransition, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { DashboardFilters, DashboardNavigation } from "@/lib/dashboard/types";
import { dashboardHref } from "@/lib/dashboard/query";

type DashboardContextValue = {
  filters: DashboardFilters;
  setFilters: Dispatch<SetStateAction<DashboardFilters>>;
  navigation: DashboardNavigation | null;
  setNavigation: Dispatch<SetStateAction<DashboardNavigation | null>>;
  navigating: boolean;
  navigateToFolder: (folderId: string | null) => void;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  showNewFolder: boolean;
  setShowNewFolder: Dispatch<SetStateAction<boolean>>;
  showNewCourse: boolean;
  setShowNewCourse: Dispatch<SetStateAction<boolean>>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ initialFilters, children }: { initialFilters: DashboardFilters; children: ReactNode }) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [navigation, setNavigation] = useState<DashboardNavigation | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [navigating, startTransition] = useTransition();

  function navigateToFolder(folderId: string | null) {
    if (folderId === filters.folderId) return;
    startTransition(() => router.push(dashboardHref({ ...filters, folderId })));
  }

  return <DashboardContext.Provider value={{ filters, setFilters, navigation, setNavigation, navigating, navigateToFolder, busy, setBusy, showNewFolder, setShowNewFolder, showNewCourse, setShowNewCourse }}>
    {children}
  </DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("Dashboard components require DashboardProvider.");
  return context;
}
