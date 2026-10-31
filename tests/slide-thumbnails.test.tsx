/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideEditorSidebar } from "@/app/courses/[courseId]/edit/_components/slide-presentation/slide-editor-sidebar";
import { audioBlockSchema, blockSchema, headingBlockSchema } from "@/lib/schemas/block";
import { quizQuestionSchema } from "@/lib/schemas/quiz";
import { defaultSlideCover, slideMasterSchema } from "@/lib/editor/slide-design";
import type { SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-thumbnail";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const master = slideMasterSchema.parse({ background: { type: "abstract", design: "orbits" }, footerText: "Branding", footer: { content: "both", logos: [{ id: "logo", src: "/api/assets/123456789012345678901234/file", alt: "Brand" }] } });
const heading = headingBlockSchema.parse({ id: "heading", version: 1, type: "heading", slideFrame: { x: 12, y: 20, width: 60, height: 40, z: 3 }, slideBackground: { color: "#22c55e", opacity: 80 }, slideTextLayout: { horizontal: "center", vertical: "middle" }, data: { text: "Real heading", html: "<h2><strong>Real heading</strong></h2>", level: 2 } });

describe("presentation slide thumbnails", () => {
  let container: HTMLDivElement;
  let root: Root;
  let select: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-thumbnail-viewport") ? 240 : 0; });
    select = vi.fn(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const render = (slides: SlideItem[], design = master) => act(async () => root.render(<SlideEditorSidebar slides={slides} activeId={slides[0]?.id ?? null} master={design} courseTitle="Course title" onSelect={select} onAdd={() => {}} onDelete={() => {}} />));

  it("renders actual blocks, backgrounds, frames, alignment, and branding at slide scale", async () => {
    await render([{ id: "slide", title: "Slide title", blocks: [heading] }]);
    const canvas = container.querySelector<HTMLElement>('[data-slide-thumbnail-canvas]')!;
    expect(canvas.style.width).toBe("960px"); expect(canvas.style.height).toBe("540px"); expect(canvas.style.transform).toBe("scale(0.25)");
    expect(canvas.hasAttribute("inert")).toBe(true); expect(canvas.querySelector('[data-abstract-design="orbits"]')).not.toBeNull();
    const block = canvas.querySelector<HTMLElement>('[data-slide-thumbnail-object-id="heading"]')!;
    expect(block.style.left).toBe("12%"); expect(Number.parseFloat(block.style.top)).toBeCloseTo((108 + 20 / 100 * 368) / 540 * 100); expect(block.style.width).toBe("60%"); expect(block.style.zIndex).toBe("4");
    expect(block.querySelector("strong")?.textContent).toBe("Real heading");
    expect(block.querySelector('[data-vertical-align="middle"][data-horizontal-align="center"]')).not.toBeNull();
    expect(canvas.querySelector('[data-slide-thumbnail-footer]')?.textContent).toContain("Branding");
    expect(canvas.querySelector('[data-slide-thumbnail-footer] img')?.getAttribute("alt")).toBe("Brand");
    expect(canvas.querySelector('[data-slide-footer]')).toBeNull(); expect(canvas.querySelector('[data-slide-object-id]')).toBeNull();
    expect(container.querySelector("button button")).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit slide 1: Slide title"]')!.click()); expect(select).toHaveBeenCalledWith("slide");
  });

  it("renders saved image and video crops without autoplaying thumbnail media", async () => {
    const source = "/clip.webm", crop = { source, x: 25, y: 0, width: 50, height: 100 };
    const blocks = [blockSchema.parse({ id: "photo", version: 1, type: "image", data: { src: source, alt: "Crop" }, slideCrop: crop }), blockSchema.parse({ id: "clip", version: 1, type: "video", data: { src: source, mimeType: "video/webm" }, slideCrop: crop, slidePlayback: { autoPlay: true } })];
    await render([{ id: "slide", title: "Crops", blocks }]);
    const media = container.querySelectorAll<HTMLElement>('[data-slide-media-crop] img, [data-slide-media-crop] video');
    expect(media).toHaveLength(2); for (const element of media) { expect(element.style.width).toBe("200%"); expect(element.style.left).toBe("-50%"); }
    expect(container.querySelector("video")!.autoplay).toBe(false);
  });

  it("updates thumbnails with edited content and master design and renders every object", async () => {
    const blocks = Array.from({ length: 13 }, (_, index) => ({ ...heading, id: `heading-${index}` }));
    await render([{ id: "slide", title: "Before", blocks }]); expect(container.querySelectorAll('[data-slide-thumbnail-object-id]')).toHaveLength(13);
    await render([{ id: "slide", title: "After", blocks: [{ ...heading, data: { text: "Edited heading", level: 2 }, slideFrame: { x: 5, y: 5, width: 40, height: 40, z: 0 } }] }], slideMasterSchema.parse({ background: { type: "abstract", design: "prism" }, footerText: "New footer" }));
    expect(container.querySelector('[data-slide-thumbnail-canvas]')?.textContent).toContain("Edited heading");
    expect(container.querySelector('[data-abstract-design="prism"]')).not.toBeNull();
    expect(container.querySelector<HTMLElement>('[data-slide-thumbnail-object-id]')?.style.left).toBe("5%");
    expect(container.querySelector('[data-slide-thumbnail-footer]')?.textContent).toContain("New footer");
  });

  it("renders cover content and quiz questions with the same slide surfaces", async () => {
    const question = quizQuestionSchema.parse({ id: "question", prompt: "Choose a color", choices: [{ id: "blue", text: "Blue" }, { id: "green", text: "Green" }] });
    await render([{ id: "cover", title: "Cover", blocks: [], slideCover: { ...defaultSlideCover, subtitle: "Cover subtitle", lessonOf: "Welcome", overlayOpacity: 60 } }, { id: "quiz", title: "Quiz", blocks: [], lessonType: "quiz", quizQuestions: [question] }]);
    const cover = container.querySelector('[data-slide-thumbnail="cover"]')!;
    expect(cover.textContent).toContain("Course title"); expect(cover.textContent).toContain("Cover subtitle"); expect(cover.textContent).toContain("Welcome");
    expect(cover.querySelector('[data-slide-thumbnail-footer]')).not.toBeNull();
    const quiz = container.querySelector('[data-slide-thumbnail="quiz"]')!;
    expect(quiz.textContent).toContain("Choose a color"); expect(quiz.textContent).toContain("Blue"); expect(quiz.textContent).toContain("Green");
  });

  it("keeps thumbnail media silent and avoids learner playback handlers", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const video = blockSchema.parse({ id: "video", version: 1, type: "video", slidePlayback: { autoPlay: true }, data: { src: "/clip.webm", mimeType: "video/webm" } });
    const audio = blockSchema.parse({ id: "audio", version: 1, type: "audio", slidePlayback: { autoPlay: true }, data: { src: "/api/assets/123456789012345678901234/file", mimeType: "audio/webm", fileName: "Narration" } });
    await render([{ id: "media", title: "Media", blocks: [video, audio] }]);
    expect(play).not.toHaveBeenCalled();
    expect([...container.querySelectorAll<HTMLMediaElement>("video, audio")].every((media) => !media.autoplay && media.muted && media.paused)).toBe(true);
    expect(container.querySelector('[data-slide-media-player]')).toBeNull();
  });

  it("honors audio file name visibility while keeping the thumbnail player silent", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const audio = audioBlockSchema.parse({ id: "audio", version: 1, type: "audio", data: { src: "/api/assets/123456789012345678901234/file", fileName: "Narration.mp3" } });
    await render([{ id: "media", title: "Media", blocks: [audio] }]); expect(container.textContent).toContain("Narration.mp3");
    await render([{ id: "media", title: "Media", blocks: [{ ...audio, slidePlayback: { autoPlay: false, showControls: true, showFileName: false } }] }]);
    expect(container.textContent).not.toContain("Narration.mp3"); expect(container.querySelector("audio")!.controls).toBe(true); expect(container.querySelector("audio")!.muted).toBe(true); expect(play).not.toHaveBeenCalled();
  });
});
