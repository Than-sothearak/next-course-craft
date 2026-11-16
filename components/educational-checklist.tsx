import { Check } from "lucide-react";
import { useId } from "react";

export function EducationalChecklist({ title, items }: { title: string; items: string[] }) {
  const titleId = useId();
  return (
    <section className="min-w-0 space-y-3" aria-label={title ? undefined : "Checklist"} aria-labelledby={title ? titleId : undefined}>
      {title && <h3 id={titleId} className="text-lg font-semibold leading-snug text-slate-900">{title}</h3>}
      <ul className="divide-y divide-slate-200/80">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex min-w-0 items-start gap-3 py-3 text-sm leading-6 text-slate-700 first:pt-0 last:pb-0">
            <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_10%,white)] text-[var(--course-primary,#2f5f9f)]">
              <Check size={14} strokeWidth={2.75} />
            </span>
            <span className="min-w-0 flex-1 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
