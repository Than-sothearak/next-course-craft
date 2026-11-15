import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { YouTubeVideoEmbed } from "@/components/youtube-video-embed";
import { getYouTubeEmbedUrl } from "@/lib/media/youtube";
import { videoBlockSchema } from "@/lib/schemas/block";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { SlideMediaObject } from "@/app/courses/[courseId]/_components/slide-presentation/slide-media-object";
import { VideoBlockSettings } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/block-settings/video-block-settings";

describe("YouTube video blocks", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=share", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ?t=1m30s", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90"],
  ])("converts %s into a privacy-enhanced embed URL", (url, expected) => {
    expect(getYouTubeEmbedUrl(url)).toBe(expected);
  });

  it.each([
    "https://youtube.com.attacker.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=too-short",
    "javascript:alert(1)",
  ])("does not embed an unsafe or invalid URL: %s", (url) => {
    expect(getYouTubeEmbedUrl(url)).toBeNull();
  });

  it("renders accessible iframe markup and accepts a YouTube link in the existing video schema", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    expect(videoBlockSchema.parse({ id: "video", version: 1, type: "video", data: { src: url } }).data.src).toBe(url);

    const markup = renderToStaticMarkup(createElement(YouTubeVideoEmbed, { url }));
    expect(markup).toContain('data-youtube-video-embed=""');
    expect(markup).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(markup).toContain('title="YouTube video"');
    expect(markup).toContain('allowfullscreen=""');
    expect(markup).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });

  it("labels the existing video source field for YouTube links", () => {
    const block = videoBlockSchema.parse({ id: "video", version: 1, type: "video", data: { src: "https://youtu.be/dQw4w9WgXcQ" } });
    const markup = renderToStaticMarkup(createElement(VideoBlockSettings, { block, setMediaLibraryTarget: () => {}, onChange: () => {} }));
    expect(markup).toContain('aria-label="Video or YouTube URL"');
    expect(markup).toContain('placeholder="MP4/WebM or YouTube URL"');
    expect(markup).toContain("Paste a YouTube watch, youtu.be, Shorts, or Live link to embed it.");
  });

  it("embeds YouTube in Standard and Presentation learners while keeping direct files native", () => {
    const youtube = videoBlockSchema.parse({ id: "youtube", version: 1, type: "video", data: { src: "https://youtu.be/dQw4w9WgXcQ" } });
    const standardMarkup = renderToStaticMarkup(createElement(PreviewBlock, { block: youtube, device: "desktop", orientation: "landscape" }));
    const slideMarkup = renderToStaticMarkup(createElement(SlideMediaObject, { block: youtube }));
    expect(standardMarkup).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(slideMarkup).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');

    const direct = videoBlockSchema.parse({ id: "direct", version: 1, type: "video", data: { src: "https://cdn.example/video.mp4", mimeType: "video/mp4" } });
    const directMarkup = renderToStaticMarkup(createElement(PreviewBlock, { block: direct, device: "desktop", orientation: "landscape" }));
    expect(directMarkup).toContain("<video");
    expect(directMarkup).not.toContain("data-youtube-video-embed");
  });
});
