"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { TextFormattingToolbar } from "./text-formatting-toolbar";
import { TextFormattingPopupContext } from "./text-formatting-popup-context";

type Anchor = { left: number; right: number; top: number; bottom: number };
type Viewport = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type Placement = { target: Element; anchor: Anchor; style: CSSProperties };

function getViewport(): Viewport {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  return { left, right: left + width, top, bottom: top + height, width, height };
}

function getPopupStyle(anchor: Anchor, viewport: Viewport, measuredHeight: number): CSSProperties {
  const margin = 8;
  const gap = 8;
  const width = Math.max(1, Math.min(360, viewport.width - margin * 2));
  const desiredHeight = measuredHeight || 280;
  const maxViewportHeight = Math.max(1, viewport.height - margin * 2);
  const height = Math.min(desiredHeight, maxViewportHeight);
  const below = Math.max(0, viewport.bottom - margin - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - gap - viewport.top - margin);
  let maxHeight = height;
  let top: number;

  if (below >= height) {
    top = anchor.bottom + gap;
  } else if (above >= height) {
    top = anchor.top - gap - height;
  } else if (below >= above) {
    maxHeight = Math.max(1, Math.min(maxViewportHeight, below));
    top = anchor.bottom + gap;
  } else {
    maxHeight = Math.max(1, Math.min(maxViewportHeight, above));
    top = anchor.top - gap - maxHeight;
  }

  const minTop = viewport.top + margin;
  const maxTop = Math.max(minTop, viewport.bottom - margin - maxHeight);
  top = Math.max(minTop, Math.min(top, maxTop));

  const left = Math.max(viewport.left + margin, Math.min(anchor.left, viewport.right - margin - width));

  return { position: "fixed", width, left, top, maxHeight };
}

function sameStyle(a: CSSProperties, b: CSSProperties) {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.maxHeight === b.maxHeight;
}

function measurePopupHeight(popup: HTMLDivElement) {
  return popup.scrollHeight || popup.getBoundingClientRect().height;
}

function samePlacement(a: Placement | null, b: Placement) {
  return a?.target === b.target
    && a.anchor.left === b.anchor.left
    && a.anchor.right === b.anchor.right
    && a.anchor.top === b.anchor.top
    && a.anchor.bottom === b.anchor.bottom
    && sameStyle(a.style, b.style);
}

/** Keep selected-text controls outside clipped and scaled authoring canvases. */
export function SelectionTextFormattingPopup({ editor, allowLists = true }: { editor: Editor | null; allowLists?: boolean }) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupId = useId();

  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!popup || !placement) return;
    const style = getPopupStyle(placement.anchor, getViewport(), measurePopupHeight(popup));
    if (!sameStyle(placement.style, style)) setPlacement({ ...placement, style });
  }, [placement]);

  useEffect(() => {
    if (!editor) return;
    const activeEditor = editor;
    let dismissed = false;
    let selecting = false;
    let visible = false;
    let disposed = false;
    let usingToolbar = false;
    const source = activeEditor.view.dom;

    function owns(target: Node | null) {
      return Boolean(target && (popupRef.current?.contains(target)
        || (target instanceof Element && target.closest("[data-popover-owner]")?.getAttribute("data-popover-owner") === popupId)));
    }

    function close() {
      visible = false;
      setPlacement(null);
    }

    function update() {
      if (activeEditor.isDestroyed
        || !activeEditor.isEditable
        || dismissed
        || selecting
        || activeEditor.state.selection.empty
        || source.closest("[inert], [aria-hidden='true']")
        || (!usingToolbar && !activeEditor.isFocused && !owns(document.activeElement))) {
        close();
        return;
      }

      const viewport = getViewport();
      const coordinates = activeEditor.view.coordsAtPos(activeEditor.state.selection.head);
      let anchor: Anchor = {
        left: coordinates.left,
        right: coordinates.right,
        top: coordinates.top,
        bottom: coordinates.bottom,
      };

      if (anchor.bottom < viewport.top || anchor.top > viewport.bottom) {
        const selection = window.getSelection();
        if (selection?.rangeCount && selection.focusNode && source.contains(selection.focusNode)) {
          const visibleRects = Array.from(selection.getRangeAt(0).getClientRects())
            .filter((rect) => rect.bottom >= viewport.top && rect.top <= viewport.bottom);
          const closestRect = visibleRects.reduce<DOMRect | null>((closest, rect) => {
            if (!closest) return rect;
            return Math.abs(rect.top - anchor.top) < Math.abs(closest.top - anchor.top) ? rect : closest;
          }, null);
          if (closestRect) {
            anchor = { left: closestRect.left, right: closestRect.right, top: closestRect.top, bottom: closestRect.bottom };
          } else {
            close();
            return;
          }
        } else {
          close();
          return;
        }
      }

      const target = source.closest("dialog[open]") ?? document.fullscreenElement ?? document.body;
      const style = getPopupStyle(anchor, viewport, popupRef.current ? measurePopupHeight(popupRef.current) : 0);
      const next = { target, anchor, style };
      visible = true;
      setPlacement((current) => samePlacement(current, next) ? current : next);
    }

    function selected() {
      dismissed = false;
      update();
    }

    function blur({ event }: { event: FocusEvent }) {
      if (event.relatedTarget instanceof Node) {
        usingToolbar = owns(event.relatedTarget);
      }
      // Trusted pointer events can run microtasks between blur and focus. Keep
      // ownership from pointerdown/relatedTarget while a native control opens.
      queueMicrotask(() => {
        if (!disposed) update();
      });
    }

    function transaction({ transaction }: { transaction: Transaction }) {
      // Tiptap dispatches its blur transaction before the new control has focus.
      // The blur handler above checks ownership after that transfer completes.
      if (!transaction.getMeta("blur")) update();
    }

    function pointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      usingToolbar = owns(event.target);
      if (usingToolbar) return;
      if (source.contains(event.target)) {
        selecting = true;
        dismissed = false;
      } else {
        dismissed = true;
      }
      close();
    }

    function pointerUp() {
      if (selecting) {
        selecting = false;
        update();
      }
    }

    function focusIn(event: FocusEvent) {
      if (event.target instanceof Node) usingToolbar = owns(event.target);
      if (event.target instanceof Node && !source.contains(event.target) && !owns(event.target)) {
        dismissed = true;
        close();
      }
    }

    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !visible) return;
      // Let the color panel handle its own Escape before closing this toolbar.
      if (Array.from(document.querySelectorAll('[data-popover-owner][data-state="open"]')).some((panel) => panel.getAttribute("data-popover-owner") === popupId)) return;
      event.preventDefault();
      event.stopPropagation();
      dismissed = true;
      usingToolbar = false;
      close();
      if (!activeEditor.isDestroyed) activeEditor.commands.focus();
    }

    function reposition() {
      if (visible) update();
    }

    activeEditor.on("selectionUpdate", selected);
    activeEditor.on("focus", update);
    activeEditor.on("blur", blur);
    activeEditor.on("transaction", transaction);
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerup", pointerUp, true);
    document.addEventListener("pointercancel", pointerUp, true);
    document.addEventListener("focusin", focusIn, true);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    const frame = requestAnimationFrame(update);
    const panel = source.closest("[data-accordion-panel]");
    const observer = panel ? new MutationObserver(update) : null;
    if (panel) observer?.observe(panel, { attributes: true, attributeFilter: ["inert", "aria-hidden"] });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      activeEditor.off("selectionUpdate", selected);
      activeEditor.off("focus", update);
      activeEditor.off("blur", blur);
      activeEditor.off("transaction", transaction);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointerup", pointerUp, true);
      document.removeEventListener("pointercancel", pointerUp, true);
      document.removeEventListener("focusin", focusIn, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [editor, popupId]);

  if (!editor || editor.isDestroyed || !placement) return null;
  return createPortal(<div
    ref={popupRef}
    data-text-selection-popup
    role="dialog"
    aria-label="Text formatting"
    className="z-[100] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-xl"
    style={placement.style}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
  >
    <div className="mb-2 px-1 text-xs font-medium text-slate-500">Edit text format</div>
    <TextFormattingPopupContext value={popupId}>
      <TextFormattingToolbar editor={editor} allowLists={allowLists} />
    </TextFormattingPopupContext>
  </div>, placement.target);
}
