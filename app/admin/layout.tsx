import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/pages";
import { DashboardNavbar, DashboardUserProfile } from "@/app/dashboard/_components/dashboard-navbar";
import { AdminNavigation } from "@/app/admin/_components/admin-navigation";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { buttonVariants } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AdminLoading />}><AdminShell>{children}</AdminShell></Suspense>;
}

async function AdminShell({ children }: { children: ReactNode }) {
  const user = await requirePageUser();
  if (!["admin", "super_admin"].includes(user.role)) redirect("/access-denied");
  return <div className="min-h-screen bg-[#f7f8fc] text-slate-900"><DashboardNavbar profile={<DashboardUserProfile userName={user.name} permissions={user.permissions} />} actions={<Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>Workspace</Link>} /><div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]"><AdminNavigation permissions={user.permissions} role={user.role} /><main className="min-w-0 p-5 sm:p-8 lg:p-10">{children}</main></div></div>;
}
