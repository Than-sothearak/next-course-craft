import type { CSSProperties, ReactNode } from "react";
import { defaultSlideMaster, resolveSlideFooterHeight, type SlideMaster } from "@/lib/editor/slide-design";
import { SlideMasterBackground } from "./slide-master-background";
import { SlideFooter } from "./slide-footer";
import { SlideHeaderBackground } from "./slide-header-background";
import { backgroundPaint, solidColor, textPaint } from "@/lib/color";

export function SlideSurface({ master, title, number, total, controls, menuControl, decorative, children }: {
  master?: SlideMaster;
  title: ReactNode;
  number: number;
  total: number;
  controls?: ReactNode;
  menuControl?: ReactNode;
  decorative?: boolean;
  children: ReactNode;
}) {
  const design = master ?? defaultSlideMaster;
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ ...backgroundPaint(design.backgroundColor), color: solidColor(design.textColor), "--course-accent": solidColor(design.accentColor), "--course-primary": solidColor(design.accentColor), "--slide-footer-height": `${resolveSlideFooterHeight(design)}px` } as CSSProperties}>
      <SlideMasterBackground master={design} />
      <SlideHeaderBackground master={design} />
      <div className="absolute inset-x-0 top-0 h-2" style={backgroundPaint(design.accentColor)} />
      <header data-slide-header className={`absolute top-9 min-h-14 text-[32px] font-bold leading-tight tracking-tight ${menuControl ? "left-16 right-16" : "left-12 right-12"}`} style={textPaint(design.header?.textColor ?? design.textColor)}>{title}</header>
      <div data-slide-object-region className="absolute inset-x-0 top-[108px] overflow-auto" style={{ bottom: resolveSlideFooterHeight(design) }}>{children}</div>
      <SlideFooter master={design} number={number} total={total} controls={controls} decorative={decorative} />
      {menuControl}
    </div>
  );
}
