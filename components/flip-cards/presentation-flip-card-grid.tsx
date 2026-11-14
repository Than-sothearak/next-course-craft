"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { backgroundPaint, solidColor } from "@/lib/color";
import { defaultFlipCardLayout, flipCardGrid, type FlipCardBlock, type FlipCardLayout, type FlipCard } from "@/lib/editor/flip-cards";

export const realisticFlipCardShadow = "0 2px 4px rgb(15 23 42 / 0.12), 0 12px 28px rgb(15 23 42 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.42), inset 0 -1px 1px rgb(15 23 42 / 0.09)";

export function PresentationFlipCardGrid({ count, columns, layout = defaultFlipCardLayout, children }: {
  count: number; columns: number; layout?: FlipCardLayout; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 400 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      if (element.clientWidth && element.clientHeight) setSize((previous) => previous.width === element.clientWidth && previous.height === element.clientHeight ? previous : { width: element.clientWidth, height: element.clientHeight });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const grid = flipCardGrid(count, columns, layout, size.width, size.height);
  const cellWidth = Math.max(0, (size.width - grid.padding * 2 - grid.columnGap * (grid.columns - 1)) / grid.columns);
  const cellHeight = Math.max(0, (size.height - grid.padding * 2 - grid.rowGap * (grid.rows - 1)) / grid.rows);
  const cardPadding = Math.min(layout.cardPadding, cellWidth / 6, cellHeight / 6);
  return <div ref={ref} data-flip-card-grid data-flip-card-columns={grid.columns} data-flip-card-rows={grid.rows} className="grid h-full min-h-0 w-full min-w-0 overflow-hidden" style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`, padding: grid.padding, columnGap: grid.columnGap, rowGap: grid.rowGap, "--flip-card-padding": `${cardPadding}px` } as CSSProperties}>{children}</div>;
}

export function presentationCardStyle(
  data: FlipCardBlock["data"],
  card: FlipCard,
  backgroundColor = card.backgroundColor ?? data.cardBackgroundColor,
  textColor = card.textColor ?? data.cardTextColor,
): CSSProperties {
  const layout = data.presentationLayout ?? defaultFlipCardLayout;
  const color = solidColor(textColor);
  return {
    ...backgroundPaint(backgroundColor), color,
    textAlign: layout.textAlign, borderRadius: layout.borderRadius,
    padding: `var(--flip-card-padding, ${layout.cardPadding}px)`,
    borderWidth: data.cardStyle === "outlined" ? 2 : 1,
    borderColor: data.cardStyle === "soft" ? "transparent" : `color-mix(in srgb, ${color} ${data.cardStyle === "outlined" ? 100 : 18}%, transparent)`,
    boxShadow: data.cardStyle === "realistic" ? realisticFlipCardShadow : data.cardStyle === "elevated" ? `0 4px 12px color-mix(in srgb, ${color} 18%, transparent)` : data.cardStyle === "classic" ? "0 1px 3px rgb(15 23 42 / 0.08)" : "none",
  };
}
