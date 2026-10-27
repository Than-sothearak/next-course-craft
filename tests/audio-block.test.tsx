import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { audioBlockSchema, blockSchema } from "@/lib/schemas/block";
import { audioUploadContentType } from "@/lib/media/audio-upload";
import { mediaUploadInputSchema } from "@/lib/media/schemas";
import { getHandoutBlockText } from "@/lib/pdf/content";
import { AudioPlayer } from "@/components/audio-player";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { ContentBlockPreview } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/content-block-preview";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

const block = audioBlockSchema.parse({ id: "audio", version: 1, type: "audio", data: {
  src: "/api/assets/507f1f77bcf86cd799439011/file", fileName: "Introduction.mp3", mimeType: "audio/mpeg",
} });

describe("lesson audio blocks", () => {
  it("adds a valid empty Audio block from Multimedia", () => {
    const template = blockTemplates.find((item) => item.id === "media-audio")!;
    expect(template.category).toBe("Multimedia");
    const [created] = createBlocksFromTemplate(template, "new-audio");
    expect(blockSchema.parse(created)).toMatchObject({ type: "audio", width: "medium", data: { src: "", fileName: "" } });
    expect(renderToStaticMarkup(createElement(AudioPlayer, { src: "", fileName: "" }))).not.toContain("<audio");
  });

  it("renders a labeled playable audio file in both the editor and learner", () => {
    for (const markup of [
      renderToStaticMarkup(createElement(ContentBlockPreview, { block, onChange: () => {} })),
      renderToStaticMarkup(createElement(PreviewBlock, { block, device: "desktop", orientation: "landscape" })),
    ]) {
      expect(markup).toContain("<audio");
      expect(markup).toContain('controls=""');
      expect(markup).toContain(`src="${block.data.src}"`);
      expect(markup).toContain('aria-label="Introduction.mp3"');
      expect(markup).not.toContain("autoPlay");
    }
    expect(getHandoutBlockText(block)).toEqual(["Audio: Introduction.mp3"]);
  });

  it.each(["./media/lesson.mp3", "data:audio/mpeg;base64,SUQz"])("plays rewritten offline source %s", (src) => {
    const markup = renderToStaticMarkup(createElement(PreviewBlock, {
      block: { ...block, data: { ...block.data, src } }, device: "desktop", orientation: "landscape",
    }));
    expect(markup).toContain(`src="${src}"`);
    expect(markup).not.toContain("/api/assets/");
  });

  it("rejects non-library sources and non-audio MIME types on authoring input", () => {
    for (const data of [
      { ...block.data, src: "https://example.com/lesson.mp3" },
      { ...block.data, mimeType: "video/mp4" },
      { ...block.data, src: "javascript:alert(1)" },
    ]) expect(audioBlockSchema.safeParse({ ...block, data }).success).toBe(false);
  });

  it.each([
    ["lesson.mp3", "audio/mpeg", "audio/mpeg"],
    ["lesson.m4a", "audio/x-m4a", "audio/mp4"],
    ["lesson.WAV", "audio/x-wav", "audio/wav"],
    ["lesson.ogg", "", "audio/ogg"],
    ["lesson.weba", "application/octet-stream", "audio/webm"],
    ["lesson.webm", "video/webm", "audio/webm"],
  ])("normalizes browser metadata for %s and enforces the audio size limit", (name, type, expected) => {
    const contentType = audioUploadContentType({ name, type });
    expect(contentType).toBe(expected);
    expect(mediaUploadInputSchema.safeParse({ fileName: name, contentType, size: 100 * 1024 * 1024 }).success).toBe(true);
    expect(mediaUploadInputSchema.safeParse({ fileName: name, contentType, size: 100 * 1024 * 1024 + 1 }).success).toBe(false);
  });
});
