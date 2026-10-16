import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getDashboardListing, getDashboardNavigation } from "@/lib/dashboard/services/list";
import type { DashboardFilters, DashboardListing, DashboardNavigation } from "@/lib/dashboard/types";

export type DashboardLoadResult<T> = { data: T; error: string | null };

// Request-scoped deduplication; authenticated data is never shared across users.
export const getDashboardUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fdashboard");
  return {
    ownerId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "Author",
  };
});

async function connectDashboardStorage() {
  if (!process.env.MONGODB_URI) throw new Error("Add MONGODB_URI to .env.local to enable course storage.");
  await connectToDatabase();
}

export async function loadDashboardNavigation(workspaceId: string | null): Promise<DashboardLoadResult<DashboardNavigation>> {
  const { ownerId } = await getDashboardUser();
  try {
    await connectDashboardStorage();
    return { data: await getDashboardNavigation(ownerId, workspaceId), error: null };
  } catch (error) {
    return { data: { folderOptions: [], folderTree: [], workspaces: [], workspaceId, workspaceName: workspaceId ? "Team workspace" : "Personal", workspaceRole: workspaceId ? "viewer" : "owner" }, error: error instanceof Error ? error.message : "Folder navigation is unavailable." };
  }
}

export async function loadDashboardListing(filters: DashboardFilters): Promise<DashboardLoadResult<DashboardListing>> {
  const { ownerId } = await getDashboardUser();
  try {
    await connectDashboardStorage();
    return { data: await getDashboardListing(ownerId, filters), error: null };
  } catch (error) {
    return {
      data: { currentFolder: null, breadcrumbs: [{ id: null, name: "All courses" }], folders: [], courses: [] },
      error: error instanceof Error ? error.message : "Course storage is unavailable.",
    };
  }
}
