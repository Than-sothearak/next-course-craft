export function EducationalChecklist({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="min-w-0 space-y-3" aria-label={title || "Checklist"}>
      {title && <h3 className="text-lg font-semibold leading-snug text-slate-900">{title}</h3>}
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-700">
            <span aria-hidden="true" className="mt-1 grid size-4 shrink-0 place-items-center rounded border border-indigo-400 bg-white text-[10px] font-bold text-indigo-700">✓</span>
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
