"use client";

import { createContext, useContext, useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CircleHelp, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SvgGradient } from "@/components/svg-gradient";
import type { SlideNavigationGuide } from "@/lib/editor/slide-design";
import { backgroundPaint, parseGradient, textPaint } from "@/lib/color";
import { navigationButtonPaint, navigationLayout, resolveNavigationButtons, type NavigationButtonKey, type SlideNavigationButtons } from "@/lib/editor/slide-navigation-design";

type NavigationDesign = { settings: SlideNavigationButtons; availableWidth: number; availableHeight: number; canvasWidth: number; rightInset: number; tipMaxHeight: number };
const DesignContext = createContext<NavigationDesign | null>(null);
export function SlideNavigationDesignProvider({ children, ...design }: NavigationDesign & { children: ReactNode }) {
  return <DesignContext.Provider value={design}>{children}</DesignContext.Provider>;
}

function NavigationTip({ id, step, guide, onStep, lockHint, left, bottom, arrowLeft, maxHeight }: { id: string; step: number; guide: SlideNavigationGuide; onStep: (step: number | null) => void; lockHint?: string; left: number; bottom: number; arrowLeft: number; maxHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const titles = ["Move to the next slide", "Return to a previous slide", "Replay this slide"];
  const messages = [guide.nextText, guide.previousText, guide.restartText];
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>("[data-guide-advance]")?.focus({ preventScroll: true }); }, [step]);
  return <div ref={ref} id={id} role="dialog" aria-label="Navigation guide" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onStep(null); } }} className="absolute z-50 w-64 rounded-2xl border border-indigo-200 bg-white text-left text-slate-800 shadow-xl" style={{ left, bottom }}>
    <div className="overflow-y-auto rounded-2xl p-3" style={{ maxHeight }}>
      <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-medium uppercase tracking-wide text-indigo-600">Navigation help · {step + 1} of 3</p><h3 className="mt-1 text-sm font-semibold">{titles[step]}</h3></div><Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label="Dismiss navigation guide" onClick={() => onStep(null)}><X size={13} aria-hidden="true" /></Button></div>
      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{messages[step]}</p>
      {step === 0 && lockHint && <p className="mt-2 text-[11px] leading-4 text-amber-700">{lockHint}</p>}
      <div className="mt-3 flex items-center justify-between gap-2"><Button variant="ghost" size="sm" className="min-h-7 px-2 text-xs" onClick={() => onStep(null)}>Skip guide</Button><Button data-guide-advance size="sm" className="min-h-7 px-2 text-xs" onClick={() => onStep(step === 2 ? null : step + 1)}>{step === 2 ? "Got it" : "Next tip"}</Button></div>
    </div>
    <svg data-navigation-tip-arrow aria-hidden="true" width="20" height="12" viewBox="0 0 20 12" className="pointer-events-none absolute" style={{ top: "calc(100% - 1px)", left: arrowLeft - 10 }}><path d="M0 0.5 10 11 20 0.5" fill="white" stroke="#c7d2fe" strokeLinejoin="round" /></svg>
  </div>;
}

export function SlideNavigationControls({ previousDisabled, nextDisabled, previousHint, nextHint, onPrevious, onNext, onRestart, guide, guideStep = null, onGuideStep }: {
  previousDisabled: boolean; nextDisabled: boolean; previousHint?: string; nextHint?: string;
  onPrevious: () => void; onNext: () => void; onRestart: (event: MouseEvent<HTMLButtonElement>) => void;
  guide?: SlideNavigationGuide; guideStep?: number | null; onGuideStep?: (step: number | null) => void;
}) {
  const design = useContext(DesignContext);
  const settings = design?.settings ?? resolveNavigationButtons();
  const help = Boolean(guide?.enabled && onGuideStep);
  const layout = navigationLayout(settings, help, design?.availableWidth, design?.availableHeight);
  const width = layout.width * layout.scale, height = layout.height * layout.scale;
  const tipId = useId();
  const targets: NavigationButtonKey[] = ["next", "previous", "restart"];
  const active = help && guideStep !== null ? layout.items.find((item) => item.key === targets[guideStep]) : undefined;
  const anchorX = active ? (active.x + active.width / 2) * layout.scale : 0;
  const idealLeft = guideStep === 0 ? width - 256 : guideStep === 1 ? 0 : anchorX - 128;
  const left = Math.max(width + (design?.rightInset ?? 20) - (design?.canvasWidth ?? 960) + 8, Math.min(width + (design?.rightInset ?? 20) - 264, idealLeft));
  const controls = { previous: { disabled: previousDisabled, hint: previousHint, click: onPrevious, label: "Previous", Icon: ArrowLeft }, restart: { disabled: false, hint: "Replay this slide's video and audio", click: onRestart, label: "Restart slide", Icon: RotateCcw }, next: { disabled: nextDisabled, hint: nextHint, click: onNext, label: "Next", Icon: ArrowRight } };
  return <div data-slide-navigation-layout className="relative z-30 shrink-0" style={{ width, height }}>
    <nav aria-label="Slide navigation" data-compact-navigation={!layout.showLabels || undefined} className="absolute left-0 top-0 flex items-center" style={{ width: layout.width, height: layout.height, gap: layout.gap, transform: layout.scale < 1 ? `scale(${layout.scale})` : undefined, transformOrigin: "top left" }}>
      {help && <Button variant="ghost" size="icon" className="shrink-0 text-inherit" style={{ width: layout.helpSize, height: layout.helpSize }} aria-label="Show navigation guide" title="Navigation help" onClick={() => onGuideStep?.(0)}><CircleHelp size={16} aria-hidden="true" /></Button>}
      {layout.items.map(({ key, appearance, width: buttonWidth, height: buttonHeight, depth }) => {
        const control = controls[key], Icon = control.Icon;
        const gradientId = `${tipId.replace(/:/g, "")}-${key}-icon`;
        const icon = <Icon size={Math.min(appearance.iconSize, buttonHeight - 2 * appearance.borderWidth - 4)} aria-hidden="true" className="relative z-10 shrink-0" stroke={parseGradient(appearance.textColor) ? `url(#${gradientId})` : "currentColor"}><SvgGradient id={gradientId} value={appearance.textColor} /></Icon>;
        return <div key={key} className="relative shrink-0" style={{ width: buttonWidth, height: buttonHeight + depth }}>
          {depth > 0 && <span data-navigation-button-depth aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" style={{ ...backgroundPaint(appearance.borderColor), height: buttonHeight, borderRadius: appearance.radius, transform: `translateY(${depth}px)`, opacity: control.disabled ? 0.5 : 1 }} />}
          <Button variant="ghost" size="sm" data-navigation-button={key} data-navigation-button-style={appearance.style} aria-label={control.label} aria-describedby={active?.key === key ? tipId : undefined} title={control.hint ?? control.label} disabled={control.disabled} onClick={control.click} className="relative z-10 overflow-hidden py-0 transition-[filter,transform] hover:brightness-110 active:translate-y-px" style={{ ...navigationButtonPaint(appearance), width: buttonWidth, paddingInline: key === "restart" || !layout.showLabels ? 0 : appearance.paddingX }}>
            {key !== "next" && icon}
            {key !== "restart" && layout.showLabels && <span className="relative z-10" style={textPaint(appearance.textColor)}>{control.label}</span>}
            {key === "next" && icon}
            {parseGradient(appearance.borderColor) && appearance.borderWidth > 0 && <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ ...backgroundPaint(appearance.borderColor), borderRadius: "inherit", padding: appearance.borderWidth, mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", maskComposite: "exclude" }} />}
          </Button>
        </div>;
      })}
    </nav>
    {active && guide && onGuideStep && guideStep !== null && <NavigationTip id={tipId} step={guideStep} guide={guide} onStep={onGuideStep} lockHint={nextHint} left={left} bottom={height - (layout.height - active.height - active.depth) / 2 * layout.scale + 12} arrowLeft={Math.max(12, Math.min(244, anchorX - left))} maxHeight={design?.tipMaxHeight ?? 360} />}
  </div>;
}
