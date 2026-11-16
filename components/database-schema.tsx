import { useId } from "react";
import type { ContentBlock } from "@/lib/schemas/block";

type DatabaseSchemaData = Extract<ContentBlock, { type: "databaseSchema" }>["data"];

const keyLabels = {
  primary: "Primary key",
  foreign: "Foreign key",
  unique: "Unique",
} as const;

const cardinalityLabels = {
  "one-to-one": "one to one",
  "one-to-many": "one to many",
  "many-to-one": "many to one",
  "many-to-many": "many to many",
} as const;

export function DatabaseSchema({ data }: { data: DatabaseSchemaData }) {
  const id = useId();
  const titleId = `${id}-title`;
  const entitiesById = new Map(data.entities.map((entity) => [entity.id, entity]));

  return (
    <section
      aria-label={data.title ? undefined : "Database schema"}
      aria-labelledby={data.title ? titleId : undefined}
      className="@container/database-schema min-w-0 space-y-5"
      data-database-schema="true"
    >
      {data.title && <h3 id={titleId} className="text-lg font-semibold leading-snug text-slate-900">{data.title}</h3>}
      {data.description && <p className="max-w-prose break-words text-sm leading-6 text-slate-700">{data.description}</p>}

      <div role="group" aria-label="Database entities">
        <div className="grid min-w-0 grid-cols-1 gap-3 @min-[40rem]/database-schema:grid-cols-2 @min-[64rem]/database-schema:grid-cols-3">
          {data.entities.map((entity, index) => (
            <article key={entity.id} aria-labelledby={`${titleId}-entity-${index}`} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="border-b border-slate-200 bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_7%,white)] px-3.5 py-3 sm:px-4">
                <h4 id={`${titleId}-entity-${index}`} className="break-words text-base font-semibold leading-6 text-slate-900">{entity.name}</h4>
                {entity.description && <p className="mt-1 break-words text-sm leading-5 text-slate-600">{entity.description}</p>}
              </header>
              <dl aria-label={`${entity.name} fields`} className="divide-y divide-slate-100 px-3.5 sm:px-4">
                {entity.fields.map((field) => (
                  <div key={field.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 py-2.5 first:pt-3 last:pb-3">
                    <dt className="min-w-0 break-words text-sm font-medium text-slate-800">
                      {field.name}
                      {field.keyType && <span className="ms-1.5 inline-block rounded-full bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_10%,white)] px-2 py-0.5 align-middle text-[10px] font-semibold leading-4 text-[var(--course-primary,#2f5f9f)]">{keyLabels[field.keyType]}</span>}
                    </dt>
                    <dd className="max-w-36 break-words text-right font-mono text-xs leading-5 text-slate-600">{field.type}</dd>
                    {field.nullable && <dd className="col-span-2 text-xs text-slate-500">May be empty</dd>}
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </div>

      <section aria-label="Database relationships" className="min-w-0 space-y-2.5">
        <h4 className="text-sm font-semibold text-slate-800">Relationships</h4>
        {data.relationships.length ? <ul className="space-y-2">
          {data.relationships.map((relationship) => {
            const fromEntity = entitiesById.get(relationship.fromEntityId)!;
            const toEntity = entitiesById.get(relationship.toEntityId)!;
            const fromField = fromEntity.fields.find((field) => field.id === relationship.fromFieldId)!;
            const toField = toEntity.fields.find((field) => field.id === relationship.toFieldId)!;
            return <li key={relationship.id} className="min-w-0 rounded-lg border border-slate-200 px-3.5 py-3 sm:px-4">
              <div className="grid min-w-0 grid-cols-1 items-center gap-2 @min-[40rem]/database-schema:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <span className="min-w-0 break-words text-sm font-medium text-slate-800">{fromEntity.name}.<span className="font-mono text-xs">{fromField.name}</span></span>
                <span aria-hidden="true" className="text-center text-[var(--course-primary,#2f5f9f)]">→</span>
                <span className="min-w-0 break-words text-sm font-medium text-slate-800">{toEntity.name}.<span className="font-mono text-xs">{toField.name}</span></span>
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
                <span className="font-medium text-[var(--course-primary,#2f5f9f)]">{relationship.label}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-600">{cardinalityLabels[relationship.cardinality]}</span>
              </div>
            </li>;
          })}
        </ul> : <p className="text-sm text-slate-500">No relationships defined.</p>}
      </section>
    </section>
  );
}
