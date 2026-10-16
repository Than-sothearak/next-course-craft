"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type InvitationInfo = { workspaceName: string; role: string; emailMatches: boolean };

export function WorkspaceInvitationClient({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");
  const [acceptedWorkspace, setAcceptedWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/workspace-invitations/${encodeURIComponent(token)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setSignedOut(true);
          return;
        }
        const body = await response.json() as InvitationInfo & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "This invitation is unavailable.");
        setInvitation(body);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This invitation is unavailable.");
      });
    return () => controller.abort();
  }, [token]);

  async function acceptInvitation() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/workspace-invitations/${encodeURIComponent(token)}`, { method: "POST" });
      const body = await response.json() as { workspaceId?: string; workspaceName?: string; error?: string };
      if (!response.ok || !body.workspaceId) throw new Error(body.error ?? "Could not join the workspace.");
      setAcceptedWorkspace({ id: body.workspaceId, name: body.workspaceName ?? "Workspace" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join the workspace.");
    } finally {
      setBusy(false);
    }
  }

  const callbackUrl = `/workspace-invitations/${encodeURIComponent(token)}`;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-slate-900">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="grid size-12 place-items-center rounded-2xl bg-indigo-600 text-white"><BookOpen size={22} /></div>
        {acceptedWorkspace ? <>
          <p className="mt-6 text-sm font-semibold text-emerald-700">Invitation accepted</p>
          <h1 className="mt-2 text-2xl font-semibold">You joined {acceptedWorkspace.name}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Your team workspace is ready.</p>
          <Link href={`/dashboard?workspaceId=${encodeURIComponent(acceptedWorkspace.id)}`} className="mt-7 inline-flex"><Button>Open workspace <ArrowRight size={16} /></Button></Link>
        </> : signedOut ? <>
          <p className="mt-6 text-sm font-semibold text-indigo-700">Team invitation</p>
          <h1 className="mt-2 text-2xl font-semibold">Sign in to continue</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Sign in with the GitHub account that received this invitation. You’ll return here to accept it.</p>
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="mt-7 inline-flex"><Button>Sign in with GitHub <ArrowRight size={16} /></Button></Link>
        </> : invitation ? <>
          <p className="mt-6 text-sm font-semibold text-indigo-700">Team invitation</p>
          <h1 className="mt-2 text-2xl font-semibold">Join {invitation.workspaceName}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">You’ve been invited as a <span className="font-semibold">{invitation.role}</span>. Workspace courses and folders will appear in your dashboard.</p>
          {invitation.emailMatches ? <Button className="mt-7" disabled={busy} onClick={() => void acceptInvitation()}>{busy ? "Joining…" : "Accept invitation"} <Users size={16} /></Button> : <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Sign in with the email address that received this invitation.</p>}
        </> : <>
          <p role="status" className="mt-6 text-sm text-slate-600">Checking invitation…</p>
        </>}
        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {!acceptedWorkspace && !signedOut && <div className="mt-7 border-t border-slate-100 pt-5 text-sm text-slate-500"><Link href="/dashboard" className="hover:text-indigo-700">Return to dashboard</Link></div>}
      </section>
    </main>
  );
}
