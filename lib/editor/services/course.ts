import { Types } from "mongoose";
import { Course, Lesson, User } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import {
  defaultBlockWidthForBlock,
  normalizeStoredFlipCardBlock,
  normalizeBlockPaddingForBlock,
  type ContentBlock,
} from "@/lib/schemas/block";
import { defaultSection, ownerObjectId } from "./shared";
import { normalizeCourseTheme } from "../theme";
import { normalizeCourseLayout } from "../course-layout";
import { slideCoverSchema, slideMasterSchema } from "../slide-design";
import { normalizeCourseNavigationMode } from "../navigation";

export async function getCourseAuthorName(ownerId: string, courseId: string) {
  ownerObjectId(ownerId);
  if (!Types.ObjectId.isValid(courseId))
    throw new DashboardError("Course not found.", 404);

  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: null })
    .select("createdBy ownerId")
    .lean();
  if (!course) throw new DashboardError("Course not found.", 404);
  const creatorId = course.createdBy ?? course.ownerId;
  const creator = await User.findById(creatorId).select("name email").lean() as { name?: string | null; email?: string | null } | null;
  return creator?.name?.trim() || creator?.email || "Course author";
}

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
    courseLayout: normalizeCourseLayout(course.courseLayout),
    slideMaster: slideMasterSchema.parse(course.slideMaster ?? {}),
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
        slideCover: lesson.slideCover ? slideCoverSchema.safeParse(lesson.slideCover).data : undefined,
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
