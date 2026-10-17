import { describe, expect, it } from "vitest";
import { slideSnapshotSchema } from "../lib/slides/schema";

const textObject = {
  id: "headline",
  type: "text",
  x: 80,
  y: 80,
  width: 500,
  height: 100,
  content: "Welcome",
};

describe("slide snapshot validation", () => {
  it("fills fixed canvas defaults and validates editable text objects", () => {
    const slide = slideSnapshotSchema.parse({ title: "Opening", order: 0, objects: [textObject], revision: 0 });
    expect(slide).toMatchObject({ width: 1280, height: 720, background: { color: "#ffffff" }, schemaVersion: 1 });
    expect(slide.objects[0]).toMatchObject({ visible: true, rotation: 0, style: { fontSize: 32, color: "#172033" } });
  });

  it("rejects objects outside the canvas, duplicate IDs, and unsupported fields", () => {
    expect(slideSnapshotSchema.safeParse({ title: "Out of bounds", order: 0, objects: [{ ...textObject, x: 1200 }], revision: 0 }).success).toBe(false);
    expect(slideSnapshotSchema.safeParse({ title: "Duplicate", order: 0, objects: [textObject, textObject], revision: 0 }).success).toBe(false);
    expect(slideSnapshotSchema.safeParse({ title: "Script", order: 0, objects: [{ ...textObject, onClick: "javascript:alert(1)" }], revision: 0 }).success).toBe(false);
    expect(slideSnapshotSchema.safeParse({ title: "Unsafe link", order: 0, objects: [{ ...textObject, actions: [{ type: "openUrl", url: "javascript:alert(1)" }] }], revision: 0 }).success).toBe(false);
    expect(slideSnapshotSchema.safeParse({ title: "Missing target", order: 0, objects: [{ ...textObject, actions: [{ type: "hideObject", targetObjectId: "missing" }] }], revision: 0 }).success).toBe(false);
  });
});
