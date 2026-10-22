import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { requirePagePermission } from "@/lib/auth/pages";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { WorkspaceManagement } from "@/app/admin/workspaces/_components/workspace-management";
import { listAdminWorkspaces } from "@/lib/admin/workspaces";
import { listQuerySchema } from "@/lib/admin/schemas";
import { AdminResourceProvider } from "@/app/admin/_components/shared/admin-resource-provider";

async function WorkspacesPage() {
  'use cache: private';
  cacheLife({ stale: 300 });
  cacheTag("admin", "admin:workspaces");
  const user = await requirePagePermission("workspaces.manage", true, { allowPrefetch: true });
  if (user.role !== "super_admin") redirect("/access-denied");
  const data = await listAdminWorkspaces(user.id, listQuerySchema.parse({}));
  return <AdminResourceProvider initialResource={{ url: "/api/admin/workspaces?q=&page=1", data }}><WorkspaceManagement /></AdminResourceProvider>;
}

export default function Page() {
  return <Suspense fallback={<AdminLoading />}><WorkspacesPage /></Suspense>;
}
