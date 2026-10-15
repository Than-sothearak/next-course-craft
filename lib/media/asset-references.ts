const assetUrlPattern = /\/api\/assets\/([\da-f]{24})\/file\b/gi;

export function courseAssetIds(value: unknown): Set<string> {
  return new Set([...(JSON.stringify(value) ?? "").matchAll(assetUrlPattern)].map((match) => match[1].toLowerCase()));
}

/** Remap URLs in JSON content, including nested blocks, quiz images, and rich text. */
export function remapCourseAssetUrls<T>(value: T, sources: ReadonlyMap<string, string>): T {
  if (typeof value === "string") {
    return value.replace(assetUrlPattern, (match, assetId: string) => sources.get(assetId.toLowerCase()) ?? match) as T;
  }
  if (Array.isArray(value)) return value.map((item) => remapCourseAssetUrls(item, sources)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapCourseAssetUrls(item, sources)])) as T;
  }
  return value;
}
