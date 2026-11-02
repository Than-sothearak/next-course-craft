"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";
import type { Permission } from "@/lib/auth/policy";

function userInitials(name: string) {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

type NavbarProps = { actions?: ReactNode; primaryAction?: ReactNode; permissions?: Permission[]; hideAccount?: boolean } & (
  | { userName: string; profile?: never }
  | { userName?: never; profile: ReactNode }
);

export function DashboardNavbar({ userName, profile, actions, primaryAction, permissions, hideAccount = false }: NavbarProps) {
  return <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
    <div className="flex min-h-16 w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-8 md:flex-nowrap lg:px-9 xl:px-12">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link href="/dashboard" aria-label="Coursecraft dashboard" className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 sm:gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><BookOpen size={19} aria-hidden="true" /></span>
          <span className="text-base font-bold tracking-tight sm:text-lg">Coursecraft</span>
        </Link>
        {actions && <div role="group" aria-label="Route navigation" className="flex min-w-0 items-center gap-1 overflow-x-auto">{actions}</div>}
      </div>
      {!hideAccount && <nav aria-label="Account" className={`flex min-w-0 items-center justify-end gap-2 sm:gap-3 ${primaryAction ? "w-full md:w-auto md:flex-1" : "shrink-0"}`}>
        {primaryAction && <div className="min-w-0 flex-1 [&>div]:flex-wrap [&>div]:justify-end md:flex-initial">{primaryAction}</div>}
        <div className="shrink-0">{profile ?? <DashboardUserProfile userName={userName ?? "Author"} permissions={permissions} />}</div>
      </nav>}
    </div>
  </header>;
}

export function DashboardUserProfile({ userName, permissions = [] }: { userName: string; permissions?: Permission[] }) {
  return <details className="relative">
          <summary
            title={userName}
            aria-label={`Open profile menu for ${userName}`}
            className="grid size-9 cursor-pointer list-none place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden"
          >
            {userInitials(userName)}
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <p className="truncate px-3 py-2 text-sm font-medium text-slate-700">{userName}</p>
            <div className="my-1 border-t border-slate-100" />
            {permissions.some((permission) => ["users.view", "courses.manage_all", "roles.manage", "audit.view", "settings.manage"].includes(permission)) && <Link href={permissions.includes("users.view") ? "/admin" : permissions.includes("courses.manage_all") ? "/admin/courses" : permissions.includes("roles.manage") ? "/admin/roles" : permissions.includes("audit.view") ? "/admin/audit-logs" : "/admin/settings"} className="block rounded-md px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">Administration</Link>}
            <Link href="/account-status" className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Account status</Link>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-slate-700">
                Sign out
              </Button>
            </form>
          </div>
    </details>;
}
