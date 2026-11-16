import { Check } from "lucide-react";

export function EducationalChecklist({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="min-w-0 space-y-3" aria-label={title || "Checklist"}>
      {title && <h3 className="text-lg font-semibold leading-snug text-slate-900">{title}</h3>}
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm leading-6 text-slate-700 shadow-sm">
            <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_30%,transparent)] bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_10%,white)] text-[var(--course-primary,#2f5f9f)] shadow-sm">
              <Check size={15} strokeWidth={2.75} />
            </span>
            <span className="min-w-0 flex-1 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
