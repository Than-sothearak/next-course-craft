// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blockSchema, type ContentBlock } from "../lib/schemas/block";
import type { BlockTemplate } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { InteractiveLessonMap, LessonMapEditor } from "../components/lesson-map";
import { LessonMapArtwork, lessonMapTemplates } from "../components/lesson-map-artwork";

const sections = [{ id: "section-a", title: "Foundations", order: 0 }, { id: "section-b", title: "Practice", order: 1 }];
const lessons = [
  { id: "lesson-a", title: "Getting started", sectionId: "section-a", order: 0, lessonType: "content" as const },
  { id: "lesson-b", title: "Core ideas", sectionId: "section-a", order: 1, lessonType: "content" as const },
  { id: "lesson-c", title: "Knowledge check", sectionId: "section-b", order: 0, lessonType: "quiz" as const },
];
const mapTemplate: BlockTemplate = {
  id: "existing-lesson-map",
  category: "Interactive",
  title: "Lesson Map",
  description: "An existing course map",
  type: "lessonMap",
  width: "full",
  preview: "lessonMap",
  lessonMap: {
    template: "modernCity",
    checkpoints: [
      { id: "map-start", title: "Welcome", description: "Begin your learning journey here.", color: "#e27d55", icon: "flag", targetType: "lesson", targetId: "", x: 14, y: 69 },
      { id: "map-discover", title: "Discover", description: "Explore the ideas that shape this topic.", color: "#4b86b4", icon: "book", targetType: "lesson", targetId: "", x: 35, y: 50 },
      { id: "map-practice", title: "Practice", description: "Try a new skill and put it into practice.", color: "#62a36c", icon: "star", targetType: "lesson", targetId: "", x: 61, y: 39 },
      { id: "map-finish", title: "Keep going", description: "Continue to your next course milestone.", color: "#9167a9", icon: "leaf", targetType: "lesson", targetId: "", x: 84, y: 62 },
    ],
  },
};
const initialBlock = createBlocksFromTemplate(mapTemplate, "lesson-map", { sections, lessons })[0];
if (initialBlock.type !== "lessonMap") throw new Error("Expected lesson map block");
const initialLessonMap = initialBlock as Extract<ContentBlock, { type: "lessonMap" }>;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Lesson Map block", () => {
  it("validates map templates and checkpoint settings", () => {
    const parsed = blockSchema.parse(initialLessonMap);
    expect(parsed).toMatchObject({ type: "lessonMap", width: "full", blockPadding: 40 });
    if (parsed.type !== "lessonMap") throw new Error("Expected a lesson map block");
    expect(parsed.data.template).toBe("modernCity");
    expect(parsed.data.checkpoints).toHaveLength(4);
    expect(parsed.data.checkpoints.map((checkpoint) => checkpoint.targetId)).toEqual([
      "lesson-a", "lesson-b", "lesson-c", "lesson-c",
    ]);
    expect(blockSchema.safeParse({ ...initialLessonMap, data: { ...initialLessonMap.data, template: "photo-real-city" } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...initialLessonMap, data: { ...initialLessonMap.data, checkpoints: [{ ...initialLessonMap.data.checkpoints[0], x: 101 }] } }).success).toBe(false);
  });

  it("provides the four locally illustrated map templates and wires all into previews", () => {
    expect(lessonMapTemplates.map((template) => template.title)).toEqual([
      "Modern City", "Farm Fields", "City Province", "Learning Road",
    ]);
    for (const template of lessonMapTemplates) {
      const markup = renderArtwork(template.id);
      expect(markup).toContain(`${template.title} illustrated lesson map`);
      expect(markup).toContain("<svg");
    }
  });

  it("adds, edits, reorders, deletes, and repositions checkpoints through the authoring UI", () => {
    function Probe() {
      const [block, setBlock] = useState(initialLessonMap);
      return <LessonMapEditor block={block} sections={sections} lessons={lessons} saveState="saved" hasUnsavedChanges={false} saveMessage="" onRetrySave={() => {}} onChange={setBlock} />;
    }
    act(() => root.render(<Probe />));
    expect(container.textContent).toContain("Choose a map template");
    expect(container.querySelector('[aria-label="Map preview size"]')).not.toBeNull();

    const farmTemplate = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Farm Fields"))!;
    act(() => farmTemplate.click());
    expect(container.querySelector('[aria-label="Farm Fields illustrated lesson map"]')).not.toBeNull();

    const moveLater = container.querySelector<HTMLButtonElement>('[aria-label="Move Welcome later"]')!;
    act(() => moveLater.click());
    const checkpointTitles = [...container.querySelectorAll("ol li button[aria-pressed]")].map((button) => button.textContent?.trim());
    expect(checkpointTitles[0]).toContain("Discover");

    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    const addButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "+ Add")!;
    act(() => addButton.click());
    expect(container.textContent).toContain("5 on this map");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Checkpoint title"]')?.value).toBe("Checkpoint 5");

    const title = container.querySelector<HTMLInputElement>('[aria-label="Checkpoint title"]')!;
    act(() => setInputValue(title, "Field visit"));
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Checkpoint title"]')?.value).toBe("Field visit");
    const sectionType = container.querySelector<HTMLSelectElement>('[aria-label="Checkpoint destination type"]')!;
    act(() => setSelectValue(sectionType, "section"));
    const target = container.querySelector<HTMLSelectElement>('[aria-label="Checkpoint destination"]')!;
    act(() => setSelectValue(target, "section-b"));
    expect(target.value).toBe("section-b");

    const mapCanvas = container.querySelector<HTMLDivElement>("[data-testid='lesson-map-canvas']")!;
    vi.spyOn(mapCanvas, "getBoundingClientRect").mockReturnValue({ x: 100, y: 200, left: 100, top: 200, right: 500, bottom: 444, width: 400, height: 244, toJSON: () => ({}) });
    const checkpointButton = container.querySelector<HTMLButtonElement>('[aria-label^="Checkpoint 5:"]')!;
    checkpointButton.setPointerCapture = vi.fn();
    act(() => checkpointButton.dispatchEvent(pointerEvent("pointerdown", 160, 280)));
    act(() => mapCanvas.dispatchEvent(pointerEvent("pointermove", 300, 322)));
    act(() => mapCanvas.dispatchEvent(pointerEvent("pointerup", 300, 322)));
    const movedCheckpoint = container.querySelector<HTMLButtonElement>('[aria-label^="Checkpoint 5:"]')!;
    expect(movedCheckpoint.style.left).toBe("50%");
    expect(movedCheckpoint.style.top).toBe("50%");

    const deleteButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.getAttribute("aria-label")?.startsWith("Delete Field visit"))!;
    act(() => deleteButton.click());
    expect(container.textContent).toContain("4 on this map");
  });

  it("uses existing lesson completion and lock state and opens the linked lesson", () => {
    const onOpenLesson = vi.fn();
    const getLessonNavigationLockMessage = (lessonId: string) => lessonId === "lesson-c" ? "Complete the current lesson first." : null;
    act(() => root.render(<InteractiveLessonMap
      block={initialLessonMap}
      lessons={lessons}
      visitedLessonIds={new Set(["lesson-a"])}
      passedQuizIds={new Set()}
      getLessonNavigationLockMessage={getLessonNavigationLockMessage}
      onOpenLesson={onOpenLesson}
    />));

    expect(container.querySelector('[aria-label^="Checkpoint 1: Welcome, completed"]')).not.toBeNull();
    expect(container.querySelector('[aria-label^="Checkpoint 2: Discover, available"]')).not.toBeNull();
    expect(container.querySelector('[aria-label^="Checkpoint 3: Practice, locked"]')).not.toBeNull();

    act(() => container.querySelector<HTMLButtonElement>('[aria-label^="Checkpoint 2:"]')!.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Explore the ideas that shape this topic.");
    const openButton = container.querySelector<HTMLButtonElement>('[role="dialog"] button')!;
    expect(openButton.disabled).toBe(false);
    act(() => openButton.click());
    expect(onOpenLesson).toHaveBeenCalledWith("lesson-b");

    act(() => container.querySelector<HTMLButtonElement>('[aria-label^="Checkpoint 3:"]')!.click());
    expect(container.querySelector<HTMLButtonElement>('[role="dialog"] button')?.disabled).toBe(true);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Locked");
  });

  it("resolves a section destination to its first lesson", () => {
    const onOpenLesson = vi.fn();
    const sectionBlock = {
      ...initialLessonMap,
      data: {
        ...initialLessonMap.data,
        checkpoints: [{ ...initialLessonMap.data.checkpoints[0], targetType: "section" as const, targetId: "section-b" }],
      },
    };
    act(() => root.render(<InteractiveLessonMap block={sectionBlock} lessons={lessons} visitedLessonIds={new Set()} passedQuizIds={new Set()} getLessonNavigationLockMessage={() => null} onOpenLesson={onOpenLesson} />));
    act(() => container.querySelector<HTMLButtonElement>('[aria-label^="Checkpoint 1:"]')!.click());
    act(() => container.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
    expect(onOpenLesson).toHaveBeenCalledWith("lesson-c");
  });
});

function renderArtwork(template: (typeof lessonMapTemplates)[number]["id"]) {
  return renderToStaticMarkup(createElement(LessonMapArtwork, { template }));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function pointerEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, clientX: { value: clientX }, clientY: { value: clientY } });
  return event;
}
