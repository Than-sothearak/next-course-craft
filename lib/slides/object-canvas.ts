import type { LearningBlock, LearningPage, ObjectPlacement } from "./blocks";

export const canvasDesignSize = { width: 1280, height: 720 } as const;
export function defaultObjectPlacement(kind: LearningBlock["kind"], index = 0): ObjectPlacement {
  const bounds = kind === "template" ? { x: 0, y: 0, width: 1280, height: 720 } : kind === "image" ? { x: 760, y: 140, width: 400, height: 360 } : kind === "audio" ? { x: 80, y: 580, width: 700, height: 100 } : kind === "video" ? { x: 240, y: 140, width: 800, height: 450 } : kind === "shape" ? { x: 120, y: 120, width: 320, height: 240 } : kind === "button" ? { x: 960, y: 600, width: 240, height: 64 } : kind === "text" ? { x: 80, y: 120, width: 600, height: 300 } : { x: 80, y: 140, width: 720, height: 440 };
  const offset = kind === "template" ? 0 : index % 5 * 20;
  return { ...bounds, x: Math.min(1280 - bounds.width, bounds.x + offset), y: Math.min(720 - bounds.height, bounds.y + offset), rotation: 0, zIndex: Math.min(500, index + 1) };
}
/** Materialize positions before reordering so stack changes never move unrelated objects. */
export function materializeObjectCanvas(page: LearningPage): LearningPage {
  return { ...page, layout: "canvas", layers: page.layers.map((block, index) => block.placement ? block : { ...block, placement: defaultObjectPlacement(block.kind, index) }) };
}
export function moveCanvasObject(placement: ObjectPlacement, x: number, y: number): ObjectPlacement {
  return { ...placement, x: Math.max(0, Math.min(1280 - placement.width, Math.round(x))), y: Math.max(0, Math.min(720 - placement.height, Math.round(y))) };
}
export function resizeCanvasObject(placement: ObjectPlacement, width: number, height: number): ObjectPlacement {
  return { ...placement, width: Math.max(24, Math.min(1280 - placement.x, Math.round(width))), height: Math.max(24, Math.min(720 - placement.y, Math.round(height))) };
}
export function setCanvasObjectOrder(page: LearningPage, id: string, direction: -1 | 1): LearningPage {
  const normalized = materializeObjectCanvas(page), layers = [...normalized.layers].sort((a, b) => a.placement!.zIndex - b.placement!.zIndex);
  const from = layers.findIndex((block) => block.id === id), to = from + direction;
  if (from < 0 || to < 0 || to >= layers.length || layers[from].locked) return page;
  [layers[from], layers[to]] = [layers[to], layers[from]];
  return { ...normalized, layers: layers.map((block, index) => ({ ...block, placement: { ...block.placement!, zIndex: index + 1 } })) };
}
