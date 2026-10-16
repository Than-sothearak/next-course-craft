import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType } from "zod";
import { requireActiveUser } from "@/lib/auth/authorization";
import { DashboardError } from "./rules";
import { assertMutationOrigin } from "@/lib/auth/http-security";

export async function requireOwnerId() {
  return (await requireActiveUser()).id;
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  assertMutationOrigin(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new DashboardError("Request body must be valid JSON.", 400);
  }
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) throw new DashboardError(error.issues.map((issue) => issue.message).join(" "), 400);
    throw error;
  }
}

export function dashboardErrorResponse(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof DashboardError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    return NextResponse.json({ error: "An item with that name already exists here." }, { status: 409 });
  }
  console.error("Dashboard request failed", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function getOwnerIdOrResponse() {
  try {
    return { ownerId: await requireOwnerId(), response: null };
  } catch (error) {
    return { ownerId: null, response: dashboardErrorResponse(error) };
  }
}
