import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFreshPrincipal } from "@/lib/auth/authorization";
import { assertMutationOrigin } from "@/lib/auth/http-security";
import { dashboardErrorResponse } from "@/lib/dashboard/http";

export default auth(async (request) => {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    try { assertMutationOrigin(request); } catch (error) { return dashboardErrorResponse(error); }
    // APIs return their own 401/403 responses, rather than HTML login redirects.
    return NextResponse.next();
  }
  if (request.auth?.user?.id) {
    if (["/account-status", "/access-denied"].includes(request.nextUrl.pathname)) return NextResponse.next();
    try {
      const user = await getFreshPrincipal(request.auth.user.id);
      if (user.status !== "active") return NextResponse.redirect(new URL("/account-status", request.url));
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/account-status", request.url));
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // The local upload route independently checks session, current permissions,
  // ownership and origin; skip Proxy buffering so request bodies can stream.
  matcher: ["/((?!login|api/auth|api/courses/[^/]+/assets/[^/]+/upload|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
