/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublishMenu, receiveExport } from "@/components/publish-menu";
import { createEmbeddedMediaTable, replaceExportMediaReferences } from "@/lib/export/embedded-media";

describe("publish format menu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("offers HTML, PDF handout, SCORM 1.2, and SCORM 2004 exports", () => {
    act(() => {
      root.render(createElement(PublishMenu, { courseId: "course-1", title: "Sample course" }));
    });

    act(() => container.querySelector<HTMLButtonElement>("button")?.click());

    const menu = container.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect([...menu!.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual([
      "HTML",
      "PDF handout",
      "SCORM 1.2",
      "SCORM 2004",
    ]);
  });

  it("receives streamed export progress and the final binary file", async () => {
    const header = new TextEncoder().encode(`${JSON.stringify({ type: "progress", stage: "Packaging", value: 70 })}\n${JSON.stringify({ type: "file", filename: "course.zip", size: 3 })}\n`);
    const body = new Uint8Array(header.length + 3);
    body.set(header); body.set([80, 75, 3], header.length);
    const updates: Array<{ stage: string; value: number }> = [];
    const result = await receiveExport(new Response(body), (stage, value) => updates.push({ stage, value }));
    expect(result.filename).toBe("course.zip");
    const fileBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
      fileReader.onerror = () => reject(fileReader.error);
      fileReader.readAsArrayBuffer(result.blob);
    });
    expect([...new Uint8Array(fileBytes)]).toEqual([80, 75, 3]);
    expect(updates).toEqual([{ stage: "Packaging", value: 70 }, { stage: "Downloading export", value: 94 }, { stage: "Downloading export", value: 99 }, { stage: "Download ready", value: 100 }]);
  });

  it("stores one media payload and reuses its reference throughout course data", () => {
    const id = "507f1f77bcf86cd799439013";
    const table = createEmbeddedMediaTable([{ id, dataUri: "data:image/png;base64,AQID" }]);
    const course = replaceExportMediaReferences({ first: `/api/assets/${id}/file`, second: `/api/assets/${id}/file` }, table.references, /\/api\/assets\/([\da-f]{24})\/file/g);
    expect(Object.keys(table.media)).toEqual([id]);
    expect(JSON.stringify(course).match(/coursecraft-media:/g)).toHaveLength(2);
    expect(JSON.stringify(table.media).match(/AQID/g)).toHaveLength(1);
  });
});
