"use client";
import type { ReactNode } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import { backgroundPaint, solidColor } from "@/lib/color";
import { SlideStage } from "./slide-stage";

export function InteractionPopupSurface({ popup, children }: { popup: Extract<ContentBlock, { type: "interactionButton" }>["data"]["popup"]; children: ReactNode }) {
  return <SlideStage size={popup} fillWidth className="w-full bg-transparent" style={{ height: `min(${popup.height}px, 60dvh, calc((100dvw - 5rem) * ${popup.height / popup.width}))` }} frameClassName="shadow-none" canvasClassName="rounded-none" canvasProps={{ "data-interaction-popup-canvas": true }}>
    <div className="relative h-full w-full" style={{ ...backgroundPaint(popup.backgroundColor), color: solidColor(popup.textColor) }}>
      {children}
    </div>
  </SlideStage>;
}
