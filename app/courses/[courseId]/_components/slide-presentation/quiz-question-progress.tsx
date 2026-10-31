export function QuizQuestionProgress({ index, total, passingScore }: { index: number; total: number; passingScore: number }) {
  return <div className="flex items-center justify-between gap-4 text-xs font-medium text-slate-500">
    <span>Q{index + 1} of {total}<span className="ml-3">Pass at {passingScore}%</span></span>
    <div role="progressbar" aria-label="Quiz question progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${((index + 1) / total) * 100}%`, backgroundColor: "var(--course-primary, #2f5f9f)" }} />
    </div>
  </div>;
}
