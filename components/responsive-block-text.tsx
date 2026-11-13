"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Scale rendered text only. Slide canvases already scale their full contents. */
export function ResponsiveBlockText({ children, className, enabled = true }: {
  children: ReactNode;
  className?: string;
  enabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    const screen = root.closest<HTMLElement>("[data-preview-screen]") ?? root;
    let frame = 0;
    let disposed = false;
    let measured: Element[] = [];
    const typography = (style: string | null) => (style ?? "")
      .split(";")
      .map((declaration) => declaration.trim())
      .filter((declaration) => /^(?:font(?:-[\w-]+)?|line-height|--[\w-]*(?:font|text)[\w-]*)\s*:/i.test(declaration))
      .join(";");
    const mutations = new MutationObserver((records) => {
      // Entrance animations and physics update transforms every frame. They
      // must not trigger font measurements across the whole lesson.
      if (records.some((record) => record.attributeName !== "style" ||
        typography(record.oldValue) !== typography((record.target as Element).getAttribute("style")))) schedule();
    });
    const observe = () => mutations.observe(root, {
      subtree: true, childList: true, attributes: true,
      attributeOldValue: true,
      attributeFilter: ["style", "class", "hidden", "open"],
    });
    const update = () => {
      if (disposed) return;
      mutations.disconnect();
      // Measure unscaled styles together before writing, avoiding compounded
      // inheritance, inline-size overrides and repeated layout per element.
      root.removeAttribute("data-mobile-block-text");
      for (const element of measured) {
        (element as HTMLElement).style.removeProperty("--block-rendered-font-size");
      }
      measured = [];
      const width = screen.clientWidth;
      if (width > 0 && width <= 640) {
        measured = [root, ...root.querySelectorAll<HTMLElement | SVGElement>("*")]
          .filter((element) => {
            const boundary = element.closest('[data-block-text-canvas], [contenteditable="true"]');
            return !boundary || boundary === element;
          });
        const sizes = measured.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        measured.forEach((element, index) => {
          const size = sizes[index];
          if (Number.isFinite(size) && size > 0) {
            // Interactive content uses compact phone typography. Ordinary
            // lesson text keeps its separate heading/body limits.
            const preserve = element.matches('[data-block-text-canvas], [contenteditable="true"]');
            const textRole = element.closest('h1, h2, h3, h4, h5, h6, legend, [role="heading"], [data-block-text-role]');
            const title = textRole && textRole.getAttribute("data-block-text-role") !== "body";
            const interactive = Boolean(element.closest("[data-interactive-block]"));
            const limit = interactive ? (title ? 18 : 14) : (title ? 22 : 16);
            (element as HTMLElement).style.setProperty("--block-rendered-font-size", `${preserve ? size : Math.min(limit, size)}px`);
          }
        });
        root.setAttribute("data-mobile-block-text", "");
      }
      if (width > 0 && width <= 640) observe();
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    resize?.observe(screen);
    window.addEventListener("resize", schedule);
    // Webfont loading can change inherited styles after the first render.
    document.fonts?.addEventListener("loadingdone", schedule);
    update();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", schedule);
      document.fonts?.removeEventListener("loadingdone", schedule);
      root.removeAttribute("data-mobile-block-text");
      for (const element of measured) {
        (element as HTMLElement).style.removeProperty("--block-rendered-font-size");
      }
    };
  }, [enabled]);

  return <div ref={rootRef} className={className} data-block-text-canvas={!enabled || undefined}>{children}</div>;
}
