"use client";
/* eslint-disable @next/next/no-img-element -- Shared browser-only slide renderer. */
import { useId } from "react";
import { masterSlideNumber, type SlideMaster } from "@/lib/slides/master-schema";
import type { LearningPage } from "@/lib/slides/blocks";

export const masterFont = (font: "sans" | "serif" | "rounded") => font === "serif" ? "Georgia, 'Times New Roman', serif" : font === "rounded" ? "'Trebuchet MS', Arial, sans-serif" : "Arial, sans-serif";

/** Protected decoration: it has no selection targets and never captures foreground input. */
export function MasterSurface({ master, title = "Slide title", order = 0, numbering }: { master?: SlideMaster; title?: string; order?: number; numbering?: LearningPage["numbering"] }) {
  const id = `master-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!master?.enabled) return null;
  const { background: bg, header, content, footer } = master;
  const number = masterSlideNumber(master, order, numbering);
  const patternSize = bg.patternSize / bg.density;
  return <div data-slide-master={master.name} className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: 1280, height: 720 }}>
    <div data-master-background className="absolute inset-0" style={{ opacity: bg.opacity, background: bg.type === "transparent" ? "transparent" : bg.type === "gradient" || bg.type === "geometric" ? `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.secondaryColor})` : bg.color }}>
      {bg.type === "image" && bg.imageSrc && <img src={bg.imageSrc} alt="" className="h-full w-full object-cover" style={{ objectPosition: bg.imagePosition }} />}
      {bg.type === "geometric" && <svg aria-hidden="true" width="1280" height="720" className="absolute inset-0"><defs><pattern id={id} width={patternSize} height={patternSize} patternUnits="userSpaceOnUse"><path d={`M0 0 L${patternSize} 0 L${patternSize / 2} ${patternSize / 2}Z M0 ${patternSize} L${patternSize / 2} ${patternSize / 2} L${patternSize} ${patternSize}Z`} fill={bg.patternColor} /><path d={`M0 0 L${patternSize / 2} ${patternSize / 2} L0 ${patternSize}Z`} fill={bg.patternColor} opacity=".45" /></pattern><linearGradient id={`${id}-fade`}><stop stopColor="white" stopOpacity=".9" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient></defs><rect width="1280" height="720" fill={`url(#${id})`} opacity={bg.patternOpacity} /><rect width="1280" height="720" fill={`url(#${id}-fade)`} /></svg>}
    </div>
    <div data-master-content className="absolute" style={{ left: content.x, top: content.y, width: content.width, height: content.height, borderRadius: content.radius, background: content.color, opacity: content.opacity }} />
    {header.enabled && <div data-master-header className="absolute top-0 left-0 w-full overflow-hidden" style={{ height: header.height, background: "white" }}>
      <svg aria-hidden="true" width={header.bannerWidth} height={header.height} className="absolute top-0 left-0"><polygon fill={header.color} points={`0,0 ${header.bannerWidth - (header.shape === "angled" ? header.angleWidth : 0)},0 ${header.bannerWidth},${header.height} 0,${header.height}`} /></svg>
      <div data-master-title className="absolute flex items-center overflow-hidden whitespace-pre-wrap leading-tight" style={{ left: 24, right: 1280 - header.bannerWidth + (header.shape === "angled" ? header.angleWidth / 2 : 0) + 24, transform: `translateX(${header.title.offsetX}px)`, top: header.title.offsetY, height: header.height, fontFamily: masterFont(header.title.fontFamily), fontSize: header.title.fontSize, color: header.title.color, fontWeight: 700, justifyContent: header.title.alignment === "left" ? "flex-start" : header.title.alignment === "right" ? "flex-end" : "center", textAlign: header.title.alignment }}>{title}</div>
      {header.logo.visible && <div data-master-logo className="absolute flex items-center justify-center overflow-hidden" style={{ left: header.logo.x, top: header.logo.y, width: header.logo.width, height: header.logo.height }}>{header.logo.src ? <img src={header.logo.src} alt={header.logo.alt} className="h-full w-full object-contain" /> : <div aria-label="Institution logo placeholder" className="flex aspect-square h-full max-w-full items-center justify-center rounded-full border-2 border-emerald-700 text-center font-serif text-emerald-700" style={{ fontSize: Math.min(header.logo.width, header.logo.height) / 5 }}>LOGO</div>}</div>}
    </div>}
    {footer.enabled && <div data-master-footer className="absolute bottom-0 left-0 flex w-full items-center overflow-hidden" style={{ height: footer.height, background: footer.color }}>
      <div data-master-footer-text className="w-full overflow-hidden whitespace-pre-wrap" style={{ paddingLeft: footer.textStyle.inset, paddingRight: number === null ? footer.textStyle.inset : footer.number.right + footer.number.size + 24, fontFamily: masterFont(footer.textStyle.fontFamily), fontSize: footer.textStyle.fontSize, color: footer.textStyle.color, textAlign: footer.textStyle.alignment }}>{footer.text}</div>
      {number !== null && <div data-master-number className="absolute flex items-center justify-center overflow-hidden" style={{ right: footer.number.right, width: Math.min(footer.number.size, footer.height), height: Math.min(footer.number.size, footer.height), borderRadius: footer.number.style === "circle" ? "50%" : footer.number.style === "square" ? 6 : 0, background: footer.number.style === "plain" ? "transparent" : footer.number.backgroundColor, color: footer.number.color, fontSize: footer.number.fontSize, fontFamily: "Arial, sans-serif" }}>{number}</div>}
    </div>}
  </div>;
}
