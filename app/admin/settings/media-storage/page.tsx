import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { requirePagePermission } from "@/lib/auth/pages";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { MediaStorageManagement } from "@/app/admin/settings/media-storage/_components/media-storage-management";
import { getMediaStorageSettings } from "@/lib/media/settings";
import { AdminResourceProvider } from "@/app/admin/_components/shared/admin-resource-provider";

async function StoragePage() {
  'use cache: private';
  cacheLife({ stale: 300 });
  cacheTag("admin", "admin:settings", "admin:settings:media-storage");
  const user = await requirePagePermission("settings.manage", true, { allowPrefetch: true });
  if (user.role !== "super_admin") redirect("/access-denied");
  const data = await getMediaStorageSettings(user.id);
  return <AdminResourceProvider initialResource={{ url: "/api/admin/settings/media-storage", data }}><MediaStorageManagement /></AdminResourceProvider>;
}
export default function Page() {
  return <Suspense fallback={<AdminLoading />}><StoragePage /></Suspense>;
}
