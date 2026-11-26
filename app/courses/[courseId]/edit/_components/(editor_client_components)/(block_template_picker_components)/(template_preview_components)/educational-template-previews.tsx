import "katex/dist/katex.min.css";
import { ArrowRight, KeyRound } from "lucide-react";
import { previewEquation } from "@/lib/editor/text-equation";
import { StatementBlockSurface } from "../../../statement-block-preview";
import type { BlockTemplate } from "../block-template-data";

const titleClass = "text-[11px] font-semibold leading-4 text-slate-800";
const accentClass = "text-[var(--course-primary,#2f5f9f)]";

export function StatementTemplatePreview({ data }: { data: NonNullable<BlockTemplate["statement"]> }) {
  return (
    <div data-template-statement-preview>
      <StatementBlockSurface style={data.style} className="gap-2 px-3 py-3 [&>svg]:mt-0.5 [&>svg]:size-3.5">
        <h3 className="text-[13px] font-semibold leading-[18px]">{data.title}</h3>
        <p className="mt-1 text-[11px] leading-4">{data.body}</p>
      </StatementBlockSurface>
    </div>
  );
}

export function ConceptMapTemplatePreview({ data }: { data: NonNullable<BlockTemplate["conceptMap"]> }) {
  return (
    <div data-template-concept-map-preview className="space-y-2">
      {data.title && <p className={titleClass}>{data.title}</p>}
      <div className="mx-auto w-3/4 rounded-lg border border-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_30%,#e2e8f0)] bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_7%,white)] px-2 py-2 text-center text-[11px] font-semibold leading-4 text-slate-800">
        {data.centralConcept}
      </div>
      <div className="relative grid grid-cols-2 gap-2 pt-4">
        <span aria-hidden="true" className="absolute left-1/2 top-0 h-2 w-px bg-slate-300" />
        <span aria-hidden="true" className="absolute left-1/4 right-1/4 top-2 h-2 border-x border-t border-slate-300" />
        {data.branches.slice(0, 2).map((branch) => (
          <div key={branch.id} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center">
            <p className={`truncate text-[9px] font-medium leading-3 ${accentClass}`}>{branch.relationship}</p>
            <p className="mt-1 text-[10px] font-semibold leading-3.5 text-slate-700">{branch.concept}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const cardinalityLabels = { "one-to-one": "1 : 1", "one-to-many": "1 : N", "many-to-one": "N : 1", "many-to-many": "N : N" } as const;

export function DatabaseSchemaTemplatePreview({ data }: { data: NonNullable<BlockTemplate["databaseSchema"]> }) {
  const relationship = data.relationships[0];
  const entities = relationship
    ? [relationship.fromEntityId, relationship.toEntityId].map((id) => data.entities.find((entity) => entity.id === id)!)
    : data.entities.slice(0, 2);
  return (
    <div data-template-database-schema-preview className="space-y-2">
      {data.title && <p className={titleClass}>{data.title}</p>}
      <div className="grid grid-cols-2 items-start gap-2">
        {entities.map((entity) => (
          <div key={entity.id} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <p className={`truncate border-b border-slate-200 bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_7%,white)] px-2 py-1.5 text-[10px] font-semibold ${accentClass}`}>{entity.name}</p>
            <div className="divide-y divide-slate-100 px-2">
              {entity.fields.slice(0, 3).map((field) => (
                <div key={field.id} className="flex min-w-0 items-center gap-1 py-1.5 text-[9px] leading-3 text-slate-600">
                  {field.keyType && <KeyRound aria-label={`${field.keyType} key`} className={`size-2.5 shrink-0 ${accentClass}`} />}
                  <span className="truncate font-mono">{field.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {relationship && <p className="flex items-center justify-center gap-2 text-[9px] leading-3 text-slate-500"><span>{relationship.label}</span><ArrowRight aria-hidden="true" className="size-3" /><span className={`font-semibold ${accentClass}`}>{cardinalityLabels[relationship.cardinality]}</span></p>}
    </div>
  );
}

export function FormulaTemplatePreview({ data }: { data: NonNullable<BlockTemplate["formula"]> }) {
  const equation = previewEquation(data.latex, true);
  return (
    <div data-template-formula-preview className="template-formula-thumbnail space-y-2">
      {data.title && <p className={titleClass}>{data.title}</p>}
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-[15px] text-slate-900">
        {equation.error ? <code className="break-words text-[11px]">{data.latex}</code> : <div role="math" dangerouslySetInnerHTML={{ __html: equation.html }} />}
      </div>
      {data.explanation && <p className="line-clamp-1 text-[10px] leading-3.5 text-slate-500">{data.explanation}</p>}
      <dl className="space-y-0.5">
        {data.variables.slice(0, 3).map((variable, index) => (
          <div key={`${variable.symbol}-${index}`} className="flex min-w-0 items-baseline gap-2 text-[10px] leading-3.5">
            <dt className={`min-w-4 shrink-0 font-mono font-semibold ${accentClass}`}>{variable.symbol}</dt>
            <dd className="truncate text-slate-600">{variable.explanation}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function TableTemplatePreview({ data }: { data: NonNullable<BlockTemplate["table"]> }) {
  return (
    <div data-template-table-preview className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full table-fixed border-collapse text-left text-[10px] leading-4">
        <caption className={data.caption ? "px-2 py-1.5 text-left font-semibold text-slate-700" : "sr-only"}>{data.caption || `Table comparing ${data.columns.join(", ")}`}</caption>
        <thead className="bg-slate-100/80 text-slate-700">
          <tr>{data.columns.map((column, index) => <th key={index} scope="col" className="break-words border-b border-slate-200 px-2 py-2 font-semibold">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-600">
          {data.rows.slice(0, 3).map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="break-words px-2 py-2 align-top">{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
