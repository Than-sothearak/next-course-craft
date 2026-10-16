import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardNavbar } from "./dashboard-navbar";

export function DashboardProfileSkeleton() {
  return <div role="status" aria-label="Loading user profile">
    <Skeleton className="size-9 rounded-full" />
  </div>;
}

export function DashboardSidebarSkeleton() {
  return <aside aria-label="Workspace navigation" aria-busy="true" className="hidden border-r border-slate-200 bg-white lg:block">
    <div className="sticky top-16 flex min-h-[calc(100vh-4rem)] flex-col px-3 py-7 xl:px-5">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
      <Button disabled variant="secondary" className="mt-3 w-full justify-start rounded-lg px-3"><BookOpen size={17} aria-hidden="true" />All courses</Button>
      <div className="mt-7 flex h-10 items-center px-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Folders</p>
      </div>
      <div role="status" aria-label="Loading folder navigation" className="mt-2 space-y-0.5">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className={`flex h-9 items-center gap-3 px-3 ${index === 2 || index === 3 ? "ml-5" : ""}`}>
          <Skeleton className="size-4 shrink-0" /><Skeleton className={index % 2 ? "h-3 w-20" : "h-3 w-28"} /><Skeleton className="ml-auto h-3 w-4" />
        </div>)}
      </div>
      <div className="mt-auto rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
        <Sparkles size={18} className="text-indigo-600" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">Start with a course</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Keep each learning project organized in one place.</p>
        <Button disabled variant="link" className="mt-3 h-auto min-h-0 p-0 text-xs">Create a course <span aria-hidden="true">→</span></Button>
      </div>
    </div>
  </aside>;
}

export function DashboardFoldersSkeleton({ view = "grid" }: { view?: "grid" | "list" }) {
  return <section className="mt-5" aria-label="Loading folders" aria-busy="true">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-700">Folders</h2><Skeleton className="h-3 w-14" /></div>
    <div className={view === "grid" ? "grid gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "grid gap-2"}>
      {Array.from({ length: 4 }, (_, index) => <Card key={index} className="flex items-start gap-3 rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
        <Skeleton className="size-5 shrink-0" /><div className="min-w-0 flex-1 space-y-1"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /></div><Skeleton className="size-8 shrink-0" />
      </Card>)}
    </div>
  </section>;
}

export function DashboardCoursesSkeleton() {
  return <section className="mt-8" aria-label="Loading courses" aria-busy="true">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-700">Courses</h2><span className="text-xs text-slate-400">Showing up to 200</span></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
      {Array.from({ length: 8 }, (_, index) => <Card key={index} className="overflow-hidden rounded-2xl">
        <Skeleton className="aspect-video w-full rounded-none" />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-4/5" />
              <div className="mt-1 flex h-10 flex-col justify-between py-1"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>
            </div>
            <Skeleton className="size-8 shrink-0" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-3 w-20" /></div>
          <div className="mt-3 flex items-center justify-between"><Skeleton className="h-4 w-14" /><Skeleton className="h-4 w-20" /></div>
        </div>
      </Card>)}
    </div>
  </section>;
}

export function DashboardContentSkeleton() {
  return <section aria-label="Loading workspace" className="min-w-0 px-5 py-7 sm:px-8 lg:px-8 xl:p-4">
    <div role="status" className="sr-only">Loading your folders and courses…</div>
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div className="min-w-0"><Skeleton className="mt-1 h-10 w-80 max-w-full" /><p className="mt-2 text-sm text-slate-500">Organize your workspace and pick up where you left off.</p></div>
      <div className="flex shrink-0 gap-2"><Skeleton className="h-10 w-28 rounded-lg" /><Skeleton className="h-10 w-28 rounded-lg" /></div>
    </div>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-10 w-full sm:w-72" /></div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-4 w-32" /><div className="flex gap-2"><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-32" /></div></div>
    <DashboardFoldersSkeleton /><DashboardCoursesSkeleton />
  </section>;
}

export function DashboardSkeleton() {
  return <main className="flex min-h-screen flex-col bg-[#f7f8fc] text-slate-900">
    <DashboardNavbar profile={<DashboardProfileSkeleton />} />
    <DashboardWorkspaceSkeleton />
  </main>;
}

export function DashboardWorkspaceSkeleton() {
  return <div className="grid flex-1 lg:grid-cols-[260px_minmax(0,1fr)]"><DashboardSidebarSkeleton /><DashboardContentSkeleton /></div>;
}
