import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/pages";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { MediaStorageManagement } from "@/app/admin/settings/media-storage/_components/media-storage-management";

async function StoragePage() {
  const user = await requirePagePermission("settings.manage", true);
  if (user.role !== "super_admin") redirect("/access-denied");
  return <MediaStorageManagement />;
}
export default function Page() {
  return <Suspense fallback={<AdminLoading />}><StoragePage /></Suspense>;
}
