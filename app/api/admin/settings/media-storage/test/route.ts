import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { readJson } from "@/lib/dashboard/http";
import { testMediaStorageSettings } from "@/lib/media/settings";
import { mediaStorageTestSchema } from "@/lib/media/settings-schema";

export async function POST(request: NextRequest) {
  return adminApi(request, "settings.manage", async (actorId) => {
    return testMediaStorageSettings(actorId, await readJson(request, mediaStorageTestSchema));
  });
}
