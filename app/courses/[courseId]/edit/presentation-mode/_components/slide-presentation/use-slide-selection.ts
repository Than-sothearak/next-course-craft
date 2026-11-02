"use client";

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { createClientId } from "@/lib/client-id";
import type { ContentBlock } from "@/lib/schemas/block";
import { resolveSlideFrame, type SlideSize } from "@/lib/editor/slide-design";
import { appendSlideObjects } from "@/lib/editor/slide-clipboard";
import { alignSlideSelection, distributeSlideSelection, editableSelection, groupSlideSelection, moveSlideSelection, normalizeSlideGroups, removeSlideSelection, resizeSlideSelection, selectionBounds, slideSelectionIds, slideSelectionUnits, ungroupSlideSelection } from "@/lib/editor/slide-selection";

export type SelectionCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
const textTarget = 'input, textarea, select, audio, video, [contenteditable], [role="textbox"], [role="slider"], [role="tablist"], [role="menu"]';
type Modifiers = { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean };
type Gesture = { pointerId: number; target: HTMLElement; bounds: DOMRect; startX: number; startY: number; blocks: ContentBlock[]; ids: string[]; kind: "move" | "resize" | "marquee"; corner?: SelectionCorner; additive?: boolean; objectId?: string };

export function useSlideSelection({ blocks, area, scopeRef, onBlocksChange, initialSelectedId, maximum = 500, cover = false }: {
  blocks: ContentBlock[]; area: SlideSize; scopeRef: RefObject<HTMLElement | null>; onBlocksChange: (blocks: ContentBlock[]) => void; initialSelectedId?: string; maximum?: number; cover?: boolean;
}) {
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const [ids, setIds] = useState<string[]>(() => initialSelectedId ? slideSelectionIds(blocks, initialSelectedId) : []);
  const idsRef = useRef(ids);
  const [memberGroupId, setMemberGroupId] = useState<string | null>(null);
  const memberRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<ContentBlock[] | null>(null);
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ id: string; time: number; x: number; y: number } | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const selectedIds = ids.filter((id) => blocks.some((block) => block.id === id));
  const selectedId = selectedIds.at(-1) ?? null;
  const units = slideSelectionUnits(blocks);
  const lockedIds = new Set(units.filter((unit) => unit.locked).flatMap((unit) => unit.blocks.map((block) => block.id)));
  const hiddenIds = new Set(units.filter((unit) => unit.hidden).flatMap((unit) => unit.blocks.map((block) => block.id)));
  const editable = editableSelection(blocks, selectedIds);
  function selectIds(next: string[]) { idsRef.current = next; setIds(next); }
  function memberMode(id: string | null) { memberRef.current = id; setMemberGroupId(id); }
  function clear() { selectIds([]); memberMode(null); }
  function selectObject(id: string, modifiers: Modifiers = {}) {
    const block = blocks.find((item) => item.id === id); if (!block) return;
    if (memberRef.current && block.slideGroupId !== memberRef.current) memberMode(null);
    const next = slideSelectionIds(blocks, id, memberRef.current);
    if (modifiers.shiftKey || modifiers.ctrlKey || modifiers.metaKey) {
      if (lockedIds.has(id) || hiddenIds.has(id)) return;
      const current = idsRef.current.filter((item) => !lockedIds.has(item) && !hiddenIds.has(item));
      selectIds(next.every((item) => current.includes(item)) ? current.filter((item) => !next.includes(item)) : [...new Set([...current, ...next])]);
    } else if (!idsRef.current.includes(id) || lockedIds.has(id) || hiddenIds.has(id)) selectIds(next);
  }
  function selectLayer(id: string, modifiers: Modifiers = {}) {
    memberMode(null);
    if (modifiers.shiftKey || modifiers.ctrlKey || modifiers.metaKey) selectObject(id, modifiers);
    else selectIds(slideSelectionIds(blocks, id));
  }
  function enterMember(id: string) {
    const block = blocks.find((item) => item.id === id);
    if (!block?.slideGroupId || lockedIds.has(id) || hiddenIds.has(id)) return;
    cancel(); lastTap.current = null; memberMode(block.slideGroupId); selectIds([id]);
  }
  function commit(next: ContentBlock[]) {
    if (next === blocksRef.current || JSON.stringify(next) === JSON.stringify(blocksRef.current)) return;
    onBlocksChange(next); blocksRef.current = next; setNotice(null);
  }
  function paste(sources: ContentBlock[]) {
    const current = blocksRef.current;
    if (current.length + sources.length > maximum) throw new Error(`This canvas can contain up to ${maximum} objects. Nothing was pasted.`);
    if (cover && sources.some((block) => block.type !== "audioInstruction")) throw new Error("A cover slide can contain only audio instruction objects.");
    const next = appendSlideObjects(sources, current, createClientId);
    const updated = normalizeSlideGroups(next.blocks);
    onBlocksChange(updated); blocksRef.current = updated; memberMode(null); selectIds(next.selectedIds); setNotice(null);
  }
  function duplicate() {
    if (!editable) return;
    try { paste(blocks.flatMap((block, index) => selectedIds.includes(block.id) ? [{ ...block, slideFrame: resolveSlideFrame(block, index, blocks.length, area) }] : [])); } catch (error) { setNotice({ message: error instanceof Error ? error.message : "These objects could not be duplicated.", error: true }); }
  }
  function remove() { if (editable) { commit(removeSlideSelection(blocks, selectedIds)); clear(); } }
  function group() { if (!memberRef.current && editable && selectedIds.length > 1) { commit(groupSlideSelection(blocks, selectedIds, createClientId(), area)); memberMode(null); } }
  function ungroup() { if (editable) { commit(ungroupSlideSelection(blocks, selectedIds)); memberMode(null); } }
  function toggleFlag(id: string, field: "slideLocked" | "slideHiddenInEditor") {
    const unit = units.find((item) => item.blocks.some((block) => block.id === id)); if (!unit) return;
    const next = field === "slideLocked" ? !unit.locked : !unit.hidden;
    const members = new Set(unit.blocks.map((block) => block.id));
    commit(blocks.map((block) => members.has(block.id) ? { ...block, [field]: next } : block));
    clear();
  }
  function cancel() {
    const current = gesture.current; gesture.current = null;
    setPreview(null); setMarquee(null);
    if (current?.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
  }
  useEffect(() => () => {
    const current = gesture.current; gesture.current = null;
    if (current?.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
  }, []);
  function start(event: PointerEvent<HTMLElement>, kind: Gesture["kind"], nextIds = selectedIds, corner?: SelectionCorner) {
    if (event.button !== 0 || gesture.current || (kind !== "marquee" && !editableSelection(blocks, nextIds))) return;
    const canvas = (event.target as Element).closest<HTMLElement>("[data-slide-canvas]");
    const bounds = canvas?.getBoundingClientRect(), target = scopeRef.current;
    if (!bounds?.width || !bounds.height || !target) return;
    gesture.current = { pointerId: event.pointerId, target, bounds, startX: event.clientX, startY: event.clientY, blocks, ids: nextIds, kind, corner, additive: event.shiftKey || event.ctrlKey || event.metaKey };
    if (kind !== "marquee") setPreview(blocks);
    target.focus({ preventScroll: true }); target.setPointerCapture?.(event.pointerId);
    event.preventDefault(); event.stopPropagation();
  }
  function objectPointerDown(id: string, event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) return false;
    if (lockedIds.has(id) || hiddenIds.has(id)) return true;
    if ((event.target as Element).closest("[data-slide-resize-handle], [data-slide-rotation-handle], [data-slide-move-handle]")) return false;
    selectObject(id, event);
    if (event.shiftKey || event.ctrlKey || event.metaKey) return true;
    const nextIds = idsRef.current;
    if (nextIds.length > 1) { start(event, "move", nextIds); if (gesture.current) gesture.current.objectId = id; return true; }
    return false;
  }
  function backgroundPointerDown(event: PointerEvent<HTMLElement>) {
    const target = event.target as Element;
    if (!target.closest("[data-slide-canvas]") || target.closest("dialog[open]") !== scopeRef.current?.closest("dialog[open]") || target.closest(`[data-slide-object-frame], [data-slide-selection], button, a, ${textTarget}`)) return;
    start(event, "marquee", idsRef.current);
  }
  function calculate(event: PointerEvent<HTMLElement>, current: Gesture) {
    const dx = (event.clientX - current.startX) / current.bounds.width * 100, dy = (event.clientY - current.startY) / current.bounds.height * 100;
    if (current.kind === "move") return moveSlideSelection(current.blocks, current.ids, { x: dx, y: dy }, area);
    const box = selectionBounds(current.blocks, current.ids, area)!;
    const left = current.corner!.endsWith("left"), top = current.corner!.startsWith("top");
    const anchor = { x: left ? box.right : box.left, y: top ? box.bottom : box.top };
    const vx = (left ? box.left - box.right : box.right - box.left) * current.bounds.width / 100;
    const vy = (top ? box.top - box.bottom : box.bottom - box.top) * current.bounds.height / 100;
    const scale = 1 + ((event.clientX - current.startX) * vx + (event.clientY - current.startY) * vy) / (vx * vx + vy * vy);
    return resizeSlideSelection(current.blocks, current.ids, scale, anchor, area);
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const current = gesture.current; if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (current.kind === "marquee") {
      const x1 = Math.max(0, Math.min(100, (current.startX - current.bounds.left) / current.bounds.width * 100)), x2 = Math.max(0, Math.min(100, (event.clientX - current.bounds.left) / current.bounds.width * 100));
      const y1 = Math.max(0, Math.min(100, (current.startY - current.bounds.top) / current.bounds.height * 100)), y2 = Math.max(0, Math.min(100, (event.clientY - current.bounds.top) / current.bounds.height * 100));
      setMarquee({ left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    } else setPreview(calculate(event, current));
  }
  function pointerUp(event: PointerEvent<HTMLElement>) {
    const current = gesture.current; if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (current.kind === "marquee") {
      const x1 = (current.startX - current.bounds.left) / current.bounds.width * 100, x2 = (event.clientX - current.bounds.left) / current.bounds.width * 100;
      const y1 = (current.startY - current.bounds.top) / current.bounds.height * 100, y2 = (event.clientY - current.bounds.top) / current.bounds.height * 100;
      const hit = Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 3 ? [] : units.filter((unit) => {
        if (unit.locked || unit.hidden) return false;
        const box = selectionBounds(blocks, unit.blocks.map((block) => block.id), area)!;
        return box.left >= Math.min(x1, x2) && box.right <= Math.max(x1, x2) && box.top >= Math.min(y1, y2) && box.bottom <= Math.max(y1, y2);
      }).flatMap((unit) => unit.blocks.map((block) => block.id));
      memberMode(null); selectIds([...new Set([...(current.additive ? current.ids : []), ...hit])]);
    } else {
      commit(calculate(event, current));
      // Pointer capture sends click/dblclick to the workspace, so recognize a
      // stationary double press using the original group member instead.
      if (current.objectId && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 3) {
        const previous = lastTap.current;
        if (previous?.id === current.objectId && event.timeStamp - previous.time < 450 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 5) {
          cancel(); enterMember(current.objectId); return;
        }
        lastTap.current = { id: current.objectId, time: event.timeStamp, x: event.clientX, y: event.clientY };
      } else lastTap.current = null;
    }
    cancel();
  }
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      const scope = scopeRef.current, target = event.target instanceof Element ? event.target : document.activeElement;
      if (event.defaultPrevented || !scope?.isConnected || (target?.closest(textTarget) && !(event.key === "Escape" && memberRef.current))) return;
      const modal = [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')].at(-1) ?? null;
      if (scope.closest('dialog[open], [role="dialog"][aria-modal="true"]') !== modal) return;
      if (target && target !== document.body && !scope.contains(target)) return;
      const command = (event.ctrlKey || event.metaKey) && !event.altKey;
      const key = event.key.toLowerCase();
      if (!command && target?.closest("[data-slide-layer-reorder]")) return;
      let action: (() => void) | undefined;
      if (key === "escape") action = () => {
        if (gesture.current) cancel();
        else if (memberRef.current) { const groupId = memberRef.current; window.getSelection()?.removeAllRanges(); scope.focus({ preventScroll: true }); memberMode(null); selectIds(blocks.filter((block) => block.slideGroupId === groupId).map((block) => block.id)); }
        else clear();
      };
      else if (command && key === "a") action = () => { memberMode(null); selectIds(units.filter((unit) => !unit.locked && !unit.hidden).flatMap((unit) => unit.blocks.map((block) => block.id))); };
      else if (command && key === "g") action = event.shiftKey ? ungroup : group;
      else if (command && key === "d" && editable) action = duplicate;
      else if (!command && (key === "delete" || key === "backspace") && editable) action = remove;
      else if (!command && ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key) && editable && !gesture.current) action = () => {
        const step = event.shiftKey ? 10 : 1;
        commit(moveSlideSelection(blocks, selectedIds, { x: (key === "arrowleft" ? -step : key === "arrowright" ? step : 0) / area.width * 100, y: (key === "arrowup" ? -step : key === "arrowdown" ? step : 0) / area.height * 100 }, area));
      };
      if (!action) return;
      event.preventDefault();
      try { action(); } catch (error) { setNotice({ message: error instanceof Error ? error.message : "This change could not be applied.", error: true }); }
    }
    document.addEventListener("keydown", keyboard); return () => document.removeEventListener("keydown", keyboard);
  });
  return { selectedIds, selectedId, memberGroupId, editable, lockedIds, hiddenIds, renderBlocks: preview ?? blocks, transforming: preview !== null, marquee, notice,
    bounds: selectionBounds(preview ?? blocks, selectedIds, area), selectObject, selectLayer, selectIds, enterMember, clear, paste, duplicate, remove, group, ungroup, toggleFlag,
    objectPointerDown, backgroundPointerDown, pointerMove, pointerUp, cancel,
    startMove: (event: PointerEvent<HTMLElement>) => start(event, "move"),
    startResize: (event: PointerEvent<HTMLElement>, corner: SelectionCorner) => start(event, "resize", selectedIds, corner),
    align: (alignment: Parameters<typeof alignSlideSelection>[2], canvas: boolean) => commit(alignSlideSelection(blocks, selectedIds, alignment, area, canvas)),
    distribute: (axis: "x" | "y") => { const next = distributeSlideSelection(blocks, selectedIds, axis, area); if (next) commit(next); },
    canDistribute: (axis: "x" | "y") => distributeSlideSelection(blocks, selectedIds, axis, area) !== null,
    resizeKey: (corner: SelectionCorner, x: number, y: number) => {
      const box = selectionBounds(blocks, selectedIds, area); if (!box) return;
      const left = corner.endsWith("left"), top = corner.startsWith("top");
      const vx = (box.right - box.left) / 100 * area.width * (left ? -1 : 1), vy = (box.bottom - box.top) / 100 * area.height * (top ? -1 : 1);
      commit(resizeSlideSelection(blocks, selectedIds, 1 + (x * vx + y * vy) / (vx * vx + vy * vy), { x: left ? box.right : box.left, y: top ? box.bottom : box.top }, area));
    },
  };
}
export type SlideSelection = ReturnType<typeof useSlideSelection>;
