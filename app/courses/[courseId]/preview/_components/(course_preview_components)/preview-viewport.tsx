"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PreviewDevice, PreviewOrientation } from "./preview-types";
import { previewFrameSize } from "./(preview_viewport_components)/preview-frame-size";

export function PreviewViewport({ device, orientation, fontFamily, onCompactChange, children }: {
  device: PreviewDevice; orientation: PreviewOrientation; fontFamily: string;
  onCompactChange: (compact: boolean) => void; children: ReactNode;
}) {
  const availableRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const landscape = orientation === "landscape";
  const framed = device !== "desktop";
  const size = previewFrameSize(device, orientation, available.width, available.height);

  useLayoutEffect(() => {
    const element = availableRef.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setAvailable((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [device, orientation]);

  useLayoutEffect(() => {
    const width = screenRef.current?.clientWidth;
    if (width) onCompactChange(width <= 640);
  }, [size.width, size.height, device, orientation, onCompactChange]);

  return (
    <div data-preview-viewport className={`min-h-0 min-w-0 flex-1 overflow-hidden ${framed ? "bg-slate-200 p-3 sm:p-6" : "bg-white"}`}>
      <div ref={availableRef} className="grid h-full min-h-0 w-full min-w-0 place-items-center overflow-hidden">
        <div
          data-preview-frame={device}
          style={{ fontFamily, ...(framed ? { width: size.width, height: size.height, visibility: size.width > 0 && size.height > 0 ? "visible" : "hidden" } as const : { width: "100%", height: "100%" }) }}
          className={!framed ? "min-h-0 min-w-0 overflow-hidden bg-white" : `relative box-border min-h-0 min-w-0 max-w-full max-h-full shrink-0 overflow-hidden border-[10px] border-solid border-slate-800 bg-slate-800 shadow-[0_24px_70px_-18px_rgba(15,23,42,0.55)] ${device === "mobile" ? `rounded-[3rem] ${landscape ? "p-2 pl-7" : "p-2 pt-7"}` : `rounded-[2rem] ${landscape ? "p-2 pl-5" : "p-2 pt-5"}`}`}
        >
          <div ref={screenRef} data-preview-screen className={`h-full min-h-0 w-full min-w-0 overflow-hidden bg-white ${!framed ? "" : device === "mobile" ? "rounded-[2.25rem]" : "rounded-[1.25rem]"}`}>
            {children}
          </div>
          {device === "mobile" ? (
            <span aria-hidden="true" className={`pointer-events-none absolute z-20 flex items-center justify-end rounded-full border border-slate-700 bg-slate-950 px-1.5 ${landscape ? "left-[9px] top-1/2 h-[74px] w-4 -translate-y-1/2 flex-col" : "left-1/2 top-[9px] h-4 w-[74px] -translate-x-1/2"}`}>
              <span className="size-1.5 rounded-full bg-slate-600" />
            </span>
          ) : device === "tablet" ? (
            <span aria-hidden="true" className={`pointer-events-none absolute z-20 size-1.5 rounded-full bg-slate-950 ring-1 ring-slate-600 ${landscape ? "left-[9px] top-1/2 -translate-y-1/2" : "left-1/2 top-[9px] -translate-x-1/2"}`} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
