import { Skeleton } from "@/components/ui/skeleton";
import { Presentation } from "lucide-react";

export function CoursePreviewSkeleton({ presentation = false }: { presentation?: boolean } = {}) {
  if (presentation) return <PresentationPreviewSkeleton />;

  return (
    <main
      role="status"
      aria-label="Loading course preview"
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-900"
    >
      <header className="relative z-50 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="hidden h-3 w-20 sm:block" />
          </div>
        </div>

        <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-14 rounded-md bg-slate-100" />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="ml-1 h-8 w-14 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </header>

      <div data-preview-viewport className="min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
        <div className="grid h-full min-h-0 w-full min-w-0 place-items-center overflow-hidden">
          <div
            data-preview-frame="desktop"
            className="min-h-0 min-w-0 w-full overflow-hidden bg-white"
          >
            <div
              data-preview-screen
              aria-label="Loading course content"
              className="h-full min-h-0 w-full min-w-0 overflow-hidden bg-white"
            >
              <div className="h-full overflow-y-auto">
                <section aria-label="Loading course cover" className="bg-slate-800 px-5 py-12 sm:px-10 sm:py-24">
                  <div className="mx-auto max-w-5xl">
                    <div className="mb-6 flex items-center gap-2.5">
                      <Skeleton className="size-9 rounded-full bg-white/20" />
                      <Skeleton className="h-4 w-28 bg-white/20" />
                    </div>
                    <Skeleton className="h-10 w-3/4 max-w-2xl bg-white/20 sm:h-14" />
                    <Skeleton className="mt-8 h-10 w-36 rounded-full bg-white/20" />
                  </div>
                </section>

                <div className="mx-auto max-w-5xl px-5 py-8 sm:px-10 sm:py-12">
                  <section aria-label="Loading course description" className="mx-auto mb-14 max-w-3xl space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-2/3" />
                  </section>

                  <section aria-label="Loading course outline" className="mx-auto max-w-3xl">
                    <div className="mb-5 flex items-end justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-7 w-44" />
                      </div>
                      <Skeleton className="h-4 w-24" />
                    </div>

                    <div className="space-y-8">
                      {["first", "second"].map((section) => (
                        <div key={section}>
                          <Skeleton className="mb-2 h-3 w-28" />
                          <div className="divide-y divide-slate-200 border-y border-slate-200">
                            {["one", "two", "three"].map((lesson) => (
                              <div key={lesson} className="flex min-h-16 items-start gap-3 px-2 py-3">
                                <Skeleton className="mt-0.5 size-5 rounded-sm" />
                                <div className="min-w-0 flex-1 space-y-2">
                                  <Skeleton className="h-4 w-3/4" />
                                  <Skeleton className="h-3 w-12" />
                                </div>
                                <Skeleton className="mt-1 size-4 rounded-sm" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function PresentationPreviewSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading presentation preview"
      data-presentation-preview-loading
      className="h-dvh min-h-0 w-full min-w-0 overflow-hidden bg-slate-50 text-slate-900"
    >
      <div data-presentation-view="true" className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
          <Skeleton className="size-8 rounded-md" />
          <Presentation size={18} aria-hidden="true" className="shrink-0 text-indigo-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-8 w-36 rounded-md" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="hidden h-8 w-14 rounded-md sm:block" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 place-items-center overflow-hidden bg-slate-50 p-4 sm:p-8">
          <div className="relative aspect-video w-full max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-[0_24px_70px_-18px_rgba(15,23,42,0.25)]">
            <Skeleton className="absolute inset-0 rounded-none bg-slate-100" />
            <div className="absolute inset-0 p-[8%]">
              <Skeleton className="h-[9%] w-2/5 bg-slate-200" />
              <Skeleton className="mt-[5%] h-[7%] w-4/5 bg-slate-200" />
              <Skeleton className="mt-[4%] h-[4%] w-3/5 bg-slate-200" />
              <div className="mt-[9%] grid grid-cols-3 gap-[4%]">
                <Skeleton className="h-24 bg-slate-200/80" />
                <Skeleton className="h-24 bg-slate-200/80" />
                <Skeleton className="h-24 bg-slate-200/80" />
              </div>
            </div>
            <Skeleton className="absolute left-3 top-3 size-8 rounded-md bg-white/90" />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              <Skeleton className="h-8 w-20 rounded-md bg-white/90" />
              <Skeleton className="h-8 w-20 rounded-md bg-white/90" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
