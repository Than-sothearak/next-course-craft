import { z } from "zod";
import type { CSSProperties } from "react";
import { backgroundPaint, colorValueSchema, solidColor } from "@/lib/color";

export const navigationButtonStyles = ["outline", "solid", "soft", "modern", "glass", "threeD"] as const;
export const navigationButtonAppearanceSchema = z.object({
  style: z.enum(navigationButtonStyles).default("outline"),
  backgroundColor: colorValueSchema.default("#4f46e5"),
  textColor: colorValueSchema.default("#172033"),
  borderColor: colorValueSchema.default("#172033"),
  fillOpacity: z.number().int().min(0).max(100).default(100),
  height: z.number().int().min(28).max(72).default(36),
  minWidth: z.number().int().min(64).max(200).default(88),
  paddingX: z.number().int().min(4).max(32).default(12),
  fontSize: z.number().int().min(10).max(18).default(12),
  iconSize: z.number().int().min(12).max(28).default(15),
  radius: z.number().int().min(0).max(36).default(6),
  borderWidth: z.number().int().min(0).max(4).default(1),
  depth: z.number().int().min(2).max(10).default(4),
});
export type NavigationButtonAppearance = z.infer<typeof navigationButtonAppearanceSchema>;
export const navigationButtonKeys = ["previous", "restart", "next"] as const;
export type NavigationButtonKey = typeof navigationButtonKeys[number];
export const slideNavigationButtonsSchema = navigationButtonAppearanceSchema.extend({
  gap: z.number().int().min(0).max(24).default(8),
  overrides: z.object({ previous: navigationButtonAppearanceSchema.optional(), restart: navigationButtonAppearanceSchema.optional(), next: navigationButtonAppearanceSchema.optional() }).optional(),
});
export type SlideNavigationButtons = z.infer<typeof slideNavigationButtonsSchema>;

export function resolveNavigationButtons(settings?: SlideNavigationButtons, textColor = "#172033"): SlideNavigationButtons {
  return settings ?? slideNavigationButtonsSchema.parse({ textColor, borderColor: textColor });
}
export function navigationButtonAppearance(settings: SlideNavigationButtons, key: NavigationButtonKey): NavigationButtonAppearance {
  return settings.overrides?.[key] ?? navigationButtonAppearanceSchema.parse(settings);
}
export function navigationButtonMetrics(appearance: NavigationButtonAppearance, iconOnly = false) {
  return { width: iconOnly ? appearance.height : Math.ceil(Math.max(appearance.minWidth, 8 * appearance.fontSize * 0.67 + appearance.iconSize + 6 + 2 * (appearance.paddingX + appearance.borderWidth))), height: appearance.height, depth: appearance.style === "threeD" ? appearance.depth : 0 };
}
export function navigationLayout(settings: SlideNavigationButtons, help: boolean, availableWidth = Infinity, availableHeight = Infinity) {
  const buttons = navigationButtonKeys.map((key) => {
    const original = navigationButtonAppearance(settings, key);
    const depth = original.style === "threeD" ? Math.min(original.depth, Math.max(2, Math.floor(availableHeight * 0.12))) : 0;
    const height = Math.min(original.height, Math.max(20, availableHeight - depth));
    const borderWidth = Math.min(original.borderWidth, Math.max(1, Math.floor((height - 16) / 2)));
    const appearance = { ...original, height, borderWidth, depth: depth || original.depth, fontSize: Math.min(original.fontSize, Math.max(10, height - borderWidth * 2 - 4)), iconSize: Math.min(original.iconSize, Math.max(12, height - borderWidth * 2 - 4)) };
    return { key, appearance };
  });
  const helpSize = Math.min(28, availableHeight);
  const naturalWidth = buttons.reduce((sum, { key, appearance }) => sum + navigationButtonMetrics(appearance, key === "restart").width, help ? helpSize : 0) + settings.gap * (help ? 3 : 2);
  const showLabels = availableWidth >= naturalWidth * 0.75;
  const gap = showLabels ? settings.gap : Math.min(6, settings.gap);
  let x = help ? helpSize + gap : 0;
  const items = buttons.map(({ key, appearance }) => { const metrics = navigationButtonMetrics(appearance, key === "restart" || !showLabels); const item = { key, appearance, ...metrics, x }; x += metrics.width + gap; return item; });
  const width = x - gap;
  const height = Math.max(help ? helpSize : 0, ...items.map((item) => item.height + item.depth));
  const scale = Math.max(0.01, Math.min(1, availableWidth / width, availableHeight / height));
  return { items, width, height, scale, helpSize, showLabels, gap };
}
export function navigationButtonPaint(appearance: NavigationButtonAppearance): CSSProperties {
  const painted = appearance.style !== "outline";
  const background = painted ? backgroundPaint(appearance.backgroundColor, appearance.fillOpacity) : { backgroundColor: "transparent" };
  const glossy = appearance.style === "modern" || appearance.style === "glass";
  return { ...background,
    ...(glossy ? { backgroundImage: `linear-gradient(180deg, rgb(255 255 255 / 24%), rgb(255 255 255 / 0%))${background.backgroundImage ? `, ${background.backgroundImage}` : ""}` } : {}),
    color: solidColor(appearance.textColor), borderColor: solidColor(appearance.borderColor), borderWidth: appearance.borderWidth, borderStyle: "solid", borderRadius: appearance.radius,
    height: appearance.height, minHeight: appearance.height, fontSize: appearance.fontSize, lineHeight: 1, paddingInline: appearance.paddingX, gap: 6,
    boxShadow: appearance.style === "modern" ? "0 3px 10px rgb(15 23 42 / 18%), inset 0 1px 0 rgb(255 255 255 / 30%)" : appearance.style === "glass" ? "inset 0 1px 0 rgb(255 255 255 / 50%), 0 2px 6px rgb(15 23 42 / 12%)" : "none",
    backdropFilter: appearance.style === "glass" ? "blur(8px)" : undefined,
  };
}

export function navigationPreset(style: NavigationButtonAppearance["style"]): Partial<NavigationButtonAppearance> {
  return { style, fillOpacity: style === "soft" ? 14 : style === "glass" ? 75 : 100, borderWidth: style === "soft" || style === "modern" ? 0 : 1, radius: style === "modern" ? 12 : style === "glass" ? 18 : 6 };
}
