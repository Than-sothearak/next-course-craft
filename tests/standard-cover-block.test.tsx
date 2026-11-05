/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { StandardLessonEditor } from "@/app/courses/[courseId]/edit/standard-mode/_components/standard-lesson-editor";
import type { ContentBlock } from "@/lib/schemas/block";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("standard lesson image cover width", () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("lets a cover image fill the lesson content width in the editor", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const cover: ContentBlock = {
      id: "cover",
      version: 1,
      type: "image",
      width: "full",
      widthCustom: false,
      backgroundColor: "#1e293b",
      blockPadding: 0,
      data: {
        src: "https://example.com/cover.jpg",
        alt: "Course cover",
        layout: "cover",
      },
    };

    await act(async () => root.render(<StandardLessonEditor
      lesson={{ id: "lesson", sectionId: "section", title: "Lesson", order: 0, lessonType: "content", quizQuestions: [], blocks: [cover] }}
      courseId="course"
      sections={[]}
      lessons={[]}
      saveState="saved"
      hasUnsavedChanges={false}
      saveMessage=""
      onRetrySave={() => {}}
      onTitleChange={() => {}}
      onTitleValidityChange={() => {}}
      onReorderBlocks={() => {}}
      onAddBlock={() => {}}
      onMoveBlock={() => {}}
      onDuplicateBlock={() => {}}
      onDeleteBlock={() => {}}
      onChangeBlock={() => {}}
      onReplaceTemplate={() => {}}
    />));

    expect(container.querySelector('[data-image-layout="cover"]')).not.toBeNull();
    const blockContainer = container.querySelector('[data-editor-block-id="cover"] .mx-auto');
    expect(blockContainer?.className).toContain("max-w-none");
    expect(blockContainer?.className).toContain("px-0");
    for (const label of ["Move block up", "Move block down", "Format block", "Duplicate block", "Delete block"]) {
      expect(container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.className).toContain("bg-white");
    }
  });
});
