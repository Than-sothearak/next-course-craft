import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import type { SlideMaster } from "../slide-design";

export async function assertSlideMasterAsset(ownerId: string, courseId: string, master?: SlideMaster) {
  const background = master?.background;
  const images = [
    ...(master?.header?.imageSrc ? [{ src: master.header.imageSrc, message: "Choose a header background image from this course's media library." }] : []),
    ...(background?.type === "image" && background.imageSrc ? [{ src: background.imageSrc, message: "Choose a master background image from this course's media library." }] : []),
    ...(master?.footer?.logos ?? []).map((logo) => ({ src: logo.src, message: "Choose footer logos from this course's media library." })),
  ];
  const assetMessages = new Map<string, string>();
  for (const { src, message } of images) {
    const assetId = src.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
    if (!assetId) throw new DashboardError(message, 400);
    assetMessages.set(assetId.toLowerCase(), message);
  }
  await Promise.all([...assetMessages].map(async ([assetId, message]) => {
    const asset = await Asset.findOne({ _id: assetId, ownerId, courseId, status: "ready", mimeType: /^image\// }).select("_id").lean();
    if (!asset) throw new DashboardError(message, 400);
  }));
}
