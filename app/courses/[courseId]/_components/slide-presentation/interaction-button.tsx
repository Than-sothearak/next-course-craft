"use client";
/* eslint-disable @next/next/no-img-element -- Uploaded triggers also render in static exports. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InteractionIcon } from "@/components/interaction-icon";
import { backgroundPaint, parseGradient, solidColor, textPaint } from "@/lib/color";
import type { ContentBlock } from "@/lib/schemas/block";
import { SlidePlaybackContext, useSlidePlaybackActive } from "./slide-playback-context";

export function InteractionButton({ block, children, available = true, presentation = false, authoring = false, onOpen }: { block: Extract<ContentBlock, { type: "interactionButton" }>; children?: ReactNode; available?: boolean; presentation?: boolean; authoring?: boolean; onOpen?: () => void }) {
  const { data } = block;
  const position = data.position ?? "middle-center", buttonSize = data.buttonSize ?? 80;
  const [vertical, horizontal] = position.split("-");
  const size = `min(${buttonSize}px, 100cqw, 100cqh)`;
  const [open, setOpen] = useState(false);
  const [portalHost, setPortalHost] = useState<Element | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const active = useSlidePlaybackActive();
  function close() {
    body.current?.querySelectorAll("audio,video").forEach((media) => (media as HTMLMediaElement).pause());
    body.current?.closest("dialog")?.close();
    setOpen(false);
  }
  useEffect(() => {
    if (!open || !presentation || authoring || active) return;
    const frame = requestAnimationFrame(() => { body.current?.querySelectorAll("audio,video").forEach((media) => (media as HTMLMediaElement).pause()); setOpen(false); });
    return () => cancelAnimationFrame(frame);
  }, [open, presentation, authoring, active]);
  return <div data-interaction-button-container data-button-position={position} className="relative grid h-full w-full overflow-hidden" style={{ containerType: "size", height: presentation ? undefined : buttonSize, minHeight: presentation ? 0 : buttonSize, alignItems: vertical === "top" ? "start" : vertical === "bottom" ? "end" : "center", justifyItems: horizontal === "left" ? "start" : horizontal === "right" ? "end" : "center" }} onPointerDown={(event) => { if ((event.target as Element).closest("dialog")) event.stopPropagation(); }}>
    <Button aria-label={data.label} aria-haspopup="dialog" aria-expanded={open} disabled={!available} onClick={(event) => { setPortalHost(document.fullscreenElement ?? event.currentTarget.closest("[data-presentation-view], main") ?? document.body); setOpen(true); onOpen?.(); }} className={`relative flex min-h-0 min-w-0 flex-col gap-1 p-2 shadow-md ${data.radarEnabled ? "labeled-graphic-radar" : ""} ${parseGradient(data.radarColor) ? "labeled-graphic-radar-gradient" : ""}`} style={{ ...backgroundPaint(data.color), width: size, height: size, color: solidColor(data.iconColor), borderRadius: data.radius, "--radar-color": solidColor(data.radarColor), "--radar-gradient": data.radarColor, containerType: "size" } as CSSProperties}>
      <span className="relative z-10 flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 overflow-hidden">
        <span className={`flex min-h-0 w-full items-center justify-center ${data.showLabel ? "flex-1" : "h-full"}`}>
          {data.trigger === "image" && data.imageSrc ? <img src={data.imageSrc} alt={data.imageAlt || data.label} className="h-full w-full object-contain" /> : <InteractionIcon name={data.icon} size={data.iconSize} color={data.iconColor} className="max-h-full max-w-full shrink-0" />}
        </span>
        {data.showLabel && <span className="relative z-10 max-w-full shrink-0 truncate text-xs" style={textPaint(data.iconColor)}>{data.label}</span>}
      </span>
    </Button>
    {open && portalHost && createPortal(<Dialog open onClose={close} title={data.popup.title} className={`interaction-popup-${data.popup.animation} max-w-none bg-white`} style={{ width: data.popup.width + 48, maxWidth: "calc(100dvw - 2rem)" }}>
      <div ref={body}><SlidePlaybackContext.Provider value={true}>{children}</SlidePlaybackContext.Provider></div>
    </Dialog>, portalHost)}
  </div>;
}
