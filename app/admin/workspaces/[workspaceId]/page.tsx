import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/pages";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { WorkspaceDetail } from "@/app/admin/workspaces/[workspaceId]/_components/workspace-detail";

async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const user = await requirePagePermission("workspaces.manage", true);
  if (user.role !== "super_admin") redirect("/access-denied");
  return <WorkspaceDetail workspaceId={(await params).workspaceId} />;
}

export default function Page({ params }: { params: Promise<{ workspaceId: string }> }) {
  return <Suspense fallback={<AdminLoading />}><WorkspacePage params={params} /></Suspense>;
}
