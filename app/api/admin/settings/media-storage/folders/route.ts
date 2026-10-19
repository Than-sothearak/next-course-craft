import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { requireStorageAdmin } from "@/lib/media/settings";
import { listLocalStorageFolders } from "@/lib/media/local-browser";
import { mediaStorageFolderQuerySchema } from "@/lib/media/settings-schema";

export async function GET(request: NextRequest) {
  return adminApi(request, "settings.manage", async (actorId) => {
    await requireStorageAdmin(actorId);
    const input = mediaStorageFolderQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return listLocalStorageFolders(input.path);
  });
}
