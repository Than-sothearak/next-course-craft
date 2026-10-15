import type { PreviewEditTarget } from "./preview-types";

export function previewEditTarget(lessonId: string | null, container?: HTMLElement | null): PreviewEditTarget | undefined {
  if (!lessonId) return undefined;
  const viewport = container?.getBoundingClientRect();
  const visibleBlock = viewport && Array.from(container!.querySelectorAll<HTMLElement>("[data-lesson-block-id]")).find((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.height > 0 && bounds.bottom > viewport.top && bounds.top < viewport.bottom;
  });
  const blockId = visibleBlock?.dataset.lessonBlockId;
  return { lessonId, ...(blockId ? { blockId } : {}) };
}
