import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse } from "@/lib/dashboard/http";
import { acceptWorkspaceInvitation, getWorkspaceInvitation } from "@/lib/workspaces/services";
import { DashboardError } from "@/lib/dashboard/rules";

type Context = { params: Promise<{ token: string }> };

async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) throw new DashboardError("Sign in to accept this invitation.", 401);
  return { userId: session.user.id, email: session.user.email ?? null };
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    await connectToDatabase();
    const { email } = await getSessionUser();
    const { token } = await context.params;
    return NextResponse.json(await getWorkspaceInvitation(email, token));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(_request: NextRequest, context: Context) {
  try {
    await connectToDatabase();
    const { userId, email } = await getSessionUser();
    const { token } = await context.params;
    return NextResponse.json(await acceptWorkspaceInvitation(userId, email, token));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
