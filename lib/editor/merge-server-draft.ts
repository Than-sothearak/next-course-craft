import type { EditorSnapshotInput } from "./schemas";
type Draft = Omit<EditorSnapshotInput, "revision">;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Merge only server changes made since the request started. Local edits made
// while the save was in flight take precedence, including deletion and ordering.
function mergeItems<T extends { id: string }>(base: T[], local: T[], server: T[]): T[] {
  if (same(base, local)) return server;
  const merged = local.map((item) => {
    const before = base.find((candidate) => candidate.id === item.id);
    const saved = server.find((candidate) => candidate.id === item.id);
    if (!before || !saved) return item;
    const next = { ...saved };
    for (const key of new Set([...Object.keys(before), ...Object.keys(item)]) as Set<keyof T>) {
      if (!same(item[key], before[key])) next[key] = item[key];
    }
    return next;
  });
  return [...merged, ...server.filter((item) => !base.some((candidate) => candidate.id === item.id) && !local.some((candidate) => candidate.id === item.id))];
}
export function mergeServerDraft(base: Draft, local: Draft, server: Draft): Draft {
  const merged = { ...server };
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)]) as Set<keyof Draft>) {
    if (key !== "lessons" && key !== "sections" && !same(local[key], base[key])) Object.assign(merged, { [key]: local[key] });
  }
  merged.lessons = mergeItems(base.lessons, local.lessons, server.lessons);
  merged.sections = mergeItems(base.sections, local.sections, server.sections);
  return merged;
}
