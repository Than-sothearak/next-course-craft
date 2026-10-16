/** @vitest-environment jsdom */

import { act, createElement } from "react";
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
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("keeps the overflow menu above neighboring cards and offers publish formats", () => {
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

    const card = container.querySelector("article");
    const details = container.querySelector<HTMLDetailsElement>("details");
    expect(card?.className).toContain("overflow-visible");
    expect(card?.className).toContain("z-0");
    expect(container.querySelector(".aspect-video.rounded-t-2xl.overflow-hidden")).not.toBeNull();
    expect(details).not.toBeNull();

    act(() => details!.querySelector("summary")!.click());
    expect(card?.className).toContain("z-30");
    const publishButton = [...details!.querySelectorAll("button")].find((button) => button.textContent?.includes("Publish"));
    expect(publishButton).toBeDefined();

    act(() => publishButton!.click());
    const menu = container.querySelector('[role="menu"][aria-label="Publish format"]');
    expect([...menu!.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual([
      "HTML",
      "PDF handout",
      "SCORM 1.2",
      "SCORM 2004",
    ]);
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
    const details = container.querySelector<HTMLDetailsElement>("details")!;
    act(() => details.querySelector("summary")!.click());
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

    const details = container.querySelector<HTMLDetailsElement>("details");
    act(() => details!.querySelector("summary")!.click());
    await act(async () => {
      [...details!.querySelectorAll("button")].find((button) => button.textContent?.includes("Choose or upload image"))!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="dialog"][aria-labelledby="media-library-title"]')).not.toBeNull();
    expect(container.querySelector('input[type="file"][accept*="image/png"]')).not.toBeNull();
  });
});
