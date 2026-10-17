import { z } from "zod";

const color = z.string().regex(/^#[\da-fA-F]{6}$/);
const font = z.enum(["sans", "serif", "rounded"]);
const alignment = z.enum(["left", "center", "right"]);
const image = z.string().max(2_048).refine((value) => value === "" || /^\/api\/assets\/[\da-f]{24}\/file$/i.test(value), "Choose an image from this course's media library.");
export const masterBackgroundSchema = z.object({
  type: z.enum(["solid", "gradient", "geometric", "image", "transparent"]), color, secondaryColor: color,
  patternColor: color, opacity: z.number().min(0).max(1), patternOpacity: z.number().min(0).max(1),
  patternSize: z.number().min(40).max(400), density: z.number().min(.5).max(4), angle: z.number().min(0).max(360),
  imageSrc: image, imagePosition: z.enum(["center", "top", "bottom"]),
}).strict();
const titleSchema = z.object({ fontFamily: font, fontSize: z.number().min(8).max(120), color, alignment, offsetX: z.number().min(-300).max(300), offsetY: z.number().min(-60).max(60) }).strict();
const logoSchema = z.object({ visible: z.boolean(), src: image, alt: z.string().max(500), x: z.number().min(0).max(1256), y: z.number().min(0).max(156), width: z.number().min(24).max(256), height: z.number().min(24).max(180) }).strict();
export const masterHeaderSchema = z.object({ enabled: z.boolean(), height: z.number().min(48).max(180), color, shape: z.enum(["straight", "angled"]), bannerWidth: z.number().min(400).max(1280), angleWidth: z.number().min(0).max(160), title: titleSchema, logo: logoSchema }).strict();
const footerTextSchema = z.object({ fontFamily: font, fontSize: z.number().min(8).max(48), color, alignment, inset: z.number().min(12).max(200) }).strict();
const numberSchema = z.object({ visible: z.boolean(), start: z.number().int().min(0).max(9999), style: z.enum(["circle", "square", "plain"]), color, backgroundColor: color, size: z.number().min(24).max(100), fontSize: z.number().min(8).max(48), right: z.number().min(8).max(200) }).strict();
export const masterFooterSchema = z.object({ enabled: z.boolean(), height: z.number().min(36).max(140), color, text: z.string().max(500), textStyle: footerTextSchema, number: numberSchema }).strict();
export const masterContentSchema = z.object({ x: z.number().min(0).max(1180), y: z.number().min(0).max(620), width: z.number().min(100).max(1280), height: z.number().min(100).max(720), padding: z.number().min(0).max(80), radius: z.number().min(0).max(100), color, opacity: z.number().min(0).max(1) }).strict();
const masterBaseSchema = z.object({ id: z.string().min(1).max(64), schemaVersion: z.literal(1), name: z.string().trim().min(1).max(80), enabled: z.boolean(), background: masterBackgroundSchema, header: masterHeaderSchema, content: masterContentSchema, footer: masterFooterSchema }).strict();
export type SlideMaster = z.infer<typeof masterBaseSchema>;

export function masterSafeBounds(master?: SlideMaster | null) {
  if (!master?.enabled) return { x: 0, y: 0, width: 1280, height: 720 };
  const x = master.content.x + master.content.padding;
  const y = Math.max(master.content.y, master.header.enabled ? master.header.height : 0) + master.content.padding;
  const right = Math.min(1280, master.content.x + master.content.width) - master.content.padding;
  const bottom = Math.min(master.content.y + master.content.height, master.footer.enabled ? 720 - master.footer.height : 720) - master.content.padding;
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}
export const slideMasterSchema = masterBaseSchema.superRefine((master, context) => {
  if (master.content.x + master.content.width > 1280 || master.content.y + master.content.height > 720) context.addIssue({ code: "custom", path: ["content"], message: "Content region must fit inside the canvas." });
  if (master.header.logo.x + master.header.logo.width > 1280 || master.header.logo.y + master.header.logo.height > 180) context.addIssue({ code: "custom", path: ["header", "logo"], message: "Logo must fit inside the header region." });
  const safe = masterSafeBounds(master);
  if (master.enabled && (safe.width < 100 || safe.height < 100)) context.addIssue({ code: "custom", path: ["content"], message: "Reserve at least 100 × 100 pixels for content after header, footer and padding." });
});
export const masterOverridesSchema = z.object({
  enabled: z.boolean().optional(), background: masterBackgroundSchema.partial().optional(), content: masterContentSchema.partial().optional(),
  header: masterHeaderSchema.partial().extend({ title: titleSchema.partial().optional(), logo: logoSchema.partial().optional() }).strict().optional(),
  footer: masterFooterSchema.partial().extend({ textStyle: footerTextSchema.partial().optional(), number: numberSchema.partial().optional() }).strict().optional(),
}).strict();
export type MasterOverrides = z.infer<typeof masterOverridesSchema>;
export const slideNumberOverrideSchema = z.object({ hidden: z.boolean().optional(), value: z.string().trim().max(16).optional() }).strict();

type SlideMasterSettings = { masterOverrides?: MasterOverrides; numbering?: z.infer<typeof slideNumberOverrideSchema> };
/** Legacy canvases/templates keep master metadata outside their unchanged content document. */
export function masterSettingsForSlide(slide: SlideMasterSettings & { composition?: SlideMasterSettings }) {
  return { masterOverrides: slide.masterOverrides ?? slide.composition?.masterOverrides, numbering: slide.numbering ?? slide.composition?.numbering };
}

export const institutionalGreenMaster: SlideMaster = slideMasterSchema.parse({
  id: "course-master", schemaVersion: 1, name: "Institutional Green", enabled: true,
  background: { type: "geometric", color: "#f2fff3", secondaryColor: "#d1f3d7", patternColor: "#72c685", opacity: 1, patternOpacity: .16, patternSize: 180, density: 1, angle: 135, imageSrc: "", imagePosition: "center" },
  header: { enabled: true, height: 108, color: "#199b5b", shape: "angled", bannerWidth: 1192, angleWidth: 76, title: { fontFamily: "serif", fontSize: 48, color: "#ffffff", alignment: "center", offsetX: 0, offsetY: 0 }, logo: { visible: true, src: "", alt: "Institution logo", x: 1196, y: 14, width: 68, height: 68 } },
  content: { x: 12, y: 120, width: 1256, height: 516, padding: 32, radius: 48, color: "#ffffff", opacity: .65 },
  footer: { enabled: true, height: 72, color: "#199b5b", text: "Module 1: Introduction to the Bio-refinery Concept", textStyle: { fontFamily: "sans", fontSize: 16, color: "#ffffff", alignment: "left", inset: 56 }, number: { visible: true, start: 1, style: "circle", color: "#ffffff", backgroundColor: "#b4ca5f", size: 54, fontSize: 18, right: 48 } },
});

export function resolveSlideMaster(master?: SlideMaster, overrides?: MasterOverrides): SlideMaster | undefined {
  if (!master && !overrides) return undefined;
  const base = master ?? { ...institutionalGreenMaster, enabled: false };
  return slideMasterSchema.parse({ ...base, ...overrides,
    background: { ...base.background, ...overrides?.background }, content: { ...base.content, ...overrides?.content },
    header: { ...base.header, ...overrides?.header, title: { ...base.header.title, ...overrides?.header?.title }, logo: { ...base.header.logo, ...overrides?.header?.logo } },
    footer: { ...base.footer, ...overrides?.footer, textStyle: { ...base.footer.textStyle, ...overrides?.footer?.textStyle }, number: { ...base.footer.number, ...overrides?.footer?.number } },
  });
}

/** Conflicting drafts or concurrent course/slide edits must not crash the canvas.
 * Persistence still rejects invalid merges; the original override is retained for correction. */
export function renderSlideMaster(master?: SlideMaster, overrides?: MasterOverrides): SlideMaster | undefined {
  try { return resolveSlideMaster(master, overrides); }
  catch { return master; }
}

/** Store only differences, so untouched properties continue inheriting future master edits. */
export function masterOverridesFor(base: SlideMaster | undefined, selected: SlideMaster): MasterOverrides {
  const inherited = base ?? { ...institutionalGreenMaster, enabled: false };
  function diff(left: unknown, right: unknown): unknown {
    if (JSON.stringify(left) === JSON.stringify(right)) return undefined;
    if (left && right && typeof left === "object" && typeof right === "object") return Object.fromEntries(Object.entries(right).flatMap(([key, value]) => { const changed = diff((left as Record<string, unknown>)[key], value); return changed === undefined ? [] : [[key, changed]]; }));
    return right;
  }
  const result: Record<string, unknown> = {};
  for (const key of ["enabled", "background", "content", "header", "footer"] as const) { const changed = diff(inherited[key], selected[key]); if (changed !== undefined) result[key] = changed; }
  return masterOverridesSchema.parse(result);
}

export function masterSlideNumber(master: SlideMaster, order: number, override?: z.infer<typeof slideNumberOverrideSchema>) {
  if (!master.footer.number.visible || override?.hidden) return null;
  return override?.value?.trim() || String(order + master.footer.number.start);
}
