import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse } from "@/lib/dashboard/http";
import { acceptWorkspaceInvitation, getWorkspaceInvitation } from "@/lib/workspaces/services";

type Context = { params: Promise<{ token: string }> };

async function getSessionUser() {
  const user = await requireActiveUser();
  return { userId: user.id, email: user.email };
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
