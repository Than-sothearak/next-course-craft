import { Skeleton } from "@/components/ui/skeleton";

export function LessonEditSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading lesson editor"
      className="min-h-svh bg-slate-50"
    >
      <div aria-hidden="true" className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-48 max-w-full" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-screen-2xl lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          aria-hidden="true"
          className="hidden border-r bg-white p-5 lg:block"
        >
          <Skeleton className="mb-6 h-4 w-28" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <Skeleton className="mb-4 mt-9 h-4 w-24" />
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </aside>

        <section
          aria-label="Loading lesson content"
          className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-12"
        >
          <div aria-hidden="true">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-72 max-w-full" />
              </div>
              <Skeleton className="hidden h-9 w-28 rounded-lg sm:block" />
            </div>

            <div className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <div className="flex justify-end gap-2 pt-2">
                <Skeleton className="h-9 w-20 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </div>

            <div className="mt-6 space-y-4 rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
