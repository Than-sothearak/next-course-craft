"use client";
import type { ReactNode } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import { resolveSlideFrame } from "@/lib/editor/slide-design";
import { isSlideMediaObject } from "@/lib/editor/slide-objects";
import { backgroundPaint, solidColor } from "@/lib/color";
import { SlideStage } from "./slide-stage";
import { SlideObjectContent } from "./slide-object-content";
import { slideObjectSurfaceStyle } from "../../preview/_components/(course_preview_components)/preview-utils";

export function InteractionPopupSurface({ popup, blocks, renderBlock }: { popup: Extract<ContentBlock, { type: "interactionButton" }>["data"]["popup"]; blocks: readonly ContentBlock[]; renderBlock: (block: ContentBlock) => ReactNode }) {
  return <SlideStage size={popup} fillWidth className="w-full bg-transparent" style={{ height: `min(${popup.height}px, 60dvh, calc((100dvw - 5rem) * ${popup.height / popup.width}))` }} frameClassName="shadow-none" canvasClassName="rounded-none" canvasProps={{ "data-interaction-popup-canvas": true }}>
    <div className="relative h-full w-full" style={{ ...backgroundPaint(popup.backgroundColor), color: solidColor(popup.textColor) }}>
      {blocks.map((block, index) => { const frame = resolveSlideFrame(block, index, blocks.length, popup); return <div key={block.id} data-popup-object={block.id} className="absolute overflow-hidden" style={{ left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.width}%`, height: `${frame.height}%`, zIndex: frame.z + 1, ...slideObjectSurfaceStyle(block, popup.backgroundColor, popup.textColor) }}><SlideObjectContent media={isSlideMediaObject(block)}>{renderBlock(block)}</SlideObjectContent></div>; })}
    </div>
  </SlideStage>;
}
