import type { ContentBlock } from "@/lib/schemas/block";
import { resolveSlideFrame, slideObjectArea, type SlideSize } from "./slide-design";

/** Frontmost first; later objects paint above earlier objects with the same z. */
export function getSlideLayers(blocks: readonly ContentBlock[]): ContentBlock[] {
  return blocks.map((block, index) => ({ block, index, z: resolveSlideFrame(block, index, blocks.length).z }))
    .sort((a, b) => b.z - a.z || b.index - a.index)
    .map(({ block }) => block);
}

/** Change stacking in one update without changing reading order or object geometry. */
export function reorderSlideLayers(blocks: ContentBlock[], activeId: string, overId: string, area: SlideSize = slideObjectArea): ContentBlock[] {
  if (activeId === overId) return blocks;
  const layers = getSlideLayers(blocks);
  const active = blocks.find((block) => block.id === activeId), over = blocks.find((block) => block.id === overId);
  if (!active || !over) return blocks;
  const moving = layers.filter((block) => block.id === activeId || Boolean(active.slideGroupId && block.slideGroupId === active.slideGroupId));
  if (moving.some((block) => block.slideLocked || block.slideHiddenInEditor) || moving.some((block) => block.id === overId)) return blocks;
  const from = layers.findIndex((block) => block.id === activeId), to = layers.findIndex((block) => block.id === overId);
  const remaining = layers.filter((block) => !moving.includes(block));
  const targetMembers = remaining.filter((block) => block.id === overId || Boolean(over.slideGroupId && block.slideGroupId === over.slideGroupId));
  const insertion = from < to ? remaining.indexOf(targetMembers.at(-1)!) + 1 : remaining.indexOf(targetMembers[0]);
  remaining.splice(insertion, 0, ...moving);
  layers.splice(0, layers.length, ...remaining);
  const order = new Map(layers.map((block, index) => [block.id, layers.length - index - 1]));
  return blocks.map((block, index) => {
    const z = order.get(block.id)!;
    const frame = block.slideFrame ?? resolveSlideFrame(block, index, blocks.length, area);
    return frame.z === z && block.slideFrame ? block : { ...block, slideFrame: { ...frame, z } };
  });
}
