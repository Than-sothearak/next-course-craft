import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/pages";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { WorkspaceManagement } from "@/app/admin/workspaces/_components/workspace-management";

async function WorkspacesPage() {
  const user = await requirePagePermission("workspaces.manage", true);
  if (user.role !== "super_admin") redirect("/access-denied");
  return <WorkspaceManagement />;
}

export default function Page() {
  return <Suspense fallback={<AdminLoading />}><WorkspacesPage /></Suspense>;
}
