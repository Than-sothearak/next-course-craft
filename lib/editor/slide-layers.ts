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
  const from = layers.findIndex((block) => block.id === activeId);
  const to = layers.findIndex((block) => block.id === overId);
  if (from < 0 || to < 0) return blocks;
  const [moved] = layers.splice(from, 1);
  layers.splice(to, 0, moved);
  const order = new Map(layers.map((block, index) => [block.id, layers.length - index - 1]));
  return blocks.map((block, index) => {
    const z = order.get(block.id)!;
    const frame = block.slideFrame ?? resolveSlideFrame(block, index, blocks.length, area);
    return frame.z === z && block.slideFrame ? block : { ...block, slideFrame: { ...frame, z } };
  });
}
