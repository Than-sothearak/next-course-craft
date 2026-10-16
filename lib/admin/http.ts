import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import type { Permission } from "@/lib/auth/policy";
import { assertMutationOrigin } from "@/lib/auth/http-security";
import { dashboardErrorResponse } from "@/lib/dashboard/http";
import { listQuerySchema } from "./schemas";

export function adminQuery(request: NextRequest) {
  return listQuerySchema.parse(Object.fromEntries([...request.nextUrl.searchParams].filter(([, value]) => value !== "")));
}

export async function adminApi(request: NextRequest, permission: Permission, work: (actorId: string) => Promise<unknown>) {
  try {
    assertMutationOrigin(request);
    const actor = await requireAdmin(permission);
    return NextResponse.json(await work(actor.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = dashboardErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
