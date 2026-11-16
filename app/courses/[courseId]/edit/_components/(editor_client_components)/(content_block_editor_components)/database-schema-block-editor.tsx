"use client";

import { Plus, Trash2 } from "lucide-react";
import { DatabaseSchema } from "@/components/database-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClientId } from "@/lib/client-id";
import type { ContentBlock } from "@/lib/schemas/block";

type SchemaBlock = Extract<ContentBlock, { type: "databaseSchema" }>;
type Entity = SchemaBlock["data"]["entities"][number];
type Field = Entity["fields"][number];
type Relationship = SchemaBlock["data"]["relationships"][number];

function newField(): Field {
  return { id: createClientId(), name: "id", type: "uuid", nullable: false, keyType: "primary" };
}

export function DatabaseSchemaBlockEditor({ block, onChange }: {
  block: SchemaBlock;
  onChange: (block: ContentBlock) => void;
}) {
  const update = (data: Partial<SchemaBlock["data"]>) => onChange({ ...block, data: { ...block.data, ...data } });
  const referencedFields = new Set(block.data.relationships.flatMap((relationship) => [
    `${relationship.fromEntityId}:${relationship.fromFieldId}`,
    `${relationship.toEntityId}:${relationship.toFieldId}`,
  ]));
  const entitiesById = new Map(block.data.entities.map((entity) => [entity.id, entity]));

  const updateEntity = (entityId: string, patch: Partial<Entity>) => update({
    entities: block.data.entities.map((entity) => entity.id === entityId ? { ...entity, ...patch } : entity),
  });

  const updateField = (entityId: string, fieldId: string, patch: Partial<Field>) => update({
    entities: block.data.entities.map((entity) => entity.id === entityId
      ? { ...entity, fields: entity.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) }
      : entity),
  });

  const updateRelationship = (relationshipId: string, patch: Partial<Relationship>) => {
    const current = block.data.relationships.find((relationship) => relationship.id === relationshipId);
    if (!current) return;
    const next = { ...current, ...patch };
    if (patch.fromEntityId) next.fromFieldId = entitiesById.get(patch.fromEntityId)?.fields[0]?.id ?? "";
    if (patch.toEntityId) next.toFieldId = entitiesById.get(patch.toEntityId)?.fields[0]?.id ?? "";
    update({ relationships: block.data.relationships.map((relationship) => relationship.id === relationshipId ? next : relationship) });
  };

  const removeEntity = (entityId: string) => update({
    entities: block.data.entities.filter((entity) => entity.id !== entityId),
    relationships: block.data.relationships.filter((relationship) => relationship.fromEntityId !== entityId && relationship.toEntityId !== entityId),
  });

  const addEntity = () => update({ entities: [...block.data.entities, {
    id: createClientId(), name: `Entity ${block.data.entities.length + 1}`, description: "", fields: [newField()],
  }] });

  const addRelationship = () => {
    const [from, to] = block.data.entities;
    if (!from || !to) return;
    const fromField = from.fields[0], toField = to.fields[0];
    if (!fromField || !toField) return;
    update({ relationships: [...block.data.relationships, {
      id: createClientId(), fromEntityId: from.id, fromFieldId: fromField.id,
      toEntityId: to.id, toFieldId: toField.id, label: "references", cardinality: "many-to-one",
    }] });
  };

  return <div className="space-y-4">
    <label className="block space-y-1.5 text-sm font-medium">Diagram title
      <Input aria-label="Database schema title" value={block.data.title} maxLength={160} onChange={(event) => update({ title: event.target.value })} placeholder="Optional title" />
    </label>
    <label className="block space-y-1.5 text-sm font-medium">Description
      <Textarea aria-label="Database schema description" value={block.data.description} maxLength={1_000} rows={3} onChange={(event) => update({ description: event.target.value })} placeholder="Explain what this schema models" />
    </label>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h4 className="text-sm font-semibold">Entities</h4><p className="mt-0.5 text-xs text-slate-500">Tables, their fields, and key roles.</p></div>
      <Button type="button" variant="outline" size="sm" disabled={block.data.entities.length >= 8} onClick={addEntity}><Plus size={14} /> Add entity</Button>
    </div>

    <div className="space-y-3">
      {block.data.entities.map((entity, entityIndex) => (
        <section key={entity.id} aria-label={`Database entity ${entityIndex + 1}`} className="min-w-0 rounded-lg border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Input aria-label={`Database entity ${entityIndex + 1} name`} value={entity.name} maxLength={100} onChange={(event) => updateEntity(entity.id, { name: event.target.value })} className="min-w-0 font-semibold" />
            <Button type="button" variant="ghost" size="icon" aria-label={`Delete database entity ${entityIndex + 1}`} title="Deleting an entity also removes its relationships" disabled={block.data.entities.length <= 2} onClick={() => removeEntity(entity.id)} className="size-9 shrink-0 text-slate-500 hover:text-rose-600"><Trash2 size={15} /></Button>
          </div>
          <Textarea aria-label={`Database entity ${entityIndex + 1} description`} value={entity.description} maxLength={500} rows={2} onChange={(event) => updateEntity(entity.id, { description: event.target.value })} placeholder="Optional purpose of this entity" className="mt-2" />

          <div className="mt-3 flex items-center justify-between gap-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fields</h5>
            <Button type="button" variant="ghost" size="sm" disabled={entity.fields.length >= 20} onClick={() => updateEntity(entity.id, { fields: [...entity.fields, { id: createClientId(), name: "new_field", type: "text", nullable: false }] })}><Plus size={13} /> Add field</Button>
          </div>
          <div className="space-y-2">
            {entity.fields.map((field, fieldIndex) => {
              const fieldIsReferenced = referencedFields.has(`${entity.id}:${field.id}`);
              return <div key={field.id} className="grid min-w-0 grid-cols-1 gap-2 rounded-md bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(7rem,0.8fr)_auto] sm:items-center">
                <Input aria-label={`Entity ${entityIndex + 1} field ${fieldIndex + 1} name`} value={field.name} maxLength={100} onChange={(event) => updateField(entity.id, field.id, { name: event.target.value })} placeholder="Field name" />
                <Input aria-label={`Entity ${entityIndex + 1} field ${fieldIndex + 1} type`} value={field.type} maxLength={80} onChange={(event) => updateField(entity.id, field.id, { type: event.target.value })} placeholder="Data type" />
                <Select aria-label={`Entity ${entityIndex + 1} field ${fieldIndex + 1} key role`} value={field.keyType ?? "none"} onChange={(event) => updateField(entity.id, field.id, { keyType: event.target.value === "none" ? undefined : event.target.value as Field["keyType"] })}>
                  <option value="none">No key role</option><option value="primary">Primary key</option><option value="foreign">Foreign key</option><option value="unique">Unique</option>
                </Select>
                <Button type="button" variant="ghost" size="icon" aria-label={`Delete entity ${entityIndex + 1} field ${fieldIndex + 1}`} title={fieldIsReferenced ? "Remove its relationship before deleting this field" : "Delete field"} disabled={entity.fields.length <= 1 || fieldIsReferenced} onClick={() => updateEntity(entity.id, { fields: entity.fields.filter((item) => item.id !== field.id) })} className="size-9 justify-self-end text-slate-500 hover:text-rose-600"><Trash2 size={14} /></Button>
                <Select aria-label={`Entity ${entityIndex + 1} field ${fieldIndex + 1} nullability`} value={field.nullable ? "nullable" : "required"} onChange={(event) => updateField(entity.id, field.id, { nullable: event.target.value === "nullable" })} className="sm:col-span-3">
                  <option value="required">Required value</option><option value="nullable">May be empty</option>
                </Select>
              </div>;
            })}
          </div>
        </section>
      ))}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h4 className="text-sm font-semibold">Relationships</h4><p className="mt-0.5 text-xs text-slate-500">Connect exact fields and state the cardinality.</p></div>
      <Button type="button" variant="outline" size="sm" disabled={block.data.relationships.length >= 16} onClick={addRelationship}><Plus size={14} /> Add relationship</Button>
    </div>

    {block.data.relationships.length ? <div className="space-y-3">
      {block.data.relationships.map((relationship, index) => {
        const fromEntity = entitiesById.get(relationship.fromEntityId)!;
        const toEntity = entitiesById.get(relationship.toEntityId)!;
        return <section key={relationship.id} aria-label={`Database relationship ${index + 1}`} className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-semibold text-slate-600">Relationship {index + 1}</h5>
            <Button type="button" variant="ghost" size="icon" aria-label={`Delete database relationship ${index + 1}`} onClick={() => update({ relationships: block.data.relationships.filter((item) => item.id !== relationship.id) })} className="size-8 text-slate-500 hover:text-rose-600"><Trash2 size={14} /></Button>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">From entity
              <Select aria-label={`Relationship ${index + 1} source entity`} value={relationship.fromEntityId} onChange={(event) => updateRelationship(relationship.id, { fromEntityId: event.target.value })}>
                {block.data.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
              </Select>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">From field
              <Select aria-label={`Relationship ${index + 1} source field`} value={relationship.fromFieldId} onChange={(event) => updateRelationship(relationship.id, { fromFieldId: event.target.value })}>
                {fromEntity.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
              </Select>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">To entity
              <Select aria-label={`Relationship ${index + 1} target entity`} value={relationship.toEntityId} onChange={(event) => updateRelationship(relationship.id, { toEntityId: event.target.value })}>
                {block.data.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
              </Select>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">To field
              <Select aria-label={`Relationship ${index + 1} target field`} value={relationship.toFieldId} onChange={(event) => updateRelationship(relationship.id, { toFieldId: event.target.value })}>
                {toEntity.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
              </Select>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">Relationship label
              <Input aria-label={`Relationship ${index + 1} label`} value={relationship.label} maxLength={120} onChange={(event) => updateRelationship(relationship.id, { label: event.target.value })} placeholder="references, belongs to" />
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">Cardinality
              <Select aria-label={`Relationship ${index + 1} cardinality`} value={relationship.cardinality} onChange={(event) => updateRelationship(relationship.id, { cardinality: event.target.value as Relationship["cardinality"] })}>
                <option value="one-to-one">One to one</option><option value="one-to-many">One to many</option><option value="many-to-one">Many to one</option><option value="many-to-many">Many to many</option>
              </Select>
            </label>
          </div>
        </section>;
      })}
    </div> : <p className="rounded-md bg-slate-50 px-3 py-2.5 text-sm text-slate-500">Add a relationship to connect fields from different entities.</p>}

    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Learner preview</h4>
      <div className="rounded-lg border border-slate-200 p-3 sm:p-4"><DatabaseSchema data={block.data} /></div>
    </div>
  </div>;
}
