import { z } from "zod";
import type { CSSProperties } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import { colorWithOpacity } from "@/lib/color";

export const slideBorderSchema = z.object({
  width: z.number().min(0).max(24).default(0),
  color: z.string().regex(/^#[\da-f]{6}$/i).default("#0f172a"),
  style: z.enum(["solid", "dashed", "dotted", "double"]).default("solid"),
  opacity: z.number().int().min(0).max(100).default(100),
});
export type SlideBorder = z.infer<typeof slideBorderSchema>;
export const defaultSlideBorder: SlideBorder = slideBorderSchema.parse({});
export const slideShadowSchema = z.enum(["none", "small", "medium", "large"]);
export const slideObjectShadows = {
  none: "none",
  small: "0 2px 6px rgba(15, 23, 42, 0.15)",
  medium: "0 6px 16px rgba(15, 23, 42, 0.2)",
  large: "0 12px 32px rgba(15, 23, 42, 0.25)",
} as const;

export function slideObjectDecorationStyle(block: Pick<ContentBlock, "slideBorder" | "slideShadow">): CSSProperties {
  const border = block.slideBorder ?? defaultSlideBorder;
  return {
    borderWidth: `${border.width}px`, borderStyle: border.style,
    borderColor: colorWithOpacity(border.color, border.opacity),
    boxShadow: slideObjectShadows[block.slideShadow ?? "none"],
  };
}
