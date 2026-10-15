import type { EditorSnapshotInput } from "./schemas";

type CourseContent = Pick<EditorSnapshotInput, "sections" | "lessons">;
type Lesson = EditorSnapshotInput["lessons"][number];

export function moveLessonToSection<T extends CourseContent>(course: T, lessonId: string, destinationId: string): T {
  const lesson = course.lessons.find((item) => item.id === lessonId);
  if (!lesson || lesson.sectionId === destinationId || !course.sections.some((section) => section.id === destinationId)) return course;
  const source = course.lessons.filter((item) => item.sectionId === lesson.sectionId && item.id !== lessonId).sort((a, b) => a.order - b.order);
  const destination = course.lessons.filter((item) => item.sectionId === destinationId).sort((a, b) => a.order - b.order);
  const updates = new Map([...source.map((item, order) => [item.id, { ...item, order }] as const), ...destination.map((item, order) => [item.id, { ...item, order }] as const)]);
  updates.set(lesson.id, { ...lesson, sectionId: destinationId, order: destination.length });
  return { ...course, lessons: course.lessons.map((item) => updates.get(item.id) ?? item) };
}

export function duplicateLessonContent(source: Lesson, createId: () => string): Lesson {
  const copy = structuredClone(source);
  const suffix = source.title.length <= 155 ? " copy" : "";
  return {
    ...copy,
    id: createId(),
    title: `${source.title}${suffix}`,
    titleHtml: source.titleHtml?.replace(/((?:<\/[^>]+>\s*)+)$/, `${suffix}$1`),
    blocks: copy.blocks.map((block) => ({ ...block, id: createId() })),
    quizQuestions: copy.quizQuestions.map((question) => {
      const ids = new Map(question.choices.map((choice) => [choice.id, createId()]));
      return { ...question, id: createId(), choices: question.choices.map((choice) => ({ ...choice, id: ids.get(choice.id)! })), correctChoiceIds: question.correctChoiceIds.map((id) => ids.get(id)!) };
    }),
  };
}
