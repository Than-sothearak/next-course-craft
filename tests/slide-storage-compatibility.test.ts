import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Slide } from "../models/Slide";
import { slideSnapshotSchema } from "../lib/slides/schema";
import { serializeStoredSlide } from "../lib/slides/service";
import { createTemplateSlide } from "../lib/slides/templates";

function canvasSnapshot() {
  return slideSnapshotSchema.parse({ title: "Saved canvas", order: 0, revision: 0, objects: [
    { id: "heading", type: "text", content: "Keep this heading", x: 80, y: 40, width: 600, height: 100 },
    { id: "button", type: "button", content: "Continue", x: 80, y: 180, width: 200, height: 60, actions: [{ type: "nextSlide" }] },
    { id: "shape", type: "shape", content: "ellipse", x: 400, y: 180, width: 100, height: 100 },
    { id: "video", type: "video", content: "https://example.com/lesson.mp4", x: 80, y: 300, width: 500, height: 300 },
    { id: "image", type: "image", content: "https://example.com/diagram.png", alt: "A learning diagram", x: 700, y: 300, width: 500, height: 300 },
  ] });
}
function stored(snapshot = canvasSnapshot()) {
  return new Slide({ ...snapshot, courseId: new Types.ObjectId(), slideId: "stored-slide" }).toObject();
}
describe("Mongoose slide serialization compatibility", () => {
  it("round-trips every canvas object type through the actual Mongoose model", () => {
    const snapshot = canvasSnapshot();
    expect(serializeStoredSlide(stored(snapshot))).toEqual({ ...snapshot, id: "stored-slide" });
  });
  it("does not add image-only metadata to newly stored text, button, shape, or video objects", () => {
    const document = stored();
    for (const object of document.objects) {
      if (object.type === "image") expect(object.alt).toBe("A learning diagram");
      else expect(object).not.toHaveProperty("alt");
    }
  });
  it("reads legacy empty alt defaults without mutating stored content", () => {
    const document = { ...stored(), objects: canvasSnapshot().objects.map((object) => object.type === "image" ? object : { ...object, alt: "" }) };
    const before = JSON.stringify(document);
    const result = serializeStoredSlide(document);
    expect(result.objects).toEqual(canvasSnapshot().objects);
    expect(JSON.stringify(document)).toBe(before);
  });
  it("continues rejecting unknown fields instead of dropping arbitrary stored content", () => {
    const document = stored(), text = canvasSnapshot().objects[0];
    expect(() => serializeStoredSlide({ ...document, objects: [{ ...text, onClick: "alert(1)" }] })).toThrow();
    expect(() => serializeStoredSlide({ ...document, objects: [{ ...text, alt: "unexpected nonempty metadata" }] })).toThrow();
    expect(slideSnapshotSchema.safeParse({ ...canvasSnapshot(), objects: [{ ...text, alt: "" }] }).success).toBe(false);
  });
  it("round-trips version 2 templates without changing their content or layout", () => {
    const snapshot = createTemplateSlide("image-text", 0);
    expect(serializeStoredSlide(stored(snapshot))).toEqual({ ...snapshot, id: "stored-slide" });
  });
});
