// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { audioBlockSchema, type ContentBlock } from "@/lib/schemas/block";
import { ContentBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
const savedAudio = { id: "507f1f77bcf86cd799439011", originalName: "Existing.mp3", contentType: "audio/mpeg", size: 100, fileUrl: "/api/assets/507f1f77bcf86cd799439011/file", createdAt: "2026-01-01" };
const uploadedAudio = { ...savedAudio, id: "507f1f77bcf86cd799439012", originalName: "New.wav", contentType: "audio/wav", fileUrl: "/api/assets/507f1f77bcf86cd799439012/file" };
function Editor() {
  const [block, setBlock] = useState<ContentBlock>(audioBlockSchema.parse({ id: "audio", version: 1, type: "audio", data: { src: "" } }));
  return <ContentBlockEditor block={block} courseId="course" onChange={setBlock} />;
}
function button(label: string) {
  const result = [...document.querySelectorAll("button")].find((node) => node.getAttribute("aria-label") === label || node.textContent === label);
  expect(result, label).toBeDefined();
  return result!;
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/complete")) return Response.json(uploadedAudio);
    if (url === "/upload") return new Response(null, { status: 204 });
    if (init?.method === "POST") return Response.json({ assetId: uploadedAudio.id, uploadUrl: "/upload", fields: {}, method: "PUT", contentType: "audio/wav" });
    return Response.json({ assets: [savedAudio, { ...savedAudio, id: "image", originalName: "Image.png", contentType: "image/png" }] });
  }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  act(() => root.render(<Editor />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it("selects existing audio, uploads a replacement, and updates the player", async () => {
  act(() => button("Open content settings").click());
  await act(async () => button("Choose or upload audio").click());
  expect(container.querySelector('[aria-label="Use Image.png"]')).toBeNull();
  expect(container.querySelector('input[type="file"]')?.getAttribute("accept")).toContain(".wav");
  act(() => button("Use Existing.mp3").click());
  expect(container.querySelector("audio")?.getAttribute("src")).toBe(savedAudio.fileUrl);
  await act(async () => button("Choose or upload audio").click());
  const file = new File(["RIFF0000WAVE"], "New.wav", { type: "audio/x-wav" });
  const input = container.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(fetch).toHaveBeenCalledWith("/api/courses/course/assets", expect.objectContaining({ body: JSON.stringify({ fileName: "New.wav", contentType: "audio/wav", size: file.size }) }));
  act(() => button("Use New.wav").click());
  expect(container.querySelector("audio")?.getAttribute("src")).toBe(uploadedAudio.fileUrl);
  expect(container.querySelector("audio")?.getAttribute("aria-label")).toBe("New.wav");
});
