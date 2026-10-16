import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, ShieldCheck, ShieldX, PauseCircle } from "lucide-react";
import { requireAuthenticatedUser, getFreshPrincipal, requireActiveUser } from "@/lib/auth/authorization";
import { signIn } from "@/lib/auth";
import { signOutAction } from "@/app/dashboard/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingPage } from "@/components/loading-page";

export default function AccountStatusPage() {
  return <Suspense fallback={<LoadingPage message="Checking account status…" />}><AccountStatus /></Suspense>;
}

async function AccountStatus() {
  let identity;
  try { identity = await requireAuthenticatedUser(); } catch { redirect("/login"); }
  const user = await getFreshPrincipal(identity.id);
  const content = {
    pending: { title: "Waiting for approval", message: "Your account is registered. An administrator will review your request and assign your access. You can return here to check its status.", icon: Clock3 },
    active: { title: "Your account is approved", message: "You can now access the courses and tools permitted by your role.", icon: ShieldCheck },
    rejected: { title: "Registration not approved", message: "Your account does not currently have access to Coursecraft. Contact your administrator if you believe this is a mistake.", icon: ShieldX },
    suspended: { title: "Your access is suspended", message: "Your platform access has been temporarily disabled. Contact your administrator for help.", icon: PauseCircle },
  }[user.status];
  const Icon = content.icon;
  async function connectGoogle() { "use server"; await requireActiveUser(); await signIn("google", { redirectTo: "/account-status" }); }
  async function connectGitHub() { "use server"; await requireActiveUser(); await signIn("github", { redirectTo: "/account-status" }); }
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12"><Card className="w-full max-w-lg p-8 text-center sm:p-10">
    <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Icon size={30} /></div>
    <Badge variant={user.status === "active" ? "success" : "secondary"}>{user.status}</Badge>
    <h1 className="mt-4 text-2xl font-semibold tracking-tight">{content.title}</h1>
    <p className="mt-4 leading-7 text-slate-600">{content.message}</p>
    <p className="mt-4 text-sm text-slate-500">Signed in as {user.email ?? user.name}</p>
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      {user.status === "active" ? <Link href="/dashboard" className={buttonVariants()}>Open workspace</Link> : <form action="/account-status" method="get"><Button type="submit" variant="outline">Check again</Button></form>}
      <form action={signOutAction}><Button type="submit" variant="outline">Sign out</Button></form>
    </div>
    {user.status === "active" && <div className="mt-8 border-t border-slate-100 pt-6"><p className="text-sm leading-6 text-slate-500">Connect another sign-in method while authenticated to keep both providers on this account.</p><div className="mt-4 flex flex-wrap justify-center gap-3"><form action={connectGoogle}><Button type="submit" variant="outline">Connect Google</Button></form><form action={connectGitHub}><Button type="submit" variant="outline">Connect GitHub</Button></form></div></div>}
  </Card></main>;
}
