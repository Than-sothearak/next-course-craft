/** @vitest-environment jsdom */
import { act } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { blockSchema, statementStyleSchema, type ContentBlock } from "@/lib/schemas/block";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function statement(style: string, titleHtml?: string) {
  return blockSchema.parse({ id: "statement", version: 1, type: "statement", data: { style, title: "Title", titleHtml, body: "Explanation" } });
}

function steps(style: string, titleHtml?: string) {
  return blockSchema.parse({ id: "steps", version: 1, type: "processSteps", data: { style, steps: [{ id: "one", title: "Title", titleHtml, body: "Explanation" }, { id: "two", title: "Next", body: "Finish" }] } });
}

describe("Statement and Step slider title defaults", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(block: ContentBlock) {
    await act(async () => root.render(<>
      <div data-author><ContentBlockEditor block={block} courseId="course" onChange={vi.fn()} /></div>
      <div data-preview><PreviewBlock block={block} device="desktop" orientation="landscape" /></div>
    </>));
  }

  function titleEditor() {
    return container.querySelector<HTMLElement & { editor: Editor }>('[data-author] [contenteditable="true"]')!;
  }

  it.each(statementStyleSchema.options)("defaults %s Statement titles to editable paragraphs and matches preview", async (style) => {
    await render(statement(style));
    expect(titleEditor().querySelector("p")?.textContent).toBe("Title");
    expect(titleEditor().editor.isActive("paragraph")).toBe(true);
    expect(titleEditor().closest('[data-block-text-role="title"]')?.className).toContain("text-[20px]");
    expect(container.querySelector('[data-preview] [data-block-text-role="title"] p')?.textContent).toBe("Title");
    expect(container.querySelector('[data-preview] [data-block-text-role="title"]')?.className).toContain("text-[20px]");
  });

  it("defaults Step slider titles to paragraphs and retains the default on later steps", async () => {
    await render(steps("slider"));
    expect(titleEditor().querySelector("p")?.textContent).toBe("Title");
    expect(titleEditor().editor.isActive("paragraph")).toBe(true);
    expect(container.querySelector('[data-preview] p[data-block-text-role="title"]')?.textContent).toBe("Title");
    await act(async () => container.querySelector<HTMLButtonElement>('[data-author] [aria-label="Go to next process step"]')!.click());
    expect(titleEditor().querySelector("p")?.textContent).toBe("Next");
  });

  it.each(["statement", "slider"])("preserves authored headings and inline sizes in %s titles", async (type) => {
    const html = '<h2><span style="font-size: 37px">Title</span></h2>';
    await render(type === "statement" ? statement("key", html) : steps("slider", html));
    for (const scope of ["data-author", "data-preview"]) {
      expect(container.querySelector(`[${scope}] h2 span`)?.textContent).toBe("Title");
      expect(container.querySelector<HTMLElement>(`[${scope}] h2 span`)?.style.fontSize).toBe("37px");
      expect(container.querySelector(`[${scope}] h5`)).toBeNull();
    }
    expect(titleEditor().editor.getAttributes("heading").level).toBe(2);
  });

  it("keeps Classic process-step titles at Heading 3", async () => {
    await render(steps("cards"));
    expect(titleEditor().querySelector("h3")?.textContent).toBe("Title");
    expect(container.querySelector("[data-preview] h3")?.textContent).toBe("Title");
  });
});
