import { describe, expect, it } from "vitest";
import { blockSchema } from "../lib/schemas/block";
import { courseInputSchema } from "../lib/schemas/course";

describe("shared authoring schemas", () => {
  it("accepts a versioned heading block", () => {
    expect(blockSchema.parse({ id: "b1", version: 1, type: "heading", data: { text: "Welcome", level: 1 } }).type).toBe("heading");
  });

  it("rejects an unsupported block version", () => {
    expect(blockSchema.safeParse({ id: "b1", version: 2, type: "divider", data: { style: "line" } }).success).toBe(false);
  });

  it("keeps legacy dividers valid and adds defaults for continue controls", () => {
    expect(blockSchema.parse({ id: "b1", version: 1, type: "divider", data: { style: "line" } })).toMatchObject({
      data: { style: "line", label: "Continue", completionType: "none" },
    });
    expect(blockSchema.parse({ id: "b2", version: 1, type: "divider", data: { style: "continue" } })).toMatchObject({
      data: { style: "continue", label: "Continue", completionType: "none" },
    });
  });

  it("normalizes course defaults", () => {
    expect(courseInputSchema.parse({ title: "  Intro  " })).toMatchObject({ title: "Intro", status: "draft", language: "en" });
  });
});
