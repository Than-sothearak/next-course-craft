export function lessonEditorHref(courseId: string, lessonId?: string, blockId?: string) {
  const coursePath = `/courses/${encodeURIComponent(courseId)}/edit`;
  if (!lessonId) return coursePath;
  const lessonPath = `${coursePath}/lessons/${encodeURIComponent(lessonId)}`;
  return blockId ? `${lessonPath}?blockId=${encodeURIComponent(blockId)}` : lessonPath;
}

export function editorBlockElementId(blockId: string) {
  return `editor-block-${blockId}`;
}
