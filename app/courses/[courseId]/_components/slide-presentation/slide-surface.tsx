import type { CSSProperties, ReactNode } from "react";
import { defaultSlideMaster, resolveSlideFooterHeight, resolveSlideHeader, slideBodyTypographyVariables, type SlideMaster } from "@/lib/editor/slide-design";
import { courseThemeFontFamilies } from "@/lib/editor/theme";
import { SlideMasterBackground } from "./slide-master-background";
import { SlideFooter } from "./slide-footer";
import { SlideHeaderBackground } from "./slide-header-background";
import { FittedSlideTitle } from "./fitted-slide-title";
import { backgroundPaint, solidColor, textPaint } from "@/lib/color";

export function SlideSurface({ master, title, titleVisible = true, number, total, controls, menuControl, decorative, contentRegion = false, children }: {
  master?: SlideMaster;
  title: ReactNode;
  titleVisible?: boolean;
  number: number;
  total: number;
  controls?: ReactNode;
  menuControl?: ReactNode;
  decorative?: boolean;
  contentRegion?: boolean;
  children?: ReactNode;
}) {
  const design = master ?? defaultSlideMaster;
  const header = resolveSlideHeader(design);
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ ...backgroundPaint(design.backgroundColor), color: solidColor(design.textColor), "--course-accent": solidColor(design.accentColor), "--course-primary": solidColor(design.accentColor), "--slide-footer-height": `${resolveSlideFooterHeight(design)}px`, ...slideBodyTypographyVariables(design.bodyTypography) } as CSSProperties}>
      <SlideMasterBackground master={design} />
      <SlideHeaderBackground master={design} />
      <div className="absolute inset-x-0 top-0 h-2" style={backgroundPaint(design.accentColor)} />
      <header data-slide-header className="absolute left-12 right-12 top-9 min-h-14 overflow-hidden leading-tight tracking-tight" style={{ ...textPaint(header.textColor ?? design.textColor), fontFamily: header.fontFamily ? courseThemeFontFamilies[header.fontFamily] : undefined, fontSize: header.fontSize, fontWeight: header.fontWeight, fontStyle: header.fontStyle }}>{typeof title === "string" ? <FittedSlideTitle title={title} visible={titleVisible} fontSize={header.fontSize} /> : title}</header>
      <div data-slide-object-region className={contentRegion ? "pointer-events-auto absolute inset-x-0 top-[108px] overflow-auto" : "pointer-events-none absolute inset-0 z-20"} style={contentRegion ? { bottom: resolveSlideFooterHeight(design) } : undefined}>{children}</div>
      <SlideFooter master={design} number={number} total={total} controls={controls} decorative={decorative} />
      {menuControl}
    </div>
  );
}
