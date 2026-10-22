"use client";

import { createContext, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { invalidateAdminNavigation } from "@/app/admin/actions";

export type AdminResourceSeed = { url: string; data: unknown };
export const AdminResourceContext = createContext<{
  initialResource: AdminResourceSeed;
  refresh: () => void;
} | null>(null);

export function AdminResourceProvider({ initialResource, children }: {
  initialResource: AdminResourceSeed;
  children: ReactNode;
}) {
  const router = useRouter();
  const pendingRefresh = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    pendingRefresh.current ??= invalidateAdminNavigation()
      .catch(() => router.refresh())
      .finally(() => { pendingRefresh.current = null; });
  }, [router]);
  const value = useMemo(() => ({ initialResource, refresh }), [initialResource, refresh]);
  return <AdminResourceContext.Provider value={value}>{children}</AdminResourceContext.Provider>;
}
