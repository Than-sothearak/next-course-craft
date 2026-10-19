import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/pages";
import { AdminLoading } from "@/components/admin/admin-loading";
import { MediaStorageManagement } from "@/components/admin/media-storage-management";

async function StoragePage() {
  const user = await requirePagePermission("settings.manage", true);
  if (user.role !== "super_admin") redirect("/access-denied");
  return <MediaStorageManagement />;
}
export default function Page() {
  return <Suspense fallback={<AdminLoading />}><StoragePage /></Suspense>;
}
