import type { NextRequest } from "next/server";
import { DashboardError } from "@/lib/dashboard/rules";

export function assertMutationOrigin(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? request.nextUrl.protocol.replace(":", "");
  const expectedOrigin = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : host ? `${protocol}://${host}` : request.nextUrl.origin;
  if ((origin && origin !== expectedOrigin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new DashboardError("Request origin is not allowed.", 403);
  }
}
