import type { EditorSnapshotInput } from "./schemas";

type CourseContent = Pick<EditorSnapshotInput, "sections" | "lessons">;
type Lesson = EditorSnapshotInput["lessons"][number];

export function duplicateLessonBlocks(blocks: Lesson["blocks"], createId: () => string): Lesson["blocks"] {
  const ids = new Map(blocks.map((block) => [block.id, createId()]));
  return structuredClone(blocks).map((block) => {
    const id = ids.get(block.id)!;
    if (block.type !== "interactionButton") return { ...block, id };
    return { ...block, id, data: {
      ...block.data,
      targetBlockId: ids.get(block.data.targetBlockId) ?? "",
      popup: { ...block.data.popup, blocks: block.data.popup.blocks.map((item) => ({ ...item, id: createId() })) },
    } };
  });
}

/** Remove links to a deleted object in the same undoable edit. */
export function removeLessonBlock(blocks: Lesson["blocks"], blockId: string): Lesson["blocks"] {
  return blocks.filter((block) => block.id !== blockId).map((block) => block.type === "interactionButton" && block.data.targetBlockId === blockId
    ? { ...block, data: { ...block.data, targetBlockId: "" } }
    : block);
}

/** Match the flat presentation list while keeping section-local lesson orders valid. */
export function reorderPresentationSlides<T extends CourseContent>(course: T, activeId: string, overId: string): T {
  const slides = [...course.sections].sort((a, b) => a.order - b.order).flatMap((section) => course.lessons.filter((lesson) => lesson.sectionId === section.id).sort((a, b) => a.order - b.order));
  const from = slides.findIndex((slide) => slide.id === activeId), to = slides.findIndex((slide) => slide.id === overId);
  if (from < 0 || to < 0 || from === to) return course;
  const destinationId = slides[to].sectionId;
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved);
  const sectionOrders = new Map<string, number>();
  const updates = new Map<string, Lesson>();
  for (const slide of slides) {
    const sectionId = slide.id === activeId ? destinationId : slide.sectionId;
    const order = sectionOrders.get(sectionId) ?? 0;
    sectionOrders.set(sectionId, order + 1);
    if (slide.order !== order || slide.sectionId !== sectionId) updates.set(slide.id, { ...slide, sectionId, order });
  }
  return { ...course, lessons: course.lessons.map((lesson) => updates.get(lesson.id) ?? lesson) };
}

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
  const lessonId = createId();
  return {
    ...copy,
    id: lessonId,
    title: `${source.title}${suffix}`,
    titleHtml: source.titleHtml?.replace(/((?:<\/[^>]+>\s*)+)$/, `${suffix}$1`),
    blocks: duplicateLessonBlocks(copy.blocks, createId),
    quizQuestions: copy.quizQuestions.map((question) => {
      const ids = new Map(question.choices.map((choice) => [choice.id, createId()]));
      return { ...question, id: createId(), choices: question.choices.map((choice) => ({ ...choice, id: ids.get(choice.id)! })), correctChoiceIds: question.correctChoiceIds.map((id) => ids.get(id)!) };
    }),
  };
}
