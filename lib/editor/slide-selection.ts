import type { ContentBlock } from "@/lib/schemas/block";
import { resolveSlideFrame, resolveSlideTextLayout, minimumSlideAudioHeight, type SlideSize } from "./slide-design";
import { slideObjectBounds, type SlideAlignment } from "./slide-alignment";
import { getSlideLayers } from "./slide-layers";

export type SelectionBounds = { left: number; right: number; top: number; bottom: number; center: number; middle: number };
export type SelectionUnit = { id: string; blocks: ContentBlock[]; locked: boolean; hidden: boolean };
const precise = (value: number) => Math.round(value * 1e10) / 1e10;

/** Group identity is local to this array, never to a parent or another popup. */
export function slideSelectionUnits(blocks: readonly ContentBlock[]): SelectionUnit[] {
  const units = new Map<string, SelectionUnit>();
  for (const block of getSlideLayers(blocks)) {
    const id = block.slideGroupId ? `group:${block.slideGroupId}` : `object:${block.id}`;
    const unit = units.get(id) ?? { id, blocks: [], locked: false, hidden: false };
    unit.blocks.push(block); unit.locked ||= Boolean(block.slideLocked); unit.hidden ||= Boolean(block.slideHiddenInEditor);
    units.set(id, unit);
  }
  return [...units.values()];
}

export function slideSelectionIds(blocks: readonly ContentBlock[], id: string, memberGroupId?: string | null): string[] {
  const block = blocks.find((item) => item.id === id);
  if (!block) return [];
  return block.slideGroupId && block.slideGroupId !== memberGroupId
    ? blocks.filter((item) => item.slideGroupId === block.slideGroupId).map((item) => item.id) : [id];
}

export function selectionBounds(blocks: readonly ContentBlock[], ids: readonly string[], area: SlideSize): SelectionBounds | null {
  const selected = new Set(ids);
  const boxes = blocks.flatMap((block, index) => selected.has(block.id) ? [slideObjectBounds(resolveSlideFrame(block, index, blocks.length, area), area)] : []);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.left)), right = Math.max(...boxes.map((box) => box.right));
  const top = Math.min(...boxes.map((box) => box.top)), bottom = Math.max(...boxes.map((box) => box.bottom));
  return { left, right, top, bottom, center: (left + right) / 2, middle: (top + bottom) / 2 };
}

export function editableSelection(blocks: readonly ContentBlock[], ids: readonly string[]) {
  const selected = new Set(ids);
  return ids.length > 0 && slideSelectionUnits(blocks).filter((unit) => unit.blocks.some((block) => selected.has(block.id))).every((unit) => !unit.locked && !unit.hidden);
}

export function moveSlideSelection(blocks: ContentBlock[], ids: readonly string[], delta: { x: number; y: number }, area: SlideSize): ContentBlock[] {
  if (!editableSelection(blocks, ids)) return blocks;
  const selected = new Set(ids);
  const frames = blocks.flatMap((block, index) => selected.has(block.id) ? [resolveSlideFrame(block, index, blocks.length, area)] : []);
  const x = Math.max(Math.max(...frames.map((frame) => -frame.x)), Math.min(delta.x, Math.min(...frames.map((frame) => 100 - frame.x - frame.width))));
  const y = Math.max(Math.max(...frames.map((frame) => -frame.y)), Math.min(delta.y, Math.min(...frames.map((frame) => 100 - frame.y - frame.height))));
  if (Math.abs(x) + Math.abs(y) < 1e-9) return blocks;
  return blocks.map((block, index) => {
    if (!selected.has(block.id)) return block;
    const frame = resolveSlideFrame(block, index, blocks.length, area);
    const nextX = Math.max(0, Math.min(100 - frame.width, precise(frame.x + x))), nextY = Math.max(0, Math.min(100 - frame.height, precise(frame.y + y)));
    return { ...block, slideFrame: { ...frame, x: nextX, y: nextY } };
  });
}

/** One uniform scalar and fixed opposite corner, including rotated members. */
export function resizeSlideSelection(blocks: ContentBlock[], ids: readonly string[], scale: number, anchor: { x: number; y: number }, area: SlideSize): ContentBlock[] {
  if (!editableSelection(blocks, ids)) return blocks;
  const selected = new Set(ids);
  let minimum = 0, maximum = Number.POSITIVE_INFINITY;
  blocks.forEach((block, index) => {
    if (!selected.has(block.id)) return;
    const frame = resolveSlideFrame(block, index, blocks.length, area);
    minimum = Math.max(minimum, 5 / frame.width, (block.type === "audio" ? minimumSlideAudioHeight : 5) / frame.height);
    for (const [position, origin] of [[frame.x, anchor.x], [frame.x + frame.width, anchor.x], [frame.y, anchor.y], [frame.y + frame.height, anchor.y]]) {
      const distance = position - origin;
      if (distance > 0) { minimum = Math.max(minimum, -origin / distance); maximum = Math.min(maximum, (100 - origin) / distance); }
      if (distance < 0) { minimum = Math.max(minimum, (100 - origin) / distance); maximum = Math.min(maximum, -origin / distance); }
    }
  });
  const actual = Math.min(maximum, Math.max(minimum, scale));
  if (!Number.isFinite(actual) || actual <= 0 || minimum > maximum || Math.abs(actual - 1) < 1e-9) return blocks;
  return blocks.map((block, index) => {
    if (!selected.has(block.id)) return block;
    const frame = resolveSlideFrame(block, index, blocks.length, area);
    const x = Math.max(0, precise(anchor.x + (frame.x - anchor.x) * actual)), y = Math.max(0, precise(anchor.y + (frame.y - anchor.y) * actual));
    const next = { ...block, slideFrame: { ...frame, x, y, width: Math.min(100 - x, precise(frame.width * actual)), height: Math.min(100 - y, precise(frame.height * actual)) } };
    if (block.type === "heading" || block.type === "richText" || block.type === "statement") return { ...next, slideTextLayout: { ...resolveSlideTextLayout(block.slideTextLayout), fitToText: false } };
    if (block.type === "audio") return { ...next, slidePlayback: { autoPlay: false, showControls: true, ...block.slidePlayback, fitHeight: false } };
    return next;
  });
}

export function normalizeSlideGroups(blocks: ContentBlock[]): ContentBlock[] {
  const counts = new Map<string, number>();
  blocks.forEach((block) => { if (block.slideGroupId) counts.set(block.slideGroupId, (counts.get(block.slideGroupId) ?? 0) + 1); });
  return blocks.map((block) => block.slideGroupId && counts.get(block.slideGroupId) === 1 ? { ...block, slideGroupId: undefined } : block);
}

export function groupSlideSelection(blocks: ContentBlock[], ids: readonly string[], groupId: string, area?: SlideSize): ContentBlock[] {
  if (ids.length < 2 || !editableSelection(blocks, ids)) return blocks;
  const selected = new Set(ids), layers = getSlideLayers(blocks);
  if (slideSelectionUnits(blocks).filter((unit) => unit.blocks.some((block) => selected.has(block.id))).length < 2) return blocks;
  const members = layers.filter((block) => selected.has(block.id));
  const at = layers.findIndex((block) => selected.has(block.id));
  const order = layers.filter((block) => !selected.has(block.id)); order.splice(at, 0, ...members);
  const ranks = new Map(order.map((block, index) => [block.id, order.length - index - 1]));
  return normalizeSlideGroups(blocks.map((block, index) => ({ ...block, ...(selected.has(block.id) ? { slideGroupId: groupId } : {}), slideFrame: { ...resolveSlideFrame(block, index, blocks.length, area), z: ranks.get(block.id)! } })));
}

export function ungroupSlideSelection(blocks: ContentBlock[], ids: readonly string[]): ContentBlock[] {
  if (!editableSelection(blocks, ids)) return blocks;
  const groups = new Set(blocks.filter((block) => ids.includes(block.id)).map((block) => block.slideGroupId).filter(Boolean));
  return blocks.map((block) => block.slideGroupId && groups.has(block.slideGroupId) ? { ...block, slideGroupId: undefined } : block);
}

export function removeSlideSelection(blocks: ContentBlock[], ids: readonly string[]) {
  if (!editableSelection(blocks, ids)) return blocks;
  const removed = new Set(ids);
  return normalizeSlideGroups(blocks.filter((block) => !removed.has(block.id)).map((block) => block.type === "interactionButton" && removed.has(block.data.targetBlockId)
    ? { ...block, data: { ...block.data, targetBlockId: "" } } : block));
}

export function alignSlideSelection(blocks: ContentBlock[], ids: readonly string[], alignment: Exclude<SlideAlignment, "header" | "footer">, area: SlideSize, canvas = false): ContentBlock[] {
  if (!editableSelection(blocks, ids)) return blocks;
  const selected = new Set(ids);
  const units = slideSelectionUnits(blocks).filter((unit) => unit.blocks.some((block) => selected.has(block.id)));
  const bounds = selectionBounds(blocks, ids, area);
  if (!bounds || units.length < 2) return blocks;
  const target = canvas ? { left: 0, right: 100, top: 0, bottom: 100, center: 50, middle: 50 } : bounds;
  let result = blocks;
  for (const unit of units) {
    const unitIds = unit.blocks.map((block) => block.id), box = selectionBounds(blocks, unitIds, area)!;
    const key = alignment === "left" || alignment === "right" || alignment === "center" ? "x" : "y";
    result = moveSlideSelection(result, unitIds, { x: key === "x" ? target[alignment] - box[alignment] : 0, y: key === "y" ? target[alignment] - box[alignment] : 0 }, area);
  }
  return result;
}

export function distributeSlideSelection(blocks: ContentBlock[], ids: readonly string[], axis: "x" | "y", area: SlideSize): ContentBlock[] | null {
  if (!editableSelection(blocks, ids)) return null;
  const selected = new Set(ids), start = axis === "x" ? "left" : "top", end = axis === "x" ? "right" : "bottom";
  const units = slideSelectionUnits(blocks).filter((unit) => unit.blocks.some((block) => selected.has(block.id))).map((unit) => ({ ids: unit.blocks.map((block) => block.id), bounds: selectionBounds(blocks, unit.blocks.map((block) => block.id), area)! })).sort((a, b) => a.bounds[start] - b.bounds[start]);
  if (units.length < 3) return null;
  const span = units.at(-1)!.bounds[end] - units[0].bounds[start];
  const gap = (span - units.reduce((sum, unit) => sum + unit.bounds[end] - unit.bounds[start], 0)) / (units.length - 1);
  if (gap < -1e-9) return null;
  let position = units[0].bounds[end] + Math.max(0, gap), result = blocks;
  for (const unit of units.slice(1, -1)) {
    result = moveSlideSelection(result, unit.ids, { x: axis === "x" ? position - unit.bounds[start] : 0, y: axis === "y" ? position - unit.bounds[start] : 0 }, area);
    position += unit.bounds[end] - unit.bounds[start] + Math.max(0, gap);
  }
  return result;
}
