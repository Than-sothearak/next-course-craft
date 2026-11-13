import { Course } from "@/models/Course";
import { CourseGenerationSession } from "@/models/CourseGenerationSession";
import { courseCoverSchema } from "@/lib/editor/course-cover";
import { assertCourseCoverAsset } from "@/lib/editor/services/course-cover";
import { DashboardError } from "@/lib/dashboard/rules";
import { createGeneratedImageAsset } from "./images";
import type { CourseOutline } from "../course-generation-session-schema";

export async function prepareOutlineCover(ownerId: string, courseId: string, outline: CourseOutline) {
  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: null }).select("coverImage").lean();
  if (!course) throw new DashboardError("Course not found.", 404);
  if (course.coverImage) {
    const dashboardCover = courseCoverSchema.safeParse({ template: "image", imageSrc: course.coverImage });
    return { cover: dashboardCover.success ? dashboardCover.data : undefined, generatedCover: false };
  }
  // Replanning the outline reuses its previously prepared cover rather than
  // charging for another image before the author has approved the first one.
  const previous = await CourseGenerationSession.findOne({ ownerId, courseId, generatedCover: true, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  const saved = courseCoverSchema.safeParse(previous?.cover);
  if (saved.success && saved.data.imageSrc) {
    try {
      await assertCourseCoverAsset(ownerId, courseId, saved.data);
      return { cover: saved.data, generatedCover: true };
    } catch (error) {
      if (!(error instanceof DashboardError && error.status === 400)) throw error;
    }
  }
  const image = await createGeneratedImageAsset(ownerId, courseId, [
    `Create a simple landscape 16:9 dashboard course-card image about: ${outline.title}.`,
    `Course context: ${outline.description.slice(0, 1_000)}.`,
    "Use a restrained educational illustration with a clear focal subject that is readable at thumbnail size. No text or lettering in the image.",
  ].join(" "), { purpose: "course-cover" });
  return { generatedCover: true, cover: courseCoverSchema.parse({ template: "image", imageSrc: image.src, imageAlt: `Course card image for ${outline.title}` }) };
}
