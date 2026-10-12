import { describe, expect, it } from "vitest";
import { createCourseSchema, createFolderSchema, updateCourseSchema } from "../lib/dashboard/schemas";
import { assertNoFolderCycle, escapeRegex, normalizeFolderName } from "../lib/dashboard/rules";

describe("dashboard input validation", () => {
  it("trims folder names and defaults new folders to the root", () => {
    expect(createFolderSchema.parse({ name: "  Sales  " })).toEqual({ name: "Sales", parentId: null });
  });

  it("rejects blank names and malformed folder references", () => {
    expect(createFolderSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(createFolderSchema.safeParse({ name: "Training", parentId: "not-an-object-id" }).success).toBe(false);
  });

  it("accepts only explicit editable course fields", () => {
    expect(updateCourseSchema.safeParse({ $set: { title: "Changed" } }).success).toBe(false);
    expect(createCourseSchema.parse({ title: " Orientation " })).toMatchObject({ title: "Orientation", folderId: null });
  });

  it("allows HTTP(S) cover images and rejects active content URLs", () => {
    expect(createCourseSchema.safeParse({ title: "Guide", coverImage: "https://cdn.example.com/cover.png" }).success).toBe(true);
    expect(createCourseSchema.safeParse({ title: "Guide", coverImage: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("folder safety rules", () => {
  it("normalizes equivalent Unicode and case variants", () => {
    expect(normalizeFolderName("  SALES  ")).toBe(normalizeFolderName("sales"));
  });

  it("rejects moving a folder below itself or beyond the depth limit", () => {
    expect(() => assertNoFolderCycle("folder-a", ["folder-b", "folder-a"])).toThrow(/inside itself/);
    expect(() => assertNoFolderCycle("folder-a", Array.from({ length: 101 }, (_, i) => `folder-${i}`))).toThrow(/100 levels/);
  });

  it("escapes text before using it as a database search pattern", () => {
    expect(new RegExp(escapeRegex("course (A)"), "i").test("course (A)")).toBe(true);
    expect(new RegExp(escapeRegex("course (A)"), "i").test("course A")).toBe(false);
  });
});
