import { describe, expect, it } from "vitest";
import { slideMasterSchema, resolveSlideObjectArea } from "@/lib/editor/slide-design";
import { navigationButtonAppearance, navigationButtonPaint, navigationButtonStyles, navigationLayout, navigationPreset, resolveNavigationButtons, slideNavigationButtonsSchema } from "@/lib/editor/slide-navigation-design";
import { gradientColor } from "@/lib/color";
import { Course } from "@/models/Course";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

const gradient = gradientColor("#2563eb", "#9333ea", 135);
describe("presentation navigation design", () => {
  it("preserves legacy colors and the default footer geometry", () => {
    expect(slideMasterSchema.parse({}).navigationButtons).toBeUndefined();
    expect(resolveNavigationButtons(undefined, "#f8fafc")).toMatchObject({ style: "outline", textColor: "#f8fafc", borderColor: "#f8fafc" });
    expect(resolveSlideObjectArea()).toEqual({ width: 960, height: 368 });
  });
  it.each(navigationButtonStyles)("validates and paints the %s preset with gradients", (style) => {
    const buttons = slideNavigationButtonsSchema.parse({ ...navigationPreset(style), backgroundColor: gradient, borderColor: gradient });
    expect(navigationButtonPaint(buttons).borderRadius).toBe(buttons.radius);
    if (style !== "outline") expect(navigationButtonPaint(buttons).backgroundImage).toContain("linear-gradient");
    expect(slideNavigationButtonsSchema.safeParse(buttons).success).toBe(true);
  });
  it("keeps individual overrides separate and fits all button sizes into the available footer", () => {
    const settings = slideNavigationButtonsSchema.parse({ style: "modern", height: 72, minWidth: 200, fontSize: 18, gap: 24, overrides: { next: { style: "threeD", backgroundColor: gradient, height: 64, depth: 10 }, restart: { height: 40 } } });
    expect(navigationButtonAppearance(settings, "previous").style).toBe("modern"); expect(navigationButtonAppearance(settings, "restart").height).toBe(40);
    for (const availableWidth of [100, 240, 600]) for (const availableHeight of [24, 48, 120]) {
      const layout = navigationLayout(settings, true, availableWidth, availableHeight);
      expect(layout.width * layout.scale).toBeLessThanOrEqual(availableWidth + 0.00001); expect(layout.height * layout.scale).toBeLessThanOrEqual(availableHeight + 0.00001);
      const restart = layout.items.find((item) => item.key === "restart")!; expect(restart.width).toBe(restart.height);
    }
  });
  it("rejects invalid button styles, sizes, colors, overrides and footer heights in both contracts", () => {
    for (const navigationButtons of [{ style: "unknown" }, { height: 27 }, { height: 73 }, { radius: -1 }, { minWidth: Infinity }, { backgroundColor: "url(javascript:bad)" }, { textColor: "red" }, { gap: 25 }, { borderWidth: 4.5 }, { overrides: { next: { iconSize: 29 } } }]) {
      expect(slideMasterSchema.safeParse({ navigationButtons }).success).toBe(false);
      const document = new Course({ ownerId: "123456789012345678901234", title: "Presentation", slideMaster: { navigationButtons } }); expect(document.validateSync()).toBeDefined();
    }
    for (const footer of [{ height: 47 }, { height: 161 }, { height: 64.5 }, { fontSize: 25 }, { contentGap: 33 }]) {
      expect(slideMasterSchema.safeParse({ footer }).success).toBe(false);
      expect(new Course({ ownerId: "123456789012345678901234", title: "Presentation", slideMaster: { footer } }).validateSync()).toBeDefined();
    }
  });
  it("persists settings and dynamic object geometry through Course and SCORM snapshots", () => {
    const master = slideMasterSchema.parse({ footer: { height: 112, fontSize: 16, paddingY: 20, contentGap: 12 }, navigationButtons: { backgroundColor: gradient, overrides: { next: { style: "threeD", backgroundColor: gradient, height: 48 } } } });
    const document = new Course({ ownerId: "123456789012345678901234", title: "Presentation", slideMaster: master });
    expect(document.validateSync()).toBeUndefined(); expect(slideMasterSchema.parse(document.toObject().slideMaster)).toEqual(master);
    expect(resolveSlideObjectArea(master)).toEqual({ width: 960, height: 320 });
    const snapshot = editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", slideMaster: master, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Content", order: 0, blocks: [] }] });
    expect(parseScorm12Snapshot(snapshot).slideMaster).toEqual(master);
  });
});
