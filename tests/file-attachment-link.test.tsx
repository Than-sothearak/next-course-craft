import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileAttachmentLink } from "@/components/file-attachment-link";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { attachmentBlockSchema } from "@/lib/schemas/block";

describe("lesson file attachments", () => {
  it("renders a download link with the original filename and formatted size", () => {
    const markup = renderToStaticMarkup(createElement(FileAttachmentLink, {
      href: "/api/assets/507f1f77bcf86cd799439011/file",
      fileName: "lesson-guide.docx",
      size: 1_048_576,
    }));
    expect(markup).toContain('href="/api/assets/507f1f77bcf86cd799439011/file"');
    expect(markup).toContain('download="lesson-guide.docx"');
    expect(markup).toContain("lesson-guide.docx");
    expect(markup).toContain("1.0 MB · Download file");
  });

  it("renders the attachment block as a learner download", () => {
    const block = attachmentBlockSchema.parse({
      id: "attachment-1",
      version: 1,
      type: "attachment",
      data: {
        src: "/api/assets/507f1f77bcf86cd799439011/file",
        fileName: "lesson-guide.pdf",
        size: 512_000,
      },
    });
    const markup = renderToStaticMarkup(createElement(PreviewBlock, {
      block,
      device: "desktop",
      orientation: "landscape",
    }));
    expect(markup).toContain('download="lesson-guide.pdf"');
    expect(markup).toContain("lesson-guide.pdf");
  });
});
