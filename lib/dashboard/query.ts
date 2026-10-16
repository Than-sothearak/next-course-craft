import type { DashboardFilters } from "./types";

export type DashboardSearchParams = {
  workspaceId?: string;
  folderId?: string;
  q?: string;
  status?: string;
  sort?: string;
};

export function dashboardFilters(params: DashboardSearchParams): DashboardFilters {
  return {
    workspaceId: params.workspaceId || null,
    folderId: params.folderId || null,
    q: params.q ?? "",
    status: params.status === "draft" || params.status === "published" || params.status === "archived" ? params.status : "all",
    sort: params.sort === "title" || params.sort === "created" ? params.sort : "updated",
  };
}

export function dashboardQueryKey(filters: DashboardFilters): string {
  const params = new URLSearchParams({ q: filters.q, status: filters.status, sort: filters.sort });
  if (filters.workspaceId) params.set("workspaceId", filters.workspaceId);
  if (filters.folderId) params.set("folderId", filters.folderId);
  return params.toString();
}

export function dashboardHref(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.workspaceId) params.set("workspaceId", filters.workspaceId);
  if (filters.folderId) params.set("folderId", filters.folderId);
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.sort !== "updated") params.set("sort", filters.sort);
  return params.size ? `/dashboard?${params.toString()}` : "/dashboard";
}
