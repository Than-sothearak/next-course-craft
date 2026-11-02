export function createEmbeddedMediaTable(assets: Array<{ id: string; dataUri: string }>) {
  const media: Record<string, string> = {};
  const references = new Map<string, string>();
  for (const { id: rawId, dataUri } of assets) {
    const id = rawId.toLowerCase();
    media[id] = dataUri;
    references.set(id, `coursecraft-media:${id}`);
  }
  return { media, references };
}

export function replaceExportMediaReferences(value: unknown, references: Map<string, string>, pattern: RegExp): unknown {
  if (typeof value === "string") return value.replace(pattern, (match, id: string) => references.get(id.toLowerCase()) ?? match);
  if (Array.isArray(value)) return value.map((item) => replaceExportMediaReferences(item, references, pattern));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceExportMediaReferences(item, references, pattern)]));
  return value;
}
