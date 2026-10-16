import type { NextRequest } from "next/server";
import { adminApi, adminQuery } from "@/lib/admin/http";
import { listAuditLogs } from "@/lib/admin/queries";

export async function GET(request: NextRequest) {
  return adminApi(request, "audit.view", (actorId) => listAuditLogs(actorId, adminQuery(request)));
}
