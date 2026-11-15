import { imageBlockSchema, labeledGraphicBlockSchema } from "@/lib/schemas/block";

// BSON converts explicit undefined object properties to null by default.
// Omit them before persisting the JSON payload so optional fields stay absent.
export function checkpointPayloadForStorage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(checkpointPayloadForStorage);
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => [key, checkpointPayloadForStorage(entry)]));
}

export function restoreGenerationImageFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restoreGenerationImageFields);
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  const entry = value as Record<string, unknown>;
  const result = Object.fromEntries(Object.entries(entry).map(([key, field]) => [key, restoreGenerationImageFields(field)]));
  const schema = entry.type === "image" ? imageBlockSchema
    : entry.type === "labeledGraphic" ? labeledGraphicBlockSchema : null;
  if (schema && result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    const data = result.data as Record<string, unknown>;
    for (const [key, field] of Object.entries(schema.shape.data.shape)) {
      if (data[key] === null && field.isOptional()) delete data[key];
    }
    if (entry.type === "labeledGraphic" && Array.isArray(data.markers)) {
      data.markers = data.markers.map((marker: unknown) => {
        if (!marker || typeof marker !== "object" || Array.isArray(marker)) return marker;
        const item = { ...marker } as Record<string, unknown>;
        if (item.color === null) delete item.color;
        return item;
      });
    }
  }
  return result;
}
