import { Skeleton } from "@/components/ui/skeleton";

export function LoginSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading sign-in page"
      className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]"
    >
      <section
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-slate-950 px-12 py-10 lg:flex lg:flex-col lg:justify-between xl:px-20"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl bg-white/15" />
          <Skeleton className="h-5 w-28 bg-white/15" />
        </div>
        <div className="max-w-xl space-y-6 pb-10">
          <Skeleton className="h-3 w-56 bg-white/15" />
          <Skeleton className="h-12 w-full max-w-lg bg-white/15" />
          <Skeleton className="h-12 w-4/5 bg-white/15" />
          <Skeleton className="h-5 w-4/5 max-w-md bg-white/15" />
          <div className="grid gap-4 pt-5 sm:grid-cols-2">
            <Skeleton className="h-32 rounded-2xl bg-white/10" />
            <Skeleton className="h-32 rounded-2xl bg-white/10" />
          </div>
        </div>
        <Skeleton className="h-4 w-64 bg-white/15" />
      </section>

      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
        <div className="flex items-center gap-2 lg:hidden">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-4 w-24" />
        </div>

        <div
          aria-hidden="true"
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12"
        >
          <Skeleton className="mb-8 size-12 rounded-2xl" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-9 w-full max-w-sm" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-10 h-13 w-full rounded-xl" />
          <Skeleton className="mx-auto mt-6 h-4 w-3/4" />
          <div className="my-9 flex items-center gap-4">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-px flex-1" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>

        <div aria-hidden="true" className="mx-auto w-full max-w-md pb-2">
          <Skeleton className="mx-auto h-3 w-4/5" />
          <Skeleton className="mx-auto mt-2 h-3 w-2/3" />
        </div>
      </section>
    </main>
  );
}
