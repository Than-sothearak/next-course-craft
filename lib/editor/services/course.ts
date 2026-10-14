import { Types } from "mongoose";
import { Course, Lesson } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import {
  defaultBlockWidthForBlock,
  normalizeStoredFlipCardBlock,
  normalizeBlockPaddingForBlock,
  type ContentBlock,
} from "@/lib/schemas/block";
import { defaultSection, ownerObjectId } from "./shared";
import { normalizeCourseTheme } from "../theme";
import { normalizeCourseNavigationMode } from "../navigation";

export async function getCourseEditor(ownerId: string, courseId: string) {
  ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(courseId))
    throw new DashboardError("Course not found.", 404);

  const course = await Course.findOne({
    _id: courseId,
    ownerId,
    deletedAt: null,
  }).lean();
  if (!course) throw new DashboardError("Course not found.", 404);
  const lessons = await Lesson.find({ courseId: course._id })
    .sort({ sectionId: 1, order: 1, createdAt: 1 })
    .lean();
  const sections = course.sections?.length
    ? course.sections
    : [defaultSection()];
  const sectionIds = new Set(sections.map((section) => section.id));
  const lessonOrder = new Map<string, number>();

  return {
    courseId: course._id.toString(),
    title: course.title,
    description: course.description,
    descriptionHtml: course.descriptionHtml ?? undefined,
    authorVisible: course.authorVisible ?? true,
    theme: normalizeCourseTheme(course.theme),
    navigationMode: normalizeCourseNavigationMode(course.navigationMode),
    revision: course.revision,
    sections,
    lessons: lessons.map((lesson) => {
      const sectionId = sectionIds.has(lesson.sectionId)
        ? lesson.sectionId
        : sections[0].id;
      const order = lessonOrder.get(sectionId) ?? 0;
      lessonOrder.set(sectionId, order + 1);
      return {
        id: lesson.editorId ?? String(lesson._id),
        sectionId,
        title: lesson.title,
        titleHtml: lesson.titleHtml ?? undefined,
        icon: lesson.icon ?? "file",
        lessonType: lesson.lessonType ?? "content",
        passingScore: lesson.passingScore ?? 70,
        quizQuestions: lesson.quizQuestions ?? [],
        order,
        blocks: lesson.blocks.map((storedBlock: ContentBlock) => {
          const block = normalizeStoredFlipCardBlock(storedBlock);
          return {
            ...block,
            width: block.widthCustom
              ? block.width
              : defaultBlockWidthForBlock(block),
            widthCustom: block.widthCustom ?? false,
            backgroundColor: block.backgroundColor ?? "#ffffff",
            blockPadding: normalizeBlockPaddingForBlock(block.blockPadding, block),
          };
        }),
      };
    }),
  };
}
