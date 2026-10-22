import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { handlePageAuthorizationError, requirePagePermission } from "@/lib/auth/pages";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { WorkspaceDetail } from "@/app/admin/workspaces/[workspaceId]/_components/workspace-detail";
import { getAdminWorkspace } from "@/lib/admin/workspaces";
import { AdminResourceProvider } from "@/app/admin/_components/shared/admin-resource-provider";

async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  return <CachedWorkspace workspaceId={(await params).workspaceId} />;
}

async function CachedWorkspace({ workspaceId }: { workspaceId: string }) {
  'use cache: private';
  cacheLife({ stale: 300 });
  const user = await requirePagePermission("workspaces.manage", true, { allowPrefetch: true });
  if (user.role !== "super_admin") redirect("/access-denied");
  cacheTag("admin", "admin:workspaces", `admin:workspaces:${workspaceId}`);
  const data = await getAdminWorkspace(user.id, workspaceId).catch(handlePageAuthorizationError);
  return <AdminResourceProvider initialResource={{ url: `/api/admin/workspaces/${workspaceId}`, data }}><WorkspaceDetail workspaceId={workspaceId} /></AdminResourceProvider>;
}

export default function Page({ params }: { params: Promise<{ workspaceId: string }> }) {
  return <Suspense fallback={<AdminLoading />}><WorkspacePage params={params} /></Suspense>;
}
