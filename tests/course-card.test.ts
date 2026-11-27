/** @vitest-environment jsdom */

import { act, createElement, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseCard } from "@/app/dashboard/_components/(dashboard_client_components)/course-card";
import { roleCeilings } from "@/lib/auth/policy";
import type { DashboardCourse, DashboardData } from "@/lib/dashboard/types";

const course: DashboardCourse = {
  id: "course-1",
  title: "Sample course",
  description: "A sample course for testing.",
  coverImage: null,
  courseLayout: "standard",
  folderId: null,
  status: "draft",
  revision: 1,
  updatedAt: "2026-10-14T00:00:00.000Z",
  lessonCount: 2,
  accessRole: "owner", permissions: [...roleCeilings.editor],
};

const data: DashboardData = {
  currentFolder: null,
  breadcrumbs: [],
  folders: [],
  courses: [course],
  folderOptions: [],
  folderTree: [],
  workspaces: [],
  workspaceId: null,
  workspaceName: "Personal",
  workspaceRole: "owner", permissions: [...roleCeilings.editor],
};

describe("course card actions", () => {
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("publishes from the card and opens sharing in the three-dot settings popup", () => {
    act(() => {
      root.render(createElement(CourseCard, {
        course,
        data,
        disabled: false,
        busy: false,
        onSubmit: async () => {},
        onRequest: async () => {},
      }));
    });

    expect(container.querySelector(".aspect-video.rounded-t-2xl.overflow-hidden")).not.toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
    expect(container.querySelector('a[href="/courses/course-1/access"]')).toBeNull();
    const publishButton = container.querySelector<HTMLButtonElement>('button[aria-label="Publish course"]')!;
    expect(publishButton.textContent).toBe("Publish");
    act(() => publishButton.click());
    const menu = container.querySelector('[role="menu"][aria-label="Publish format"]');
    expect([...menu!.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual([
      "HTML",
      "PDF handout",
      "SCORM 1.2",
      "SCORM 2004",
      "Share link",
    ]);
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="menu"]')).toBeNull();

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
    act(() => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const dialog = document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
    expect(dialog.textContent).toContain("Course settings");
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.getAttribute("aria-modal")).toBe("false");
    expect(document.documentElement.style.overflow).toBe("");
    expect(dialog.querySelector('button[aria-label="Publish course"]')).toBeNull();
    expect(dialog.querySelector('a[href="/courses/course-1/access"]')?.textContent).toBe("Share access");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(dialog.dataset.state).toBe("closed");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("uses one accessible card-wide editor link with separate action controls", () => {
    act(() => root.render(createElement(CourseCard, { course, data, disabled: false, busy: false, onSubmit: async () => {}, onRequest: async () => {} })));
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/courses/course-1/edit/standard-mode");
    expect(links[0].getAttribute("aria-label")).toBe("Open editor: Sample course");
    expect(links[0].className).toContain("after:inset-0");
    expect(links[0].className).toContain("focus-visible:after:outline-2");
    expect(links[0].querySelector("button")).toBeNull();
  });

  it("allows moving between the three-dot trigger and popup, then closes on mouse leave", () => {
    vi.useFakeTimers();
    act(() => root.render(createElement(CourseCard, { course, data, disabled: false, busy: false, onSubmit: async () => {}, onRequest: async () => {} })));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
    act(() => trigger.click());
    const dialog = document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
    const pointer = (type: string, relatedTarget: EventTarget, pointerType = "mouse") => Object.assign(new MouseEvent(type, { bubbles: true, relatedTarget }), { pointerType });
    act(() => {
      trigger.dispatchEvent(pointer("pointerout", document.body));
      vi.advanceTimersByTime(100);
      dialog.dispatchEvent(pointer("pointerover", document.body));
      vi.advanceTimersByTime(300);
    });
    expect(dialog.dataset.state).toBe("open");
    act(() => {
      dialog.dispatchEvent(pointer("pointerout", trigger));
      vi.advanceTimersByTime(300);
    });
    expect(dialog.dataset.state).toBe("open");
    act(() => {
      dialog.querySelector("input")!.dispatchEvent(pointer("pointerout", dialog.querySelector("select")!));
      vi.advanceTimersByTime(300);
    });
    expect(dialog.dataset.state).toBe("open");
    act(() => {
      dialog.dispatchEvent(pointer("pointerout", document.body));
      vi.advanceTimersByTime(250);
    });
    expect(dialog.dataset.state).toBe("closed");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the three-dot popup open for touch and cancels mouse dismissal while saving", () => {
    vi.useFakeTimers();
    const props = { course, data, disabled: false, busy: false, onSubmit: async () => {}, onRequest: async () => {} };
    act(() => root.render(createElement(CourseCard, props)));
    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    const dialog = document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
    const leave = (pointerType: string) => Object.assign(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }), { pointerType });
    act(() => {
      dialog.dispatchEvent(leave("touch"));
      vi.advanceTimersByTime(300);
    });
    expect(dialog.dataset.state).toBe("open");
    act(() => dialog.dispatchEvent(leave("mouse")));
    act(() => root.render(createElement(CourseCard, { ...props, busy: true })));
    act(() => vi.advanceTimersByTime(300));
    expect(dialog.dataset.state).toBe("open");
    act(() => {
      dialog.dispatchEvent(leave("mouse"));
      vi.advanceTimersByTime(300);
    });
    expect(dialog.dataset.state).toBe("open");
  });

  it("keeps publishing and sharing permissions and disables card actions while saving", () => {
    const props = { course, data, disabled: false, busy: false, onSubmit: async () => {}, onRequest: async () => {} };
    for (const permission of ["courses.publish", "courses.export"] as const) {
      act(() => root.render(createElement(CourseCard, { ...props, course: { ...course, permissions: course.permissions?.filter((value) => value !== permission) } })));
      expect(container.querySelector('button[aria-label="Publish course"]')).toBeNull();
    }
    act(() => root.render(createElement(CourseCard, { ...props, busy: true })));
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Publish course"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.disabled).toBe(true);
    act(() => root.render(createElement(CourseCard, { ...props, disabled: true })));
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Publish course"]')?.disabled).toBe(true);
    act(() => root.render(createElement(CourseCard, { ...props, course: { ...course, permissions: course.permissions?.filter((value) => value !== "courses.assign") } })));
    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    expect(document.querySelector('[data-card-popover] a[href="/courses/course-1/access"]')).toBeNull();
  });

  it("identifies standard and slide presentation cards even when a cover image is set", () => {
    const props = { data, disabled: false, busy: false, onSubmit: async () => {}, onRequest: async () => {} };
    act(() => root.render(createElement(CourseCard, { ...props, course })));
    expect(container.textContent).toContain("Standard course");
    expect(container.querySelector(".aspect-video svg.lucide-book-open-text")).not.toBeNull();
    act(() => root.render(createElement(CourseCard, { ...props, course: { ...course, courseLayout: "slides", coverImage: "/api/assets/123456789012345678901234/file" } })));
    expect(container.textContent).toContain("Slide presentation");
    expect(container.querySelector(".aspect-video svg.lucide-presentation")).not.toBeNull();
    expect(container.querySelector(".aspect-video img")).not.toBeNull();
    expect(container.querySelector<HTMLAnchorElement>('a[href="/courses/course-1/edit/presentation-mode"]')).not.toBeNull();

    act(() => root.render(createElement(CourseCard, { ...props, course: { ...course, courseLayout: "slides", permissions: [...roleCeilings.viewer] } })));
    expect(container.querySelector<HTMLAnchorElement>('a[href="/courses/course-1/preview/presentation-mode"]')).not.toBeNull();
    expect(container.querySelector('button[aria-haspopup="dialog"]')).toBeNull();
  });

  it("duplicates a personal course into a selected team workspace", async () => {
    const teamData: DashboardData = {
      ...data,
      workspaces: [{ id: "workspace-1", name: "Product team", role: "editor", memberCount: 2 }],
    };
    const onRequest = vi.fn(async () => {});
    act(() => {
      root.render(createElement(CourseCard, {
        course,
        data: teamData,
        disabled: false,
        busy: false,
        onSubmit: async () => {},
        onRequest,
      }));
    });
    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    const details = document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
    const destination = [...details.querySelectorAll("select")].find((select) =>
      [...select.options].some((option) => option.value === "workspace-1"),
    )!;
    act(() => {
      destination.value = "workspace-1";
      destination.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      [...details.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.includes("Duplicate course"))
        ?.click();
      await Promise.resolve();
    });

    expect(onRequest).toHaveBeenCalledWith("/api/courses/course-1", "POST", { workspaceId: "workspace-1" });
  });

  it("opens the course image library from the card actions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ assets: [] }),
    }));
    act(() => {
      root.render(createElement(CourseCard, {
        course,
        data,
        disabled: false,
        busy: false,
        onSubmit: async () => {},
        onRequest: async () => {},
      }));
    });

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    const details = document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
    await act(async () => {
      [...details!.querySelectorAll("button")].find((button) => button.textContent?.includes("Choose or upload image"))!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const library = [...container.querySelectorAll<HTMLElement>('[role="dialog"]')].find(dialog => document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent === "Media library");
    expect(library).toBeDefined();
    expect(container.querySelector('input[type="file"][accept*="image/png"]')).not.toBeNull();
    expect(details.dataset.state).toBe("closed");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Close media library"]')!.click());
    expect(library!.isConnected).toBe(false);
    expect(document.querySelector('[data-card-popover][data-state="open"]')).not.toBeNull();
  });

  it("submits course details and organization through the existing update handlers", async () => {
    const onSubmit = vi.fn(async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); });
    const onRequest = vi.fn(async () => {});
    act(() => root.render(createElement(CourseCard, { course, data: { ...data, folderOptions: [{ id: "folder-1", label: "Learning", depth: 0 }] }, disabled: false, busy: false, onSubmit, onRequest })));
    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    const dialog = document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
    const forms = dialog.querySelectorAll("form");
    await act(async () => {
      forms[0].dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      forms[1].dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), "/api/courses/course-1", "PATCH");
    const status = [...dialog.querySelectorAll("select")].find((select) => select.value === "draft")!;
    await act(async () => {
      status.value = "archived";
      status.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onRequest).toHaveBeenCalledWith("/api/courses/course-1", "PATCH", { status: "archived" });
  });

  it("shows request failures in settings and blocks changes while saving", () => {
    const props = { course, data, disabled: false, busy: false, onSubmit: async () => {}, onRequest: async () => {} };
    act(() => root.render(createElement(CourseCard, props)));
    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    act(() => root.render(createElement(CourseCard, { ...props, busy: true, error: "That change could not be saved." })));
    const dialog = document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe("That change could not be saved.");
    expect([...dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")].every((control) => control.disabled)).toBe(true);
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(dialog.dataset.state).toBe("open");
    act(() => root.render(createElement(CourseCard, { ...props, course: { ...course, permissions: [...roleCeilings.viewer] } })));
    expect(document.querySelector("[data-card-popover]")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });
});
