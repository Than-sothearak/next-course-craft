import { z } from "zod";

export const mediaMimeTypeSchema = z.enum([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
]);

const maximumImageBytes = 25 * 1024 * 1024;
const maximumVideoBytes = 250 * 1024 * 1024;

export const mediaUploadInputSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: mediaMimeTypeSchema,
  size: z.number().int().min(1).max(maximumVideoBytes),
}).superRefine(({ contentType, size }, context) => {
  const maximumBytes = contentType.startsWith("image/") ? maximumImageBytes : maximumVideoBytes;
  if (size > maximumBytes) {
    context.addIssue({
      code: "custom",
      message: contentType.startsWith("image/") ? "Images must be 25 MB or smaller." : "Videos must be 250 MB or smaller.",
      path: ["size"],
    });
  }
});

export type MediaUploadInput = z.infer<typeof mediaUploadInputSchema>;

export function maximumUploadBytes(contentType: z.infer<typeof mediaMimeTypeSchema>) {
  return contentType.startsWith("image/") ? maximumImageBytes : maximumVideoBytes;
}
