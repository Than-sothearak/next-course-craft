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
  "application/octet-stream",
  "text/plain",
]);

const maximumImageBytes = 25 * 1024 * 1024;
const maximumVideoBytes = 250 * 1024 * 1024;
const maximumDocumentBytes = 25 * 1024 * 1024;
const maximumAttachmentBytes = 250 * 1024 * 1024;
const maximumAudioBytes = 100 * 1024 * 1024;

export const mediaUploadInputSchema = z.object({
  fileName: z.string().trim().min(1).max(255).refine((name) => !/[\u0000-\u001f\u007f]/.test(name), "Filenames cannot contain control characters."),
  contentType: mediaMimeTypeSchema,
  purpose: z.enum(["media", "attachment"]).optional(),
  size: z.number().int().min(1).max(maximumVideoBytes),
}).superRefine(({ contentType, purpose, size }, context) => {
  if (contentType === "application/octet-stream" && purpose !== "attachment") {
    context.addIssue({ code: "custom", message: "Choose the attachment upload option for unsupported file types.", path: ["contentType"] });
    return;
  }
  const maximumBytes = maximumUploadBytes(contentType, purpose);
  if (size > maximumBytes) {
    context.addIssue({
      code: "custom",
      message: `This file type must be ${maximumBytes / (1024 * 1024)} MB or smaller.`,
      path: ["size"],
    });
  }
});

export type MediaUploadInput = z.infer<typeof mediaUploadInputSchema>;

export function maximumUploadBytes(contentType: z.infer<typeof mediaMimeTypeSchema>, purpose?: "media" | "attachment") {
  if (purpose === "attachment") return maximumAttachmentBytes;
  if (contentType.startsWith("image/")) return maximumImageBytes;
  if (contentType.startsWith("video/")) return maximumVideoBytes;
  if (contentType.startsWith("audio/")) return maximumAudioBytes;
  return maximumDocumentBytes;
}
