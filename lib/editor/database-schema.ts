import type { ContentBlock } from "@/lib/schemas/block";

type DatabaseSchemaData = Extract<ContentBlock, { type: "databaseSchema" }>["data"];

function lookupId(ids: ReadonlyMap<string, string>, sourceId: string, kind: string) {
  const id = ids.get(sourceId);
  if (!id) throw new Error(`Cannot duplicate database schema: missing ${kind} ID "${sourceId}".`);
  return id;
}

export function remapDatabaseSchemaIds(data: DatabaseSchemaData, createId: () => string): DatabaseSchemaData {
  const entityIds = new Map(data.entities.map((entity) => [entity.id, createId()]));
  const fieldIds = new Map(data.entities.flatMap((entity) => entity.fields.map((field) => [`${entity.id}:${field.id}`, createId()] as const)));

  return {
    ...structuredClone(data),
    entities: data.entities.map((entity) => ({
      ...structuredClone(entity),
      id: lookupId(entityIds, entity.id, "entity"),
      fields: entity.fields.map((field) => ({
        ...field,
        id: lookupId(fieldIds, `${entity.id}:${field.id}`, "field"),
      })),
    })),
    relationships: data.relationships.map((relationship) => ({
      ...relationship,
      id: createId(),
      fromEntityId: lookupId(entityIds, relationship.fromEntityId, "source entity"),
      fromFieldId: lookupId(fieldIds, `${relationship.fromEntityId}:${relationship.fromFieldId}`, "source field"),
      toEntityId: lookupId(entityIds, relationship.toEntityId, "target entity"),
      toFieldId: lookupId(fieldIds, `${relationship.toEntityId}:${relationship.toFieldId}`, "target field"),
    })),
  };
}
