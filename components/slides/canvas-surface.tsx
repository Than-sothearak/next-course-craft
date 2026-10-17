"use client";

/* eslint-disable @next/next/no-img-element -- Browser-only learner surface is shared with future static exports. */
import type { CSSProperties, PointerEvent, KeyboardEvent } from "react";
import type { SlideAction, SlideObject, SlideRecord } from "@/lib/slides/schema";

export type CanvasOverrides = Record<string, { visible?: boolean; stateId?: string }>;
export type CanvasAuthoring = {
  selectedId: string | null;
  advanced: boolean;
  disabled?: boolean;
  onSelect: (id: string | null) => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>, object: SlideObject, mode: "move" | "resize") => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>, object: SlideObject) => void;
};
export function CanvasSurface({ slide, overrides = {}, onAction, authoring, staticPreview = false }: { slide: SlideRecord; overrides?: CanvasOverrides; onAction?: (actions: SlideAction[]) => void; authoring?: CanvasAuthoring; staticPreview?: boolean }) {
  return <div data-canvas-slide className="relative aspect-video w-full overflow-hidden" style={{ containerType: "inline-size", backgroundColor: slide.background.color }} onClick={() => authoring?.onSelect(null)}>
    {[...slide.objects].sort((a, b) => a.zIndex - b.zIndex).map((object) => {
      const override = overrides[object.id];
      const state = object.states.find((candidate) => candidate.id === (override?.stateId ?? object.activeStateId));
      const visible = override?.visible ?? state?.visible ?? object.visible;
      if (!visible && !authoring) return null;
      const content = state?.content ?? object.content, style = { ...object.style, ...state?.style };
      const interactive = !staticPreview && Boolean(authoring || object.actions.length);
      const css: CSSProperties = {
        position: "absolute", left: `${object.x / 12.8}%`, top: `${object.y / 7.2}%`, width: `${object.width / 12.8}%`, height: `${(object.type === "shape" && object.content === "line" ? 4 : object.height) / 7.2}%`,
        zIndex: object.zIndex, transform: `rotate(${object.rotation}deg)`, opacity: visible ? style.opacity : .3,
        color: style.color, backgroundColor: object.type === "image" || object.type === "video" ? "#f1f5f9" : style.backgroundColor,
        border: `${style.borderWidth / 12.8}cqw solid ${style.borderColor}`, borderRadius: object.type === "shape" && object.content === "ellipse" ? "50%" : `${style.borderRadius / 12.8}cqw`,
        fontSize: `${style.fontSize / 12.8}cqw`, fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 }[style.fontWeight], textAlign: style.textAlign,
        display: "grid", placeItems: style.textAlign === "left" ? "center start" : "center", padding: ".94cqw", whiteSpace: "pre-wrap", overflowWrap: "anywhere", touchAction: authoring?.advanced ? "none" : "auto",
      };
      return <div key={object.id} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-label={authoring ? `${object.type} object` : object.type === "image" ? object.alt || "Image interaction" : object.content || `${object.type} interaction`} className={`overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${authoring?.selectedId === object.id ? "outline-2 outline-indigo-500" : ""} ${interactive ? authoring?.advanced ? "cursor-move" : "cursor-pointer" : ""}`} style={css}
        onClick={(event) => { event.stopPropagation(); if (authoring) authoring.onSelect(object.id); else onAction?.(object.actions); }}
        onPointerDown={authoring?.advanced && !authoring.disabled ? (event) => authoring.onPointerDown?.(event, object, "move") : undefined}
        onKeyDown={(event) => {
          if (authoring?.advanced) authoring.onKeyDown?.(event, object);
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (authoring) authoring.onSelect(object.id); else onAction?.(object.actions); }
        }}>
        {object.type === "image" ? content ? <img src={content} alt={object.alt} className={`absolute inset-0 size-full object-cover ${authoring ? "pointer-events-none" : ""}`} /> : <span className="text-[1.5cqw] text-slate-500">Choose an image</span> : object.type === "video" ? content ? <video src={content} controls={!authoring && !staticPreview} className={`size-full object-contain ${authoring ? "pointer-events-none" : ""}`} /> : <span className="text-[1.5cqw] text-slate-500">Choose a video</span> : object.type === "shape" ? null : content}
        {authoring?.advanced && authoring.selectedId === object.id && <button type="button" aria-label="Resize object" disabled={authoring.disabled} className="absolute right-0 bottom-0 size-4 cursor-se-resize border-2 border-white bg-indigo-600" onPointerDown={(event) => authoring.onPointerDown?.(event, object, "resize")} />}
      </div>;
    })}
  </div>;
}
