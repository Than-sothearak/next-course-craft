import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { auth } from "@/lib/auth";
import { DashboardError } from "./rules";

export async function requireOwnerId() {
  const session = await auth();
  if (!session?.user?.id) throw new DashboardError("Sign in to manage your courses.", 401);
  return session.user.id;
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
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
