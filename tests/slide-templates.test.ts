import { describe, expect, it } from "vitest";
import { createTemplateContent, createTemplateSlide, replaceSlideTemplate, resetTemplateDesign } from "../lib/slides/templates";
import { slideTemplateDefinitions } from "../lib/slides/template-definitions";
import { slideSnapshotSchema } from "../lib/slides/schema";
import { slideTemplateContentSchema } from "../lib/slides/template-schema";
import { defaultSlideTheme, readableSlideColor, slideContrast, slideThemePresets } from "../lib/slides/themes";

describe("structured slide templates", () => {
  it.each(slideTemplateDefinitions)("creates a valid independent $name slide", ({ id, version, slots }) => {
    const first = createTemplateSlide(id, 0), second = createTemplateSlide(id, 1);
    expect(slideSnapshotSchema.safeParse(first).success).toBe(true);
    expect(first).toMatchObject({ schemaVersion: 2, objects: [], template: { id, version, design: { themeOverrides: {} } } });
    expect(Object.keys(first.template!.slots)).toEqual(slots.map((slot) => slot.key));
    first.template!.slots.title = { type: "text", content: "My own lesson" };
    expect(second.template!.slots.title).not.toEqual(first.template!.slots.title);
    const firstList = first.template!.slots.items, secondList = second.template!.slots.items;
    if (firstList?.type === "list" && secondList?.type === "list") expect(firstList.items[0].id).not.toBe(secondList.items[0].id);
  });
  it("preserves authored content through replacement, including a temporarily unused image", () => {
    const original = createTemplateContent("image-text");
    original.slots.title = { type: "text", content: "Learning objectives" };
    original.slots.image = { type: "image", src: "/api/assets/507f1f77bcf86cd799439011/file", alt: "Students discussing an idea" };
    original.design.variant = "alternate";
    const textOnly = replaceSlideTemplate(original, "title-description");
    expect(textOnly.slots.title).toEqual(original.slots.title);
    expect(textOnly.retainedSlots.image).toEqual(original.slots.image);
    const restored = replaceSlideTemplate(textOnly, "text-image");
    expect(restored.slots.image).toEqual(original.slots.image);
    expect(restored.slots.title).toEqual(original.slots.title);
    expect(restored.retainedSlots.image).toBeUndefined();
    restored.slots.title = { type: "text", content: "Independent" };
    expect(original.slots.title.content).toBe("Learning objectives");
  });
  it("resets design without replacing text, media, list IDs, or retained content", () => {
    const template = replaceSlideTemplate(createTemplateContent("image-text"), "three-cards");
    template.design = { ...template.design, background: "primary", density: "compact", variant: "alternate", themeOverrides: { primaryColor: "#123456" } };
    const reset = resetTemplateDesign(template);
    expect(reset.slots).toEqual(template.slots);
    expect(reset.retainedSlots).toEqual(template.retainedSlots);
    expect(reset.design).toMatchObject({ background: "theme", density: "theme", variant: "default", themeOverrides: {} });
  });
  it("rejects missing or incorrect slots, unsupported versions, scripts, and duplicated item IDs", () => {
    const valid = createTemplateContent("image-text");
    expect(slideTemplateContentSchema.safeParse({ ...valid, version: 3 }).success).toBe(false);
    expect(slideTemplateContentSchema.safeParse({ ...valid, id: "unknown" }).success).toBe(false);
    expect(slideTemplateContentSchema.safeParse({ ...valid, slots: { ...valid.slots, image: { type: "text", content: "wrong" } } }).success).toBe(false);
    const missing = { ...valid.slots }; delete missing.title;
    expect(slideTemplateContentSchema.safeParse({ ...valid, slots: missing }).success).toBe(false);
    expect(slideTemplateContentSchema.safeParse({ ...valid, slots: { ...valid.slots, image: { type: "image", src: "javascript:alert(1)", alt: "Unsafe" } } }).success).toBe(false);
    expect(slideTemplateContentSchema.safeParse({ ...valid, slots: { ...valid.slots, image: { type: "image", src: "/\\evil.example/a.png", alt: "Unsafe" } } }).success).toBe(false);
    const cards = createTemplateContent("three-cards");
    if (cards.slots.items.type === "list") cards.slots.items.items[1].id = cards.slots.items.items[0].id;
    expect(slideTemplateContentSchema.safeParse(cards).success).toBe(false);
  });
  it("reads legacy canvas slides and prevents mixing a template with uncontrolled objects", () => {
    const canvas = slideSnapshotSchema.parse({ title: "Existing", order: 0, objects: [{ id: "text", type: "text", content: "Keep me", x: 20, y: 20, width: 100, height: 40 }], revision: 3 });
    expect(canvas.schemaVersion).toBe(1);
    expect(canvas.template).toBeUndefined();
    expect(canvas.objects[0].content).toBe("Keep me");
    expect(slideSnapshotSchema.safeParse({ ...canvas, template: createTemplateContent("cover"), schemaVersion: 2 }).success).toBe(false);
    expect(slideSnapshotSchema.safeParse({ ...canvas, objects: [], template: createTemplateContent("cover") }).success).toBe(false);
  });
  it.each(slideThemePresets)("provides readable labels for the $label theme", ({ theme }) => {
    expect(slideContrast(theme.backgroundColor, readableSlideColor(theme.backgroundColor))).toBeGreaterThanOrEqual(4.5);
    expect(slideContrast(theme.primaryColor, readableSlideColor(theme.primaryColor))).toBeGreaterThanOrEqual(4.5);
    expect(createTemplateContent("cover").design.themeOverrides).toEqual({});
    expect(defaultSlideTheme.primaryColor).toBe("#5546d9");
  });
  it("maintains normal-text contrast on custom midtone backgrounds", () => {
    for (let channel = 0; channel <= 255; channel += 1) {
      const background = "#" + channel.toString(16).padStart(2, "0").repeat(3);
      expect(slideContrast(background, readableSlideColor(background))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
