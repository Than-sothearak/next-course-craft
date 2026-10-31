/* eslint-disable @next/next/no-img-element -- Footer logos also render in standalone static exports. */
import type { ReactNode } from "react";
import { defaultSlideMaster, resolveSlideFooter, resolveSlideSize, type SlideMaster } from "@/lib/editor/slide-design";
import { backgroundPaint, borderPaint, solidColor, textPaint } from "@/lib/color";
import { resolveNavigationButtons } from "@/lib/editor/slide-navigation-design";
import { courseThemeFontFamilies } from "@/lib/editor/theme";
import { SlideNavigationDesignProvider } from "./slide-navigation-controls";

export function SlideFooter({ master = defaultSlideMaster, number, total, controls, decorative = false }: {
  master?: SlideMaster;
  number: number;
  total: number;
  controls?: ReactNode;
  decorative?: boolean;
}) {
  const footer = resolveSlideFooter(master);
  const showText = footer.content !== "logos";
  const logos = footer.content === "text" ? [] : footer.logos;
  const rows = Array.from({ length: Math.ceil(logos.length / 6) }, (_, index) => logos.slice(index * 6, index * 6 + 6));
  const gapX = footer.logoGapX ?? 8;
  const justifyContent = { left: "flex-start", center: "center", right: "flex-end", between: "space-between" }[footer.logoJustify ?? "center"];
  const alignItems = { top: "flex-start", middle: "center", bottom: "flex-end" }[footer.logoAlign ?? "middle"];
  const size = resolveSlideSize(master), height = footer.height ?? 64, contentGap = footer.contentGap ?? 16;
  const border = footer.borderTop ? footer.borderWidth : 0;
  const paddingY = Math.min(footer.paddingY ?? 8, Math.max(0, Math.floor((height - border - 24) / 2)));
  const fontSize = Math.min(footer.fontSize ?? 12, (height - border - paddingY * 2) / 1.3);
  const textLines = Math.max(1, Math.min(2, Math.floor((height - border - paddingY * 2) / (fontSize * 1.3))));
  const innerWidth = size.width - footer.paddingX * 2;
  const numberWidth = master.showSlideNumber ? Math.ceil(`${number} / ${total}`.length * fontSize * 0.65) : 0;
  const brandMinimum = logos.length || (showText && master.footerText) ? Math.min(96, innerWidth * 0.18) : 0;
  const availableWidth = Math.max(24, innerWidth - numberWidth - contentGap * (master.showSlideNumber ? 2 : 1) - brandMinimum);
  return <footer data-slide-footer={decorative ? undefined : true} data-slide-thumbnail-footer={decorative || undefined} className="absolute inset-x-0 bottom-0 flex w-full items-center" style={{ height, fontSize, fontFamily: footer.fontFamily ? courseThemeFontFamilies[footer.fontFamily] : undefined, fontWeight: footer.fontWeight, fontStyle: footer.fontStyle, gap: contentGap, ...backgroundPaint(footer.backgroundColor), color: solidColor(footer.textColor), ...borderPaint(footer.borderColor), borderTopColor: solidColor(footer.borderColor), borderTopStyle: "solid", borderTopWidth: border, paddingInline: footer.paddingX ?? 20, paddingBlock: paddingY }}>
    <div className="flex h-full min-h-0 min-w-0 flex-1 items-center" style={{ gap: contentGap }}>
      {showText && master.footerText && <p style={{ ...textPaint(footer.textColor), lineHeight: 1.3, WebkitLineClamp: textLines }} className={`line-clamp-2 max-h-full w-fit min-w-0 flex-initial break-words ${logos.length ? "max-w-[50%]" : "max-w-full"}`}>{master.footerText}</p>}
      {logos.length > 0 && <div aria-label={decorative ? undefined : "Footer logos"} className="grid h-full min-h-0 min-w-0 flex-1" style={{ gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))`, rowGap: footer.logoGapY ?? 4 }}>
        {rows.map((row, index) => <div key={index} data-slide-footer-logo-row={decorative ? undefined : true} className="flex h-full min-h-0 min-w-0 w-full" style={{ gap: gapX, justifyContent, alignItems }}>
          {row.map((logo) => <img key={logo.id} src={logo.src} alt={logo.alt} className="h-auto min-h-0 w-auto min-w-0 flex-none max-h-full object-contain" style={{ maxWidth: `calc((100% - ${(row.length - 1) * gapX}px) / ${row.length})` }} />)}
        </div>)}
      </div>}
    </div>
    {master.showSlideNumber && <span aria-label={decorative ? undefined : "Slide number"} className="shrink-0 text-center tabular-nums" style={{ ...textPaint(footer.textColor), width: numberWidth }}>{number} / {total}</span>}
    <SlideNavigationDesignProvider settings={resolveNavigationButtons(master.navigationButtons, footer.textColor)} availableWidth={availableWidth} availableHeight={height - border - paddingY * 2} canvasWidth={size.width} rightInset={footer.paddingX} tipMaxHeight={Math.max(120, size.height - height - 24)}>{controls}</SlideNavigationDesignProvider>
  </footer>;
}
