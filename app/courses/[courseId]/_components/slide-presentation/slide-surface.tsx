import type { CSSProperties, ReactNode } from "react";
import { resolveSlideAppearanceMaster, resolveSlideFooterHeight, resolveSlideHeaderTypography, resolveSlideNavigationVisibility, slideBodyTypographyVariables, slideTypographyStyle, type SlideAppearance, type SlideMaster, type SlideHeaderStyle } from "@/lib/editor/slide-design";
import { SlideMasterBackground } from "./slide-master-background";
import { SlideSurfaceFooter } from "./slide-surface-footer";
import { SlideHeaderBackground } from "./slide-header-background";
import { FittedSlideTitle } from "./fitted-slide-title";
import { backgroundPaint, solidColor } from "@/lib/color";

export function SlideSurface({ master, appearance, title, titleVisible = true, headerTextStyle, number, total, controls, menuControl, decorative, contentRegion = false, children }: {
  master?: SlideMaster;
  appearance?: SlideAppearance;
  title: ReactNode;
  titleVisible?: boolean;
  headerTextStyle?: SlideHeaderStyle;
  number: number;
  total: number;
  controls?: ReactNode;
  menuControl?: ReactNode;
  decorative?: boolean;
  contentRegion?: boolean;
  children?: ReactNode;
}) {
  const design = resolveSlideAppearanceMaster(master, appearance);
  const footerHeight = appearance?.hideFooter ? 0 : resolveSlideFooterHeight(design);
  const header = resolveSlideHeaderTypography(design, headerTextStyle);
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ ...backgroundPaint(design.backgroundColor), color: solidColor(design.textColor), "--course-accent": solidColor(design.accentColor), "--course-primary": solidColor(design.accentColor), "--slide-footer-height": `${footerHeight}px`, ...slideBodyTypographyVariables(design.bodyTypography) } as CSSProperties}>
      <SlideMasterBackground master={design} />
      {!appearance?.hideHeader && <><SlideHeaderBackground master={design} />
      <header data-slide-header className="absolute left-12 right-12 top-9 min-h-14 overflow-hidden leading-tight tracking-tight" style={slideTypographyStyle(header)}>{typeof title === "string" ? <FittedSlideTitle title={title} visible={titleVisible} fontSize={header.fontSize} textAlign={header.textAlign} /> : title}</header></>}
      <div data-slide-object-region className={contentRegion ? "pointer-events-auto absolute inset-x-0 overflow-auto" : "pointer-events-none absolute inset-0 z-20"} style={contentRegion ? { top: appearance?.hideHeader ? 0 : 108, bottom: footerHeight } : undefined}>{children}</div>
      <SlideSurfaceFooter hidden={appearance?.hideFooter} showNavigation={resolveSlideNavigationVisibility(appearance)} master={design} number={number} total={total} controls={controls} decorative={decorative} />
      {menuControl}
    </div>
  );
}
