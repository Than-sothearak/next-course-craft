import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defaultSlideCoverTypography, resolveSlideFooterHeight, slideBodyTypographyVariables, slideTypographyStyle, type SlideCover, type SlideMaster } from "@/lib/editor/slide-design";
import { SlideFooter } from "./slide-footer";
import { SlideCoverPositionFrame } from "./slide-cover-position-frame";
import { backgroundPaint } from "@/lib/color";

export function SlideCoverSurface({ cover, title, master, number = 1, total = 1, controls, menuControl, instructionsControl, onStart, startDisabled = false, startHint, decorative, children }: {
  cover: SlideCover;
  title: string;
  master?: SlideMaster;
  number?: number;
  total?: number;
  controls?: ReactNode;
  menuControl?: ReactNode;
  instructionsControl?: ReactNode;
  onStart?: () => void;
  startDisabled?: boolean;
  startHint?: string;
  decorative?: boolean;
  children?: ReactNode;
}) {
  const horizontal = (cover.contentPosition ?? "middle-center").split("-")[1];
  const justify = (align: string) => align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const titleContent = <h1 data-cover-element="title" className="break-words leading-tight tracking-tight drop-shadow-lg [overflow-wrap:anywhere]" style={slideTypographyStyle(cover.titleStyle ?? defaultSlideCoverTypography.title)}>{title}</h1>;
  const subtitleContent = <p data-cover-element="subtitle" className="whitespace-pre-wrap break-words leading-relaxed" style={slideTypographyStyle(cover.subtitleStyle ?? defaultSlideCoverTypography.subtitle)}>{cover.subtitle}</p>;
  const startContent = (align: string) => <div className="flex flex-col gap-3" style={{ alignItems: justify(align) }}>
    <Button data-cover-element="button" type="button" size="lg" disabled={!onStart || startDisabled} title={startHint} onClick={onStart} className="min-w-36 hover:brightness-95" style={{ ...slideTypographyStyle(cover.buttonStyle ?? defaultSlideCoverTypography.button), ...backgroundPaint(cover.buttonBackgroundColor ?? "#ffffff"), borderRadius: cover.buttonRadius ?? 8, justifyContent: cover.buttonStyle?.textAlign === "left" ? "flex-start" : cover.buttonStyle?.textAlign === "right" ? "flex-end" : "center" }}>{cover.startLabel}<ArrowRight size={17} /></Button>
    {instructionsControl}
  </div>;
  return <div className="relative h-full w-full overflow-hidden bg-slate-900 text-white" style={{ "--slide-footer-height": `${resolveSlideFooterHeight(master)}px`, ...slideBodyTypographyVariables(master?.bodyTypography) } as CSSProperties}>
    {cover.imageSrc ? <Image src={cover.imageSrc} alt={cover.imageAlt} fill unoptimized className="object-cover" sizes="960px" /> : <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-indigo-700 to-sky-600" />}
    <div className="absolute inset-0" style={{ backgroundColor: `rgba(4, 10, 32, ${cover.overlayOpacity / 100})` }} />
    <SlideCoverPositionFrame layout={{ position: cover.contentPosition ?? "middle-center", offsetX: 0, offsetY: 0 }}>
      {cover.lessonOf && <p data-cover-element="label" className="mb-4 uppercase tracking-[0.24em]" style={slideTypographyStyle(cover.labelStyle ?? defaultSlideCoverTypography.label)}>{cover.lessonOf}</p>}
      {!cover.titleLayout && titleContent}
      {cover.subtitle && !cover.subtitleLayout && <div className="mt-5">{subtitleContent}</div>}
      {!cover.buttonLayout && <div className="mt-9">{startContent(horizontal)}</div>}
    </SlideCoverPositionFrame>
    {cover.titleLayout && <SlideCoverPositionFrame element="title" layout={cover.titleLayout}>{titleContent}</SlideCoverPositionFrame>}
    {cover.subtitle && cover.subtitleLayout && <SlideCoverPositionFrame element="subtitle" layout={cover.subtitleLayout}>{subtitleContent}</SlideCoverPositionFrame>}
    {cover.buttonLayout && <SlideCoverPositionFrame element="button" layout={cover.buttonLayout}>{startContent(cover.buttonLayout.position.split("-")[1])}</SlideCoverPositionFrame>}
    {children && <div data-slide-cover-objects className="pointer-events-none absolute inset-0 z-20">{children}</div>}
    <SlideFooter master={master} number={number} total={total} controls={controls} decorative={decorative} />
    {menuControl}
  </div>;
}
