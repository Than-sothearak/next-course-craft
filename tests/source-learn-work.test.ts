import { describe, expect, it, vi } from "vitest";
import { DashboardError } from "../lib/dashboard/rules";
import type { GeneratedSourceInventory } from "../lib/ai/course-generation-schemas";
import { advanceSourceLearnWork, createSourceLearnWork, type SourceLearnWork } from "../lib/ai/source-learn-work";

function pages(count = 2): GeneratedSourceInventory["pages"] {
  return Array.from({ length: count }, (_, index) => ({
    pageNumber: index + 1,
    elements: [{
      sourceElementId: `p${index + 1}-e1`, kind: "text", content: `Original explanation ${index + 1}.`,
      visualKind: "other", visibleText: "", uncertainContent: false,
    }],
  }));
}

function workStore() {
  let savedWork: SourceLearnWork | null = null;
  const savedParts = new Map<string, string[]>();
  return {
    get savedWork() { return savedWork; },
    savedParts,
    loadPart: vi.fn(async (key: string) => savedParts.get(key) ?? null),
    savePart: vi.fn(async (key: string, result: string[]) => { savedParts.set(key, result); }),
    saveWork: vi.fn(async (work: SourceLearnWork) => { savedWork = structuredClone(work); }),
  };
}

describe("resumable Learn parts", () => {
  it("splits a timeout and saves one smaller part per request without losing the lesson's source", async () => {
    const store = workStore();
    const source = pages(4);
    const generatePart = vi.fn()
      .mockRejectedValueOnce(new DashboardError("Course generation took too long.", 504))
      .mockImplementation(async (assigned: GeneratedSourceInventory["pages"]) => assigned.flatMap((page) => page.elements.map((element) => element.sourceElementId)));
    const run = () => advanceSourceLearnWork({ ...store, savedWork: store.savedWork, pages: source, generatePart });

    expect((await run()).results).toBeNull();
    expect(store.savedWork?.parts.map((part) => part.sourceElementIds)).toEqual([["p1-e1", "p2-e1"], ["p3-e1", "p4-e1"]]);
    expect(store.savePart).not.toHaveBeenCalled();
    expect((await run()).results).toBeNull();
    expect(store.savedWork?.completedPartKeys).toEqual(["0.0"]);
    expect(store.savedParts.size).toBe(1);
    expect((await run()).results).toEqual([["p1-e1", "p2-e1"], ["p3-e1", "p4-e1"]]);
    expect(generatePart).toHaveBeenCalledTimes(3);
    expect(generatePart.mock.calls[2][1]).toEqual([["p1-e1", "p2-e1"]]);
  });

  it("splits a dense single page between whole elements and keeps code verbatim", async () => {
    const store = workStore();
    const source = pages(1);
    const originalCode = '<div class="card">Hello</div>\n.card { display: flex; }';
    source[0].elements.push({ ...source[0].elements[0], sourceElementId: "p1-e2", kind: "code", content: originalCode });
    await advanceSourceLearnWork({
      ...store, savedWork: null, pages: source,
      generatePart: async () => { throw new DashboardError("The AI response reached this generation stage's output limit.", 422); },
    });
    const generatePart = vi.fn(async (assigned: GeneratedSourceInventory["pages"]) => assigned.flatMap((page) => page.elements.map((element) => element.content)));
    await advanceSourceLearnWork({ ...store, savedWork: store.savedWork, pages: source, generatePart });
    const done = await advanceSourceLearnWork({ ...store, savedWork: store.savedWork, pages: source, generatePart });
    expect(done.results).toEqual([["Original explanation 1."], [originalCode]]);
  });

  it("does not repeat a part saved before the previous response was lost", async () => {
    const store = workStore();
    store.savedParts.set("0", ["saved"]);
    const generatePart = vi.fn();
    const result = await advanceSourceLearnWork({ ...store, savedWork: null, pages: pages(1), generatePart });
    expect(result.results).toEqual([["saved"]]);
    expect(generatePart).not.toHaveBeenCalled();
  });

  it("can split again while keeping earlier saved parts and source order", async () => {
    const store = workStore();
    const source = pages(4);
    const generatePart = vi.fn(async (assigned: GeneratedSourceInventory["pages"]) => {
      if (assigned.length > 1) throw new DashboardError("Timeout", 504);
      return [assigned[0].elements[0].sourceElementId];
    });
    let results: string[][] | null = null;
    for (let step = 0; step < 7; step += 1) {
      results = (await advanceSourceLearnWork({ ...store, savedWork: store.savedWork, pages: source, generatePart })).results;
    }
    expect(results).toEqual([["p1-e1"], ["p2-e1"], ["p3-e1"], ["p4-e1"]]);
    expect(store.savePart).toHaveBeenCalledTimes(4);
    expect(generatePart).toHaveBeenCalledTimes(7);
    expect(store.savedWork?.completedPartKeys).toHaveLength(4);
  });

  it("keeps completed parts when a later indivisible example times out", async () => {
    const store = workStore();
    const source = pages(2);
    const savedWork = createSourceLearnWork(source, true);
    store.savedParts.set("0.0", ["saved first part"]);
    await expect(advanceSourceLearnWork({
      ...store, savedWork, pages: source,
      generatePart: async () => { throw new DashboardError("Timeout", 504); },
    })).rejects.toThrow("Earlier lesson parts are saved");
    expect(store.savedParts.get("0.0")).toEqual(["saved first part"]);
  });

  it("does not split billing or authentication failures", async () => {
    const store = workStore();
    await expect(advanceSourceLearnWork({
      ...store, savedWork: null, pages: pages(2),
      generatePart: async () => { throw new DashboardError("Billing limit", 503); },
    })).rejects.toThrow("Billing limit");
    expect(store.saveWork).toHaveBeenCalledTimes(1);
    expect(store.savedWork?.parts).toHaveLength(1);
  });

  it("rejects saved partitions with missing or reordered source IDs", async () => {
    const store = workStore();
    const generatePart = vi.fn();
    await expect(advanceSourceLearnWork({
      ...store, pages: pages(2), generatePart,
      savedWork: { version: 1, parts: [{ key: "0", sourceElementIds: ["p2-e1", "p1-e1"] }] },
    })).rejects.toThrow("does not cover its assigned source in order");
    expect(generatePart).not.toHaveBeenCalled();
  });
});
