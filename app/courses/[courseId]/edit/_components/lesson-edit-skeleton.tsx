import { Skeleton } from "@/components/ui/skeleton";

export function LessonEditSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading lesson editor"
      className="min-h-screen bg-white text-slate-900"
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[68px] items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="h-4 w-40 max-w-[40vw]" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="hidden size-9 rounded-lg sm:block" />
            <Skeleton className="h-9 w-16 rounded-md sm:w-24" />
            <Skeleton className="h-9 w-16 rounded-md sm:w-24" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full space-y-7 px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-3">
          <Skeleton className="h-8 w-2/5 max-w-80" />
          <Skeleton className="h-4 w-1/3 max-w-64" />
        </div>

        <section
          aria-label="Loading lesson content"
          className="mx-auto max-w-5xl space-y-5"
        >
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <Skeleton className="h-6 w-1/2 max-w-96" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="aspect-[16/8] w-full rounded-xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
