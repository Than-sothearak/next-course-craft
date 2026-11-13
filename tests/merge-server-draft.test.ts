import { describe, expect, it } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { mergeServerDraft } from "@/lib/editor/merge-server-draft";
const base = editorSnapshotSchema.parse({ title: "Course", description: "", revision: 0, sections: [{ id: "learn", title: "Learn", order: 0 }], lessons: [
  { id: "complete", title: "Completed lesson", sectionId: "learn", order: 0, blocks: [] },
  { id: "pending", title: "Pending lesson", sectionId: "learn", order: 1, blocks: [] },
] });
describe("live generation merges", () => {
  it("adds a saved lesson without losing simultaneous edits to completed content", () => {
    const local = structuredClone(base); local.lessons[0].title = "Author correction"; local.description = "Author description";
    const server = structuredClone(base); server.lessons[1].blocks = [blockSchema.parse({ id: "generated", version: 1, type: "richText", data: { html: "<p>Saved teaching content</p>" } })];
    const merged = mergeServerDraft(base, local, server);
    expect(merged.lessons[0].title).toBe("Author correction"); expect(merged.description).toBe("Author description");
    expect(merged.lessons[1].blocks).toEqual(server.lessons[1].blocks);
  });
  it("preserves a local deletion and accepts new approved server lessons", () => {
    const local = { ...base, lessons: base.lessons.slice(1) };
    const server = { ...base, lessons: [...base.lessons, { ...base.lessons[1], id: "new-lesson", order: 2 }] };
    expect(mergeServerDraft(base, local, server).lessons.map((lesson) => lesson.id)).toEqual(["pending", "new-lesson"]);
  });
});
