import { z } from "zod";
import { DashboardError } from "@/lib/dashboard/rules";
import type { GeneratedSourceInventory } from "./course-generation-schemas";

const learnPartSchema = z.object({
  key: z.string().regex(/^0(?:\.[01])*$/).max(120),
  sourceElementIds: z.array(z.string().min(1).max(120)).min(1).max(50_000),
});
export const sourceLearnWorkSchema = z.object({
  version: z.literal(1),
  parts: z.array(learnPartSchema).min(1).max(50_000),
  completedPartKeys: z.array(z.string().max(120)).max(50_000).default([]),
});
export type SourceLearnWork = z.infer<typeof sourceLearnWorkSchema>;
type LearnPart = z.infer<typeof learnPartSchema>;
type SourcePages = GeneratedSourceInventory["pages"];

export function isLearnCapacityError(error: unknown) {
  return error instanceof DashboardError && (
    error.status === 504 || (error.status === 422 && error.message.includes("output limit"))
  );
}

export function learnPartPages(pages: SourcePages, part: LearnPart): SourcePages {
  const ids = new Set(part.sourceElementIds);
  return pages.map((page) => ({
    ...page,
    elements: page.elements.filter((element) => ids.has(element.sourceElementId)),
  })).filter((page) => page.elements.length > 0);
}

function splitLearnPart(pages: SourcePages, part: LearnPart): LearnPart[] | null {
  const assigned = learnPartPages(pages, part);
  const ids = part.sourceElementIds;
  if (ids.length < 2) return null;
  // Prefer intact pages. A dense single page can split between complete source
  // elements; a code listing is never cut, shortened, or rewritten here.
  const midpoint = assigned.length > 1
    ? assigned.slice(0, Math.ceil(assigned.length / 2)).reduce((total, page) => total + page.elements.length, 0)
    : Math.ceil(ids.length / 2);
  return [
    { key: `${part.key}.0`, sourceElementIds: ids.slice(0, midpoint) },
    { key: `${part.key}.1`, sourceElementIds: ids.slice(midpoint) },
  ];
}

export function createSourceLearnWork(pages: SourcePages, splitInitially = false): SourceLearnWork {
  const part = { key: "0", sourceElementIds: pages.flatMap((page) => page.elements.map((element) => element.sourceElementId)) };
  return sourceLearnWorkSchema.parse({
    version: 1,
    parts: (splitInitially && splitLearnPart(pages, part)) || [part],
  });
}

// Execute at most one unfinished part per route invocation. All results are
// saved before the next request, so a timeout cannot erase completed parts.
export async function advanceSourceLearnWork<T>({
  pages,
  savedWork,
  loadPart,
  savePart,
  saveWork,
  generatePart,
}: {
  pages: SourcePages;
  savedWork: unknown;
  loadPart: (key: string) => Promise<T | null>;
  savePart: (key: string, result: T) => Promise<void>;
  saveWork: (work: SourceLearnWork) => Promise<void>;
  generatePart: (pages: SourcePages, completedResults: T[]) => Promise<T>;
}): Promise<{ work: SourceLearnWork; results: T[] | null }> {
  const ids = pages.flatMap((page) => page.elements.map((element) => element.sourceElementId));
  const work = savedWork == null
    ? createSourceLearnWork(pages)
    : sourceLearnWorkSchema.parse(savedWork);
  const assigned = work.parts.flatMap((part) => part.sourceElementIds);
  if (assigned.length !== ids.length || assigned.some((id, index) => id !== ids[index])
    || new Set(work.parts.map((part) => part.key)).size !== work.parts.length)
    throw new DashboardError("The saved Learn work does not cover its assigned source in order. Retry this lesson.", 422);

  if (savedWork == null) await saveWork(work);
  const results: T[] = [];
  let generated = false;
  for (let index = 0; index < work.parts.length; index += 1) {
    const part = work.parts[index];
    let result = await loadPart(part.key);
    if (result === null) {
      if (generated) return { work, results: null };
      try {
        result = await generatePart(learnPartPages(pages, part), [...results]);
      } catch (error) {
        if (!isLearnCapacityError(error)) throw error;
        const smallerParts = splitLearnPart(pages, part);
        if (!smallerParts)
          throw new DashboardError(
            "A single source example could not finish within the generation limits. Earlier lesson parts are saved; retry this part to continue.",
            504,
          );
        const nextWork = {
          ...work,
          parts: [...work.parts.slice(0, index), ...smallerParts, ...work.parts.slice(index + 1)],
        };
        await saveWork(nextWork);
        return { work: nextWork, results: null };
      }
      await savePart(part.key, result);
      generated = true;
    }
    if (!work.completedPartKeys.includes(part.key)) {
      work.completedPartKeys.push(part.key);
      await saveWork(work);
    }
    results.push(result);
  }
  return { work, results };
}
