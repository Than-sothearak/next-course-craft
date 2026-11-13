import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import type { CourseTheme } from "../theme";
import type { CourseCover } from "../course-cover";

export async function assertCourseCoverAsset(ownerId: string, courseId: string, cover?: CourseCover) {
  if (!cover?.imageSrc) return;
  const assetId = cover.imageSrc.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
  if (!assetId) throw new DashboardError("Choose a cover image from this course’s media library.", 400);
  const asset = await Asset.findOne({ _id: assetId, ownerId, courseId, status: "ready", mimeType: /^image\// }).select("_id").lean();
  if (!asset) throw new DashboardError("Choose a cover image from this course’s media library.", 400);
}

// Earlier generated images were also installed as learner covers. Restore the
// original layout only for that marked, course-owned generated image; preserve
// manually selected learner images and all other theme settings.
export async function restoreLegacyGeneratedCourseCover(ownerId: string, courseId: string, theme: CourseTheme): Promise<CourseTheme> {
  if (!theme.cover?.titleOnly) return theme;
  const assetId = theme.cover.imageSrc.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
  if (!assetId || !await Asset.exists({ _id: assetId, ownerId, courseId, "metadata.purpose": "course-cover" })) return theme;
  const restored = { ...theme };
  delete restored.cover;
  return restored;
}
