import "katex/dist/katex.min.css";
import { useId } from "react";
import { previewEquation } from "@/lib/editor/text-equation";

type FormulaData = {
  title: string;
  latex: string;
  explanation: string;
  variables: { symbol: string; explanation: string }[];
};

export function EducationalFormula({ data }: { data: FormulaData }) {
  const equation = previewEquation(data.latex, true);
  const titleId = useId();
  const explanationId = useId();
  return (
    <section className="min-w-0 space-y-3" aria-label={data.title ? undefined : "Formula"} aria-labelledby={data.title ? titleId : undefined}>
      {data.title && <h3 id={titleId} className="text-lg font-semibold leading-snug text-slate-900">{data.title}</h3>}
      <div className="overflow-x-auto rounded-xl bg-slate-50 px-4 py-5 text-center text-slate-900 sm:px-6 [&_.katex-display]:my-0 [&_.katex-display]:min-w-max">
        {equation.error ? (
          <code className="whitespace-pre-wrap break-words text-sm">{data.latex}</code>
        ) : (
          <div role="math" aria-describedby={data.explanation ? explanationId : undefined} dangerouslySetInnerHTML={{ __html: equation.html }} />
        )}
      </div>
      {equation.error && <p role="status" className="text-sm text-amber-800">This equation could not be rendered. The original notation is shown above.</p>}
      {data.explanation && <p id={explanationId} className="text-sm leading-6 text-slate-700">{data.explanation}</p>}
      {!!data.variables.length && (
        <dl className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          {data.variables.map((variable, index) => (
            <div key={`${variable.symbol}-${index}`} className="contents">
              <dt className="min-w-0 break-words rounded-lg bg-indigo-50 px-3 py-2 font-mono text-sm font-semibold text-indigo-800">{variable.symbol}</dt>
              <dd className="min-w-0 break-words rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">{variable.explanation}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
