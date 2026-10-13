export function getCourseProgress(visitedLessonIds: ReadonlySet<string>, lessonIds: readonly string[]) {
  const lessons = new Set(lessonIds);
  if (lessons.size === 0) return 0;
  const completed = [...visitedLessonIds].filter((lessonId) => lessons.has(lessonId)).length;
  return Math.round((completed / lessons.size) * 100);
}
