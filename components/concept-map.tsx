import { useId } from "react";

export type ConceptMapData = {
  title: string;
  centralConcept: string;
  centralExplanation: string;
  branches: { id: string; relationship: string; concept: string; explanation: string }[];
};

export function ConceptMap({ data }: { data: ConceptMapData }) {
  const titleId = useId();
  const ConceptHeading = data.title ? "h4" : "h3";
  const BranchHeading = data.title ? "h5" : "h4";

  return (
    <section
      aria-label={data.title ? undefined : "Concept map"}
      aria-labelledby={data.title ? titleId : undefined}
      className="min-w-0 space-y-4"
      data-concept-map
    >
      {data.title && <h3 id={titleId} className="text-lg font-semibold leading-snug text-slate-900">{data.title}</h3>}
      <div className="mx-auto w-full max-w-3xl min-w-0">
        <article className="min-w-0 rounded-xl border-2 border-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_35%,#cbd5e1)] bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_7%,white)] px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--course-primary,#2f5f9f)]">Central concept</p>
          <ConceptHeading className="mt-1 break-words text-base font-semibold leading-6 text-slate-900">{data.centralConcept}</ConceptHeading>
          {data.centralExplanation && <p className="mt-1 break-words text-sm leading-6 text-slate-700">{data.centralExplanation}</p>}
        </article>
        <ul aria-label={`Concepts related to ${data.centralConcept}`} className="relative ms-5 mt-4 list-none space-y-3 border-s-2 border-slate-200 ps-5">
          {data.branches.map((branch) => (
            <li key={branch.id} className="relative min-w-0 before:absolute before:-start-[1.625rem] before:top-4 before:h-px before:w-5 before:bg-slate-200">
              <span aria-hidden="true" className="absolute -start-[1.78rem] top-3 size-2.5 rounded-full bg-[var(--course-primary,#2f5f9f)] ring-4 ring-white" />
              <article className="min-w-0 rounded-lg border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
                <p className="text-xs font-semibold text-[var(--course-primary,#2f5f9f)]">{branch.relationship}</p>
                <BranchHeading className="mt-1 break-words text-base font-semibold leading-6 text-slate-900">{branch.concept}</BranchHeading>
                {branch.explanation && <p className="mt-1 break-words text-sm leading-6 text-slate-700">{branch.explanation}</p>}
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
