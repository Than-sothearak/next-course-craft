"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Keep the whole slide title visible on the single line used by the editor. */
export function FittedSlideTitle({ title, visible = true, fontSize: titleFontSize = 32 }: { title: string; visible?: boolean; fontSize?: number }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(titleFontSize);

  useLayoutEffect(() => {
    if (!visible) return;
    const text = textRef.current;
    const header = text?.parentElement;
    if (!text || !header) return;
    function measure() {
      if (!text || !header || !header.clientWidth || !text.scrollWidth) return;
      const renderedFontSize = Number.parseFloat(text.style.fontSize) || titleFontSize;
      const fullWidth = text.scrollWidth * titleFontSize / renderedFontSize;
      const availableWidth = Math.max(1, header.clientWidth - 2);
      const next = Math.max(1, Math.min(titleFontSize, Math.floor(titleFontSize * availableWidth / fullWidth * 100) / 100));
      setFontSize((current) => Math.abs(current - next) < 0.01 ? current : next);
    }
    measure();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(header);
    document.fonts?.addEventListener("loadingdone", measure);
    window.addEventListener("resize", measure);
    return () => {
      resize?.disconnect();
      document.fonts?.removeEventListener("loadingdone", measure);
      window.removeEventListener("resize", measure);
    };
  }, [title, visible, titleFontSize]);

  return <span ref={textRef} data-slide-title-text title={title} className="block w-max whitespace-nowrap" style={{ fontSize, lineHeight: `${Math.max(40, titleFontSize * 1.25)}px` }}>{title}</span>;
}
