/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseThemeSettings } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/course-theme-settings";
import { defaultCourseTheme, type CourseTheme } from "../lib/editor/theme";
import { courseCoverTemplates } from "../lib/editor/course-cover";

vi.mock("../app/courses/[courseId]/edit/_components/media-library-dialog", () => ({ MediaLibraryDialog: ({ open, courseId, onSelect }: { open: boolean; courseId: string; onSelect: (asset: { fileUrl: string; originalName: string }) => void }) => open ? <button aria-label={`Pick image for ${courseId}`} onClick={() => onSelect({ fileUrl: "/api/assets/123456789012345678901234/file", originalName: "Course landscape" })}>Choose landscape</button> : null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("course cover settings", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: CourseTheme;
  function Settings() {
    const [theme, setTheme] = useState(defaultCourseTheme);
    latest = theme;
    return <CourseThemeSettings courseId="course" courseTitle="Learning CSS" theme={theme} onChange={setTheme} />;
  }
  beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); act(() => root.render(<Settings />)); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const click = (label: string) => act(() => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const select = (label: string, value: string) => act(() => { const control = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; control.value = value; control.dispatchEvent(new Event("change", { bubbles: true })); });

  it.each(courseCoverTemplates)("selects the $label design and previews the course title", ({ id, label }) => {
    click(`Use ${label} cover`);
    expect(latest.cover?.template).toBe(id);
    const preview = container.querySelector('[aria-label="Course cover preview"]')!;
    expect(preview.querySelector("[data-course-cover]")?.getAttribute("data-course-cover")).toBe(id);
    expect(preview.textContent).toContain("Learning CSS");
  });

  it("selects an owned media-library image and edits its presentation", () => {
    click("Use Image cover");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Choose cover image"))!.click());
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Pick image for course"]')!.click());
    expect(latest.cover).toMatchObject({ template: "image", imageSrc: "/api/assets/123456789012345678901234/file", imageAlt: "Course landscape" });
    select("Cover image position", "bottom");
    select("Cover title alignment", "left");
    expect(latest.cover).toMatchObject({ imagePosition: "bottom", alignment: "left" });
    expect(container.querySelector('[aria-label="Course cover preview"] img')?.getAttribute("src")).toBe(latest.cover?.imageSrc);
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Remove image")!.click());
    expect(latest.cover?.imageSrc).toBe("");
  });

  it("preserves the cover when changing palettes and resets with the theme", () => {
    click("Use Waves cover");
    select("Cover title alignment", "left");
    click("Use Forest theme");
    expect(latest.cover).toMatchObject({ template: "waves", alignment: "left" });
    expect(latest.primaryColor).toBe("#24734f");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Reset")!.click());
    expect(latest).toEqual(defaultCourseTheme);
  });

  it("offers Khmer typefaces and previews the selected Khmer font", () => {
    select("Course typography", "battambang");
    expect(latest.fontFamily).toBe("battambang");
    expect(container.querySelector('[lang="km"]')?.getAttribute("style")).toContain("Battambang");

    select("Course typography", "kantumruy-pro");
    expect(latest.fontFamily).toBe("kantumruy-pro");
    expect(container.querySelector('[lang="km"]')?.getAttribute("style")).toContain("Kantumruy Pro");
  });

  it("updates cover and text colors in the live preview", () => {
    click("Use Solid color cover");
    const changeColor = (label: string, value: string) => act(() => {
      const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    changeColor("Cover background color", "#ffffff");
    changeColor("Cover text color", "#123456");
    expect(latest.cover).toMatchObject({ backgroundColor: "#ffffff", textColor: "#123456" });
    const preview = container.querySelector<HTMLElement>('[aria-label="Course cover preview"] [data-course-cover]')!;
    expect(preview.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(preview.style.color).toBe("rgb(18, 52, 86)");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Use brand color")!.click());
    expect(latest.cover?.backgroundColor).toBeUndefined();
  });
});
