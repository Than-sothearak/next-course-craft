// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideMediaPicker } from "@/app/courses/[courseId]/edit/_components/slide-presentation/slide-media-picker";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const assets = [
  { id: "507f1f77bcf86cd799439011", originalName: "Slide.png", contentType: "image/png", size: 100, fileUrl: "/api/assets/507f1f77bcf86cd799439011/file", createdAt: "2026-01-01" },
  { id: "507f1f77bcf86cd799439012", originalName: "Clip.mp4", contentType: "video/mp4", size: 200, fileUrl: "/api/assets/507f1f77bcf86cd799439012/file", createdAt: "2026-01-01" },
  { id: "507f1f77bcf86cd799439013", originalName: "Narration.mp3", contentType: "audio/mpeg", size: 300, fileUrl: "/api/assets/507f1f77bcf86cd799439013/file", createdAt: "2026-01-01" },
  { id: "507f1f77bcf86cd799439014", originalName: "Handout.pdf", contentType: "application/pdf", size: 400, fileUrl: "/api/assets/507f1f77bcf86cd799439014/file", createdAt: "2026-01-01" },
];
const samples = {
  image: blockSchema.parse({ id: "image", version: 1, type: "image", data: { src: "/placeholder", alt: "" } }),
  video: blockSchema.parse({ id: "video", version: 1, type: "video", data: { src: "/placeholder" } }),
  audio: blockSchema.parse({ id: "audio", version: 1, type: "audio", data: { src: "" } }),
  attachment: blockSchema.parse({ id: "attachment", version: 1, type: "attachment", data: { src: "", fileName: "", size: 0 } }),
  gallery: blockSchema.parse({ id: "gallery", version: 1, type: "gallery", data: { images: [{ src: "/placeholder", alt: "" }] } }),
  labeledGraphic: blockSchema.parse({ id: "graphic", version: 1, type: "labeledGraphic", data: { src: "", mapTemplate: "learningRoad", alt: "Diagram", markers: [{ id: "marker", label: "Part", description: "", x: 50, y: 50 }] } }),
};
let root: Root;
let container: HTMLDivElement;
function Fixture({ initial }: { initial: ContentBlock }) {
  const [block, setBlock] = useState(initial);
  return <><SlideMediaPicker block={block} courseId="course" onChange={setBlock} /><output>{JSON.stringify(block.data)}</output></>;
}
function button(label: string) {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label || item.getAttribute("aria-label") === label);
  expect(found, label).toBeDefined();
  return found!;
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ assets })));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("slide media picker", () => {
  it.each([
    ["image", "Choose or upload image", "Slide.png", 0],
    ["video", "Choose or upload video", "Clip.mp4", 1],
    ["audio", "Choose or upload audio", "Narration.mp3", 2],
    ["attachment", "Choose or upload file", "Handout.pdf", 3],
    ["labeledGraphic", "Choose or upload image", "Slide.png", 0],
  ] as const)("attaches an existing %s file to a slide object", async (type, openLabel, filename, assetIndex) => {
    act(() => root.render(<Fixture initial={samples[type]} />));
    await act(async () => button(openLabel).click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => button(`Use ${filename}`).click());
    expect(container.querySelector("output")?.textContent).toContain(assets[assetIndex].fileUrl);
    if (type === "labeledGraphic") expect(JSON.parse(container.querySelector("output")!.textContent!).mapTemplate).toBeUndefined();
    if (type === "audio" || type === "attachment") expect(container.querySelector("output")?.textContent).toContain(filename);
  });

  it("adds a second gallery image from an uploaded file", async () => {
    const uploaded = { ...assets[0], id: "507f1f77bcf86cd799439015", originalName: "New.png", fileUrl: "/api/assets/507f1f77bcf86cd799439015/file" };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/complete")) return Response.json(uploaded);
      if (url === "/upload") return new Response(null, { status: 204 });
      if (init?.method === "POST") return Response.json({ assetId: uploaded.id, uploadUrl: "/upload", fields: {}, method: "PUT", contentType: "image/png" });
      return Response.json({ assets: [] });
    }));
    act(() => root.render(<Fixture initial={samples.gallery} />));
    await act(async () => button("Add gallery image").click());
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["image"], "New.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    act(() => button("Use New.png").click());
    const data = JSON.parse(container.querySelector("output")!.textContent!);
    expect(data.images).toHaveLength(2);
    expect(data.images[1].src).toBe(uploaded.fileUrl);
  });
});
