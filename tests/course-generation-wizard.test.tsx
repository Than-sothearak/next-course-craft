/** @vitest-environment jsdom */
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui/dialog";
import { CourseGenerationWizard } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/course-generation-wizard";
import { courseGenerationInputSchema } from "@/lib/ai/course-generation-schemas";
import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
import { courseCoverSchema } from "@/lib/editor/course-cover";
import { CourseOverviewEditor } from "@/app/courses/[courseId]/edit/standard-mode/_components/course-overview-editor";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

const input = courseGenerationInputSchema.parse({ prompt: "Teach HTML", audience: "Students", level: "beginner", lessonCount: 5, template: "custom", includeImages: false, courseTitle: "", courseDescription: "" });
const session: GenerationSessionSnapshot = { id: "507f1f77bcf86cd799439013", status: "outline", input, error: null, readyToSave: false, currentLessonId: "lesson-0", completedLessonIds: [], outline: { title: "HTML course", description: "Learn HTML", sections: [{ id: "learn", title: "Learn", lessons: Array.from({ length: 5 }, (_, index) => ({ id: `lesson-${index}`, title: `HTML ${index + 1}`, objective: `Explain HTML topic ${index + 1}`, kind: "learn" })) }] } };
const editor = editorSnapshotSchema.parse({ title: "HTML course", description: "Learn HTML", revision: 2, sections: [{ id: "learn", title: "Learn", order: 0 }], lessons: [] });
let container: HTMLDivElement, root: Root;
const fetchMock = vi.fn();
const onStarted = vi.fn(), onClose = vi.fn();
const runServerMutation: ComponentProps<typeof CourseGenerationWizard>["runServerMutation"] = async (operation) => operation(1);
const renderWizard = (savedSession: GenerationSessionSnapshot | null = null) => act(async () => root.render(<CourseGenerationWizard open onClose={onClose} courseId="course" courseTitle="" courseDescription="" existingLessonCount={0} savedSession={savedSession} runServerMutation={runServerMutation} onStarted={onStarted} />));
const click = async (text: string) => act(async () => { const button = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(text)); expect(button).toBeTruthy(); button!.click(); });
const type = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => act(async () => { const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  window.localStorage.clear(); vi.clearAllMocks();
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("AI course review wizard", () => {
  it("ignores outside clicks and Escape until the Close button is clicked", async () => {
    await renderWizard();
    const dialog = container.querySelector("dialog")!;
    const cancel = new Event("cancel", { bubbles: true, cancelable: true });
    await act(async () => { dialog.dispatchEvent(new MouseEvent("click", { bubbles: true })); dialog.dispatchEvent(cancel); });
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("asks before closing the outline and keeps edits when continuing", async () => {
    await renderWizard(session);
    const title = [...container.querySelectorAll("label")].find((label) => label.textContent === "Course title")!.querySelector("input")!;
    await type(title, "Keep my outline changes");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click());
    expect(onClose).not.toHaveBeenCalled();
    const warning = container.querySelector('[role="alertdialog"]')!;
    expect(warning.textContent).toContain("Unsaved changes to this outline will be lost");
    await click("Continue editing");
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(title.value).toBe("Keep my outline changes");
    expect(onClose).not.toHaveBeenCalled();
  });
  it("closes the outline only after the warning is confirmed", async () => {
    await renderWizard(session);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click());
    const warning = container.querySelector('[role="alertdialog"]')!;
    await act(async () => [...warning.querySelectorAll("button")].find((button) => button.textContent === "Close")!.click());
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("treats Escape on the confirmation as continuing the outline", async () => {
    await renderWizard(session);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click());
    const warning = container.querySelector('[role="alertdialog"]')!;
    await act(async () => warning.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
  it("shows all four steps and waits for approval before saving lesson drafts", async () => {
    await renderWizard();
    expect(container.querySelector('[aria-label="Course generation steps"]')?.textContent).toContain("1. Source material2. Course details3. Course outline4. Lesson drafts");
    await type(container.querySelector("textarea")!, "Teach HTML");
    await click("Continue to course details");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session)));
    await click("Generate outline");
    expect(container.textContent).toContain("Review and correct the outline");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).action).toBe("plan");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input.generateCoverImage).toBe(false);
    expect(onStarted).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session: { ...session, status: "generating" }, editor })));
    await click("Approve outline and generate lessons");
    const request = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(request).toMatchObject({ action: "approve", revision: 1, mode: "replace", outline: session.outline });
    expect(onStarted).toHaveBeenCalledWith(expect.objectContaining({ status: "generating" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onStarted.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  });
  it("uses switch controls for image options and submits the enabled cover choice", async () => {
    await renderWizard();
    const coverSwitch = container.querySelector<HTMLInputElement>('[role="switch"][aria-label="Generate course cover image"]')!;
    expect(coverSwitch.checked).toBe(false);
    expect(container.textContent).not.toContain("Used on the dashboard card and as the learner cover");
    await act(async () => coverSwitch.click());
    expect(coverSwitch.checked).toBe(true);
    await click("Continue to course details");
    expect(container.querySelector('[role="switch"][aria-label="Generate supplemental images"]')).not.toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...session, input: { ...input, generateCoverImage: true } })));
    await click("Generate outline");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input.generateCoverImage).toBe(true);
  });
  it("removes and reorders Custom sections and preserves the reviewed lesson order", async () => {
    const custom: GenerationSessionSnapshot = { ...session, outline: { ...session.outline, sections: [session.outline.sections[0],
      { id: "practice", title: "Practice", lessons: [{ id: "practice-1", title: "Practice one", objective: "Practice", kind: "learn" }, { id: "practice-2", title: "Practice two", objective: "Practice", kind: "learn" }] },
      { id: "remove", title: "Unused", lessons: [{ id: "unused", title: "Unused lesson", objective: "Unused", kind: "learn" }] },
    ] } };
    await renderWizard(custom);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Move section Practice up"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Move Practice two up"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Remove section Unused"]')!.click());
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session: { ...session, status: "generating" }, editor })));
    await click("Approve outline and generate lessons");
    const approved = JSON.parse(fetchMock.mock.calls[0][1].body).outline;
    expect(approved.sections.map((section: { id: string }) => section.id)).toEqual(["practice", "learn"]);
    expect(approved.sections[0].lessons.map((lesson: { id: string }) => lesson.id)).toEqual(["practice-2", "practice-1"]);
    expect(approved.sections.flatMap((section: { lessons: { id: string }[] }) => section.lessons).some((lesson: { id: string }) => lesson.id === "unused")).toBe(false);
  });
  it("keeps the last Custom section from being removed", async () => {
    await renderWizard(session);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Remove section Learn"]')!.disabled).toBe(true);
  });
  it("lets an author correct, reorder, remove and add lessons before approval", async () => {
    await renderWizard(session);
    const firstTitle = [...container.querySelectorAll("label")].find((label) => label.textContent === "Lesson title")!.querySelector("input")!;
    await type(firstTitle, "Corrected title");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Move Corrected title down"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Remove HTML 3"]')!.click());
    await click("Add lesson");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session: { ...session, status: "generating" }, editor })));
    await click("Approve outline and generate lessons");
    const approved = JSON.parse(fetchMock.mock.calls[0][1].body).outline.sections[0].lessons;
    expect(approved[1].title).toBe("Corrected title");
    expect(approved.some((lesson: { title: string }) => lesson.title === "HTML 3")).toBe(false);
    expect(approved.at(-1).title).toBe("New lesson");
  });
  it("adds Custom sections and lessons and includes them in the approved outline", async () => {
    await renderWizard(session);
    await click("Add section");
    const sections = container.querySelectorAll<HTMLElement>("[data-outline-section-id]");
    expect(sections).toHaveLength(2);
    expect(sections[0].querySelector("[data-outline-section-number]")?.textContent).toBe("Section #1");
    expect(sections[0].querySelector("[data-outline-section-number]")?.className).toContain("text-lg font-bold");
    const added = sections[1];
    expect(added.querySelector("[data-outline-section-number]")?.textContent).toBe("Section #2");
    await type(added.querySelector("input")!, "Practice");
    await type([...added.querySelectorAll("label")].find((label) => label.textContent === "Lesson title")!.querySelector("input")!, "Practice task");
    await act(async () => [...added.querySelectorAll("button")].find((button) => button.textContent === "Add lesson")!.click());
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session: { ...session, status: "generating" }, editor })));
    await click("Approve outline and generate lessons");
    const approved = JSON.parse(fetchMock.mock.calls[0][1].body).outline;
    expect(approved.sections).toHaveLength(2);
    expect(approved.sections[1].title).toBe("Practice");
    expect(approved.sections[1].lessons.map((lesson: { title: string }) => lesson.title)).toEqual(["Practice task", "New lesson"]);
    const ids = approved.sections.flatMap((section: { lessons: { id: string }[] }) => section.lessons.map((lesson) => lesson.id));
    expect(new Set(ids).size).toBe(7);
  });

  it("previews the prepared course-card image with the editable title below it", async () => {
    await renderWizard({ ...session, cover: courseCoverSchema.parse({ template: "image", imageSrc: "/api/assets/507f1f77bcf86cd799439014/file", titleOnly: true }) });
    const preview = container.querySelector('[aria-label="Course card image preview"]')!;
    expect(preview.querySelector("img")?.classList.contains("aspect-video")).toBe(true);
    expect(preview.textContent).toBe("HTML course");
    const title = [...container.querySelectorAll("label")].find((label) => label.textContent === "Course title")!.querySelector("input")!;
    await type(title, "Updated course title");
    expect(preview.textContent).toBe("Updated course title");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps approval available when the outline has a cover warning", async () => {
    await renderWizard({ ...session, coverWarning: "The outline is ready, but the cover could not be generated." });
    expect(container.textContent).toContain("cover could not be generated");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Approve outline"))!.disabled).toBe(false);
  });
  it("requires a new outline after changing course details", async () => {
    await renderWizard(session);
    await click("Back");
    const title = [...container.querySelectorAll("label")].find((label) => label.textContent === "Course title (optional)")!.querySelector("input")!;
    await type(title, "New course title");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(session)));
    await click("Generate outline");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: "plan", input: { courseTitle: "New course title" } });
  });
});



describe("original course editor layout", () => {
  it("keeps the title in the original large text field without an image banner", async () => {
    const onTitleChange = vi.fn();
    await act(async () => root.render(<CourseOverviewEditor title="HTML course" titleValid authorVisible description="Learn HTML" authorName="Author" primaryColor="#2f5f9f" accentColor="#ff876c" onTitleChange={onTitleChange} onAuthorVisibilityChange={() => {}} onDescriptionChange={() => {}} />));
    const title = container.querySelector<HTMLTextAreaElement>('[aria-label="Course title"]')!;
    expect(title.value).toBe("HTML course"); expect(title.classList.contains("text-[36px]")).toBe(true);
    expect(container.querySelector('[data-course-cover]')).toBeNull();
    await type(title, "Edited title");
    expect(onTitleChange).toHaveBeenCalledWith("Edited title");
  });
});


describe("shared dialog dismissal defaults", () => {
  it("retains outside-click and Escape dismissal for other dialogs", async () => {
    const close = vi.fn();
    await act(async () => root.render(<Dialog open onClose={close} title="Other dialog">Content</Dialog>));
    const dialog = container.querySelector("dialog")!;
    await act(async () => dialog.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(async () => dialog.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(close).toHaveBeenCalledTimes(2);
  });
});
