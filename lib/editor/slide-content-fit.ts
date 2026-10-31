export function fitSlideContent(viewport: { width: number; height: number }, content: { width: number; height: number }) {
  if (![viewport.width, viewport.height, content.width, content.height].every((value) => Number.isFinite(value) && value > 0)) {
    return { scale: 1, left: 0, top: 0 };
  }
  const scale = Math.min(1, viewport.width / content.width, viewport.height / content.height);
  return {
    scale,
    left: Math.max(0, (viewport.width - content.width * scale) / 2),
    top: Math.max(0, (viewport.height - content.height * scale) / 2),
  };
}
