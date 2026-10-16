import { WorkspaceInvitationClient } from "./workspace-invitation-client";

export default async function WorkspaceInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <WorkspaceInvitationClient token={token} />;
}
