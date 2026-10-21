"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesCombined, Users, UserCheck, ShieldCheck, BookOpen, Building2, ScrollText, Settings } from "lucide-react";
import type { Permission, PlatformRole } from "@/lib/auth/policy";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview", permission: "users.view", icon: ChartNoAxesCombined },
  { href: "/admin/users", label: "Users", permission: "users.view", icon: Users },
  { href: "/admin/approvals", label: "Approval queue", permission: "users.approve", icon: UserCheck },
  { href: "/admin/roles", label: "Roles & permissions", permission: "roles.manage", icon: ShieldCheck },
  { href: "/admin/courses", label: "All courses", permission: "courses.manage_all", icon: BookOpen },
  { href: "/admin/workspaces", label: "Workspaces", permission: "workspaces.manage", icon: Building2 },
  { href: "/admin/audit-logs", label: "Audit log", permission: "audit.view", icon: ScrollText },
  { href: "/admin/settings", label: "Platform settings", permission: "settings.manage", icon: Settings },
] as const;

export function AdminNavigation({ permissions, role }: { permissions: Permission[]; role: PlatformRole }) {
  const pathname = usePathname();
  return <nav aria-label="Administration" className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 lg:min-h-[calc(100vh-4rem)] lg:flex-col lg:border-b-0 lg:border-r lg:p-5">{links.filter((link) => permissions.includes(link.permission) && (link.href !== "/admin/workspaces" || role === "super_admin") && (link.href !== "/admin/approvals" || permissions.includes("users.view")) && (link.href !== "/admin/courses" || permissions.includes("courses.view"))).map((link) => {
    const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`));
    const Icon = link.icon;
    return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={cn("inline-flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition hover:bg-slate-50", active ? "bg-indigo-50 text-indigo-700" : "text-slate-600")}><Icon size={18} />{link.label}</Link>;
  })}</nav>;
}
