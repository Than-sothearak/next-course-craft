import type { CSSProperties } from "react";
import type { SlideCoverElementLayout } from "./slide-design";
import { fitSlideContent } from "./slide-content-fit";

export function fitCoverContent(viewport: { width: number; height: number }, content: { width: number; height: number }, layout: SlideCoverElementLayout) {
  const { scale } = fitSlideContent(viewport, content);
  const [vertical, horizontal] = layout.position.split("-");
  const remainingX = Math.max(0, viewport.width - content.width * scale);
  const remainingY = Math.max(0, viewport.height - content.height * scale);
  return { scale, left: (horizontal === "left" ? 0 : horizontal === "right" ? remainingX : remainingX / 2) + layout.offsetX, top: (vertical === "top" ? 0 : vertical === "bottom" ? remainingY : remainingY / 2) + layout.offsetY };
}

export function coverElementStyle(layout: SlideCoverElementLayout): CSSProperties {
  const [vertical, horizontal] = layout.position.split("-");
  return {
    position: "absolute", left: 0, right: 0,
    top: vertical === "top" ? 0 : vertical === "middle" ? "50%" : undefined,
    bottom: vertical === "bottom" ? 0 : undefined,
    textAlign: horizontal as "left" | "center" | "right",
    transform: `translate(${layout.offsetX}px, ${vertical === "middle" ? `calc(-50% + ${layout.offsetY}px)` : `${layout.offsetY}px`})`,
  };
}
