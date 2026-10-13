"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";

function userInitials(name: string) {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

export function DashboardNavbar({ userName, actions, primaryAction }: { userName: string; actions?: ReactNode; primaryAction?: ReactNode }) {
  return <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
    <div className="flex h-16 w-full items-center justify-between px-5 sm:px-8 lg:px-9 xl:px-12">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><BookOpen size={19} aria-hidden="true" /></span>
          <span className="text-lg font-bold tracking-tight">Coursecraft</span>
        </Link>
        {actions && <div role="group" aria-label="Route navigation" className="flex items-center gap-1">{actions}</div>}
      </div>
      <nav aria-label="Account" className="flex items-center gap-3">
        {primaryAction}
        <form action={signOutAction}><Button variant="outline" size="sm">Sign out</Button></form>
        <span title={userName} aria-label={`Signed in as ${userName}`} className="grid size-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">{userInitials(userName)}</span>
      </nav>
    </div>
  </header>;
}
