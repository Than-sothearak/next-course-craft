/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";
import { SlidePlaybackControls } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-playback-controls";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cases = [["audio", "standard"], ["video", "standard"], ["audio", "slides"], ["video", "slides"]] as const;

describe("media skipping settings", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it.each(cases)("defaults %s skipping on in %s and retains the setting through saving and export", async (type, layout) => {
    const block = blockSchema.parse({ id: "media", type, version: 1, requiredForProgress: false, slidePlayback: { muted: true }, data: { src: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", mimeType: type === "video" ? "video/webm" : "audio/mpeg" } });
    const onChange = vi.fn();
    const render = (content: ContentBlock) => act(async () => root.render(layout === "slides" ? <SlidePlaybackControls block={content} onChange={onChange} /> : <ContentBlockEditor block={content} onChange={onChange} courseId="course" inlineSettings />));
    await render(block);
    const toggle = () => container.querySelector<HTMLInputElement>('[role="switch"][aria-label="Allow skipping"]')!;
    expect(toggle().checked).toBe(true);
    act(() => toggle().click());
    const changed = onChange.mock.lastCall![0] as ContentBlock;
    expect(changed).toEqual({ ...block, allowSkipping: false });
    const snapshot = editorSnapshotSchema.parse({ title: "Media", description: "", revision: 1, courseLayout: layout, sections: [{ id: "section", title: "Section", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Lesson", order: 0, blocks: [changed] }] });
    const exported = parseScorm12Snapshot(JSON.parse(JSON.stringify(snapshot))).lessons[0].blocks[0];
    expect(exported).toMatchObject({ allowSkipping: false, requiredForProgress: false, slidePlayback: { muted: true } });
    await render(exported);
    expect(toggle().checked).toBe(false);
    act(() => toggle().click());
    expect(onChange.mock.lastCall![0]).toMatchObject({ allowSkipping: true, requiredForProgress: false });
    expect(blockSchema.safeParse({ ...block, allowSkipping: "false" }).success).toBe(false);
  });
});
