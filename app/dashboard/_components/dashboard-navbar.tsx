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
    <div className="flex h-16 w-full items-center justify-between px-5 sm:px-8 lg:px-9 xl:px-12">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><BookOpen size={19} aria-hidden="true" /></span>
          <span className="text-lg font-bold tracking-tight">Coursecraft</span>
        </Link>
        {actions && <div role="group" aria-label="Route navigation" className="flex items-center gap-1">{actions}</div>}
      </div>
      {!hideAccount && <nav aria-label="Account" className="flex items-center gap-3">
        {primaryAction}
        {profile ?? <DashboardUserProfile userName={userName ?? "Author"} permissions={permissions} />}
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
