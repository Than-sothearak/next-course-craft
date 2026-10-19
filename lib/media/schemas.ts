import { z } from "zod";

export const mediaMimeTypeSchema = z.enum([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "application/pdf",
  "text/plain",
]);

const maximumImageBytes = 25 * 1024 * 1024;
const maximumVideoBytes = 250 * 1024 * 1024;
const maximumDocumentBytes = 25 * 1024 * 1024;
const maximumAudioBytes = 100 * 1024 * 1024;

export const mediaUploadInputSchema = z.object({
  fileName: z.string().trim().min(1).max(255).refine((name) => !/[\u0000-\u001f\u007f]/.test(name), "Filenames cannot contain control characters."),
  contentType: mediaMimeTypeSchema,
  size: z.number().int().min(1).max(maximumVideoBytes),
}).superRefine(({ contentType, size }, context) => {
  const maximumBytes = maximumUploadBytes(contentType);
  if (size > maximumBytes) {
    context.addIssue({
      code: "custom",
      message: `This file type must be ${maximumBytes / (1024 * 1024)} MB or smaller.`,
      path: ["size"],
    });
  }
});

export type MediaUploadInput = z.infer<typeof mediaUploadInputSchema>;

export function maximumUploadBytes(contentType: z.infer<typeof mediaMimeTypeSchema>) {
  if (contentType.startsWith("image/")) return maximumImageBytes;
  if (contentType.startsWith("video/")) return maximumVideoBytes;
  if (contentType.startsWith("audio/")) return maximumAudioBytes;
  return maximumDocumentBytes;
}
