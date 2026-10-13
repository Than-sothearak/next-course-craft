import { describe, expect, it } from "vitest";
import { mediaUploadInputSchema } from "../lib/media/schemas";
import { videoBlockSchema } from "../lib/schemas/block";
import { mediaStorageUploadError } from "../lib/media/messages";

describe("media upload validation", () => {
  it("accepts supported image and video upload metadata", () => {
    expect(mediaUploadInputSchema.safeParse({ fileName: "lesson.webp", contentType: "image/webp", size: 1_024 }).success).toBe(true);
    expect(mediaUploadInputSchema.safeParse({ fileName: "lesson.mp4", contentType: "video/mp4", size: 20_000_000 }).success).toBe(true);
  });

  it("rejects unsupported types and files above the type-specific size limit", () => {
    expect(mediaUploadInputSchema.safeParse({ fileName: "lesson.svg", contentType: "image/svg+xml", size: 1_024 }).success).toBe(false);
    expect(mediaUploadInputSchema.safeParse({ fileName: "large.png", contentType: "image/png", size: 25 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(mediaUploadInputSchema.safeParse({ fileName: "large.mp4", contentType: "video/mp4", size: 250 * 1024 * 1024 + 1 }).success).toBe(false);
  });

  it("preserves a supported media type for private video URLs without a file extension", () => {
    const result = videoBlockSchema.safeParse({
      id: "video-1",
      version: 1,
      type: "video",
      src: "/api/assets/asset-1/file",
      data: { src: "/api/assets/asset-1/file", mimeType: "video/mp4" },
    });
    expect(result.success).toBe(true);
  });

  it("shows the app origin needed to resolve an S3 browser upload failure", () => {
    expect(mediaStorageUploadError("http://localhost:3000")).toContain("http://localhost:3000");
    expect(mediaStorageUploadError("https://courses.example", 403)).toContain("HTTP 403");
  });
});
