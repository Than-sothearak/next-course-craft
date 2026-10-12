import { describe, expect, it } from "vitest";
import { editorSnapshotSchema } from "../lib/editor/schemas";
import { transactionUnsupported } from "../lib/editor/service";

const validSnapshot = {
  title: "Onboarding",
  description: "A welcome course",
  revision: 2,
  sections: [{ id: "section-a", title: "Welcome", order: 0 }],
  lessons: [{
    id: "lesson-a",
    sectionId: "section-a",
    title: "First day",
    order: 0,
    blocks: [{ id: "block-a", version: 1, type: "richText", data: { html: "<p>Hello</p>" } }],
  }],
};

describe("course editor snapshot", () => {
  it("accepts a versioned course, lesson, and block snapshot", () => {
    expect(editorSnapshotSchema.parse(validSnapshot)).toMatchObject({ title: "Onboarding", revision: 2 });
  });

  it("requires every lesson to reference a section", () => {
    const invalid = structuredClone(validSnapshot);
    invalid.lessons[0].sectionId = "missing-section";
    expect(editorSnapshotSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate lesson identifiers", () => {
    const invalid = structuredClone(validSnapshot);
    invalid.lessons.push({ ...invalid.lessons[0], sectionId: "section-a" });
    expect(editorSnapshotSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate lesson positions within a section", () => {
    const invalid = structuredClone(validSnapshot);
    invalid.lessons.push({ ...invalid.lessons[0], id: "lesson-b" });
    expect(editorSnapshotSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("MongoDB transaction fallback detection", () => {
  it("detects standalone MongoDB transaction errors", () => {
    expect(transactionUnsupported({ code: 20, message: "Transaction numbers are only allowed on a replica set member or mongos" })).toBe(true);
  });

  it("does not treat unrelated database errors as transaction support errors", () => {
    expect(transactionUnsupported({ code: 11000, message: "duplicate key" })).toBe(false);
  });
});
