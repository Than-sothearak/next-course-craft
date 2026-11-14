import { z } from "zod";
import type { CSSProperties } from "react";

export function parseGradient(value: string | null | undefined) {
  const match = value?.match(/^linear-gradient\((\d{1,3})deg, (#[\da-f]{6}) 0%, (#[\da-f]{6}) 100%\)$/i);
  return match && Number(match[1]) <= 360 ? { angle: Number(match[1]), start: match[2], end: match[3] } : null;
}

export function gradientColor(start: string, end: string, angle = 90) {
  return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
}

export const colorValueSchema = z.string().max(100).refine((value) => /^#[\da-f]{6}$/i.test(value) || Boolean(parseGradient(value)), "Choose a hex color or a two-color gradient.");

export function solidColor(value: string) { return parseGradient(value)?.start ?? value; }

export function representativeColor(value: string) {
  const gradient = parseGradient(value);
  if (!gradient) return value;
  return "#" + [1, 3, 5].map((index) => Math.round((parseInt(gradient.start.slice(index, index + 2), 16) + parseInt(gradient.end.slice(index, index + 2), 16)) / 2).toString(16).padStart(2, "0")).join("");
}

/** Keep labels and controls readable on an authored solid or gradient surface. */
export function contrastTextColor(value: string): "#000000" | "#ffffff" {
  const color = representativeColor(value);
  const [red, green, blue] = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? "#000000" : "#ffffff";
}

export function colorWithOpacity(color: string, opacity: number) {
  if (opacity === 100) return color;
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  return `rgba(${channels.join(", ")}, ${opacity / 100})`;
}

const courseThemePrimary = "var(--course-theme-primary, var(--course-primary, #2f5f9f))";
const courseThemeAccent = "var(--course-theme-accent, var(--course-accent, #ff876c))";
const courseThemeGradientEnd = `color-mix(in srgb, ${courseThemePrimary} 82%, ${courseThemeAccent} 18%)`;
export const courseThemeFlipCardGradient = `linear-gradient(135deg, ${courseThemePrimary} 0%, ${courseThemeGradientEnd} 100%)`;

export function backgroundPaint(value: string, opacity = 100): CSSProperties {
  const gradient = parseGradient(value);
  if (gradient) return {
    backgroundColor: opacity === 100 ? gradient.start : "transparent",
    backgroundImage: gradientColor(colorWithOpacity(gradient.start, opacity), colorWithOpacity(gradient.end, opacity), gradient.angle),
  };
  if (value === courseThemeFlipCardGradient) {
    const themePrimary = opacity === 100 ? courseThemePrimary : `color-mix(in srgb, ${courseThemePrimary} ${opacity}%, transparent)`;
    const themeAccent = opacity === 100 ? courseThemeAccent : `color-mix(in srgb, ${courseThemeAccent} ${opacity}%, transparent)`;
    const gradientEnd = `color-mix(in srgb, ${themePrimary} 82%, ${themeAccent} 18%)`;
    return {
      backgroundColor: opacity === 100 ? courseThemePrimary : "transparent",
      backgroundImage: `linear-gradient(135deg, ${themePrimary} 0%, ${gradientEnd} 100%)`,
    };
  }
  return { backgroundColor: colorWithOpacity(value, opacity) };
}

export function textPaint(value?: string): CSSProperties {
  return value && parseGradient(value) ? { color: "transparent", backgroundImage: value, backgroundClip: "text", WebkitBackgroundClip: "text" } : { color: value };
}

export function borderPaint(value: string): CSSProperties {
  return parseGradient(value) ? { borderColor: solidColor(value), borderImageSource: value, borderImageSlice: 1 } : { borderColor: value };
}
