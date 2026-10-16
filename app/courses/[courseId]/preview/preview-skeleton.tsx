import { Skeleton } from "@/components/ui/skeleton";

export function CoursePreviewSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading course preview"
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-900"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:min-h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-4 w-40 max-w-[35vw]" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="hidden h-9 w-24 rounded-md sm:block" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="size-9 rounded-md" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6">
        <section
          aria-label="Loading course content"
          className="flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-slate-200 px-4 sm:px-6">
            <Skeleton className="h-4 w-44 max-w-[45vw]" />
            <Skeleton className="h-3 w-24" />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-5 sm:p-8 lg:p-10">
            <div className="mx-auto grid h-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="space-y-7">
                <Skeleton className="aspect-[16/6] w-full rounded-2xl" />
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4 max-w-xl" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="space-y-3 border-t border-slate-100 pt-6">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
              <aside className="hidden space-y-4 rounded-xl border border-slate-200 p-5 lg:block">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="mt-5 h-10 w-full rounded-lg" />
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
