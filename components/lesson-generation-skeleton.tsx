import { Skeleton } from "@/components/ui/skeleton";

export function LessonGenerationSkeleton({ lessonId, position, variant = "row" }: {
  lessonId: string;
  position: number;
  variant?: "row" | "slide";
}) {
  return <div
    role="status"
    aria-label={`Lesson draft ${position} loading`}
    aria-busy="true"
    data-pending-lesson-id={lessonId}
    className={variant === "slide" ? "w-36 shrink-0 space-y-2 rounded-lg border border-slate-200 bg-white p-2 lg:w-full" : "flex min-h-[88px] min-w-0 items-start gap-3 bg-white py-4 pl-9 pr-2"}
  >
    {variant === "slide" ? <Skeleton className="aspect-video w-full" /> : <Skeleton className="mt-0.5 size-5 shrink-0" />}
    <div className="min-w-0 flex-1 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
    {variant === "row" && <Skeleton className="mr-9 hidden h-9 w-24 shrink-0 rounded-full sm:block" />}
  </div>;
}
