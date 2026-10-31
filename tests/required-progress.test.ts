import { describe, expect, it } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { getInitiallyViewedInteractionIds, getInteractiveBlockProgressIds, getPendingFlipCardIds, getPendingInteractiveProgressIds, getPendingRequiredContinueDividerIds, getRestrictedLessonProgress } from "@/lib/export/progress";

const fixtures = [
  { type: "flipCard", data: { cards: [{ id: "card", frontLabel: "Question", backLabel: "Answer", front: { type: "text", text: "Front" }, back: { type: "text", text: "Back" } }] } },
  { type: "accordion", data: { items: [{ id: "one", title: "One", body: "First" }, { id: "two", title: "Two", body: "Second" }] } },
  { type: "labeledGraphic", data: { src: "/diagram.png", alt: "Diagram", markers: [{ id: "point", label: "Point", description: "Detail", x: 25, y: 50 }] } },
  { type: "processSteps", data: { steps: [{ id: "one", title: "One", body: "First" }, { id: "two", title: "Two", body: "Second" }] } },
  { type: "knowledgeCheck", data: { question: "Ready?", options: ["Yes", "No"] } },
  { type: "survey", data: { question: "How was it?", minLabel: "Low", maxLabel: "High" } },
  { type: "audio", data: { src: "/api/assets/123456789012345678901234/file" } },
  { type: "video", data: { src: "/clip.webm", mimeType: "video/webm" } },
];

describe("optional progress activities", () => {
  it.each(fixtures)("excludes optional $type activities from gates while retaining their interaction IDs", (fixture) => {
    const required = blockSchema.parse({ ...fixture, id: "activity", version: 1 });
    const optional = { ...required, requiredForProgress: false };
    const ids = getInteractiveBlockProgressIds(required);
    expect(ids.length).toBeGreaterThan(0);
    expect(getPendingInteractiveProgressIds([required], new Set())).toEqual(ids);
    expect(getPendingInteractiveProgressIds([{ ...required, requiredForProgress: true }], new Set())).toEqual(ids);
    expect(getPendingInteractiveProgressIds([optional], new Set())).toEqual([]);
    expect(getInteractiveBlockProgressIds(optional)).toEqual(ids);
    expect(getInitiallyViewedInteractionIds([optional])).toEqual(getInitiallyViewedInteractionIds([required]));
    expect(getRestrictedLessonProgress(100, [optional], new Set())).toBe(100);
  });

  it("counts required activities alone in mixed slides and Continue requirements", () => {
    const required = blockSchema.parse({ ...fixtures[4], id: "required", version: 1 });
    const optional = blockSchema.parse({ ...fixtures[0], id: "optional", version: 1, requiredForProgress: false });
    const divider = blockSchema.parse({ id: "continue", version: 1, type: "divider", data: { style: "continue", completionType: "completeAbove" } });
    expect(getRestrictedLessonProgress(100, [required, optional], new Set())).toBe(50);
    expect(getRestrictedLessonProgress(100, [required, optional], new Set(["required:answer"]))).toBe(100);
    expect(getPendingFlipCardIds([optional], new Set())).toEqual([]);
    expect(getPendingRequiredContinueDividerIds([optional, divider], new Set([divider.id]), new Set([divider.id]), new Set())).toEqual([]);
    expect(getPendingRequiredContinueDividerIds([divider], new Set(), new Set(), new Set())).toEqual([divider.id]);
    expect(getPendingRequiredContinueDividerIds([{ ...divider, requiredForProgress: false }], new Set(), new Set(), new Set())).toEqual([]);
  });

  it("validates and exports the boolean without adding new tasks to static blocks", () => {
    const block = blockSchema.parse({ id: "heading", version: 1, type: "heading", requiredForProgress: true, data: { text: "Read the slide", level: 1 } });
    expect(getPendingInteractiveProgressIds([block], new Set())).toEqual([]);
    expect(blockSchema.safeParse({ ...block, requiredForProgress: "false" }).success).toBe(false);
    const snapshot = editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", navigationMode: "restricted", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Slide", order: 0, blocks: [{ ...block, requiredForProgress: false }] }] });
    expect(parseScorm12Snapshot(JSON.parse(JSON.stringify(snapshot))).lessons[0].blocks[0].requiredForProgress).toBe(false);
  });
});
