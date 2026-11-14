import { Skeleton } from "@/components/ui/skeleton";

export function LessonEditSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading lesson editor"
      className="min-h-screen bg-slate-100 text-slate-900"
    >
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg">
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
                Coursecraft authoring
              </p>
              <Skeleton className="mt-1 h-4 w-44 max-w-full" />
            </div>
          </div>

          <div className="flex max-w-full shrink-0 items-center gap-1">
            <div className="grid size-8 shrink-0 place-items-center rounded-md">
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <div className="grid size-8 shrink-0 place-items-center rounded-md">
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <div className="grid size-8 shrink-0 place-items-center rounded-md">
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <div className="grid size-8 shrink-0 place-items-center rounded-md">
              <Skeleton className="size-4 rounded-sm" />
            </div>
            <div className="mx-1 flex items-center border-x border-slate-200 px-1">
              <div className="grid size-8 place-items-center rounded-md">
                <Skeleton className="size-4 rounded-sm" />
              </div>
              <div className="grid size-8 place-items-center rounded-md">
                <Skeleton className="size-4 rounded-sm" />
              </div>
            </div>
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-indigo-600">
              <Skeleton className="size-4 rounded-sm bg-indigo-300" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-none pb-40" aria-hidden="true">
        <section className="relative mx-auto w-full max-w-[720px] px-4 py-10">
          <Skeleton className="h-12 w-3/4" />
        </section>

        <section className="w-full bg-white py-10">
          <div className="mx-auto w-full max-w-[720px] space-y-5 px-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </section>

        <section className="w-full bg-white py-10">
          <div className="mx-auto w-full max-w-[720px] space-y-5 px-4">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </section>

        <div className="mt-5 flex justify-center" aria-hidden="true">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 shadow-sm">
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </main>
  );
}
