/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardDialogs } from "@/app/dashboard/_components/(dashboard_client_components)/dashboard-dialogs";
import type { DashboardData } from "@/lib/dashboard/types";

const data: DashboardData = {
  currentFolder: null,
  breadcrumbs: [],
  folders: [],
  courses: [],
  folderOptions: [],
  folderTree: [],
  workspaces: [],
  workspaceId: null,
  workspaceName: "Personal",
  workspaceRole: "owner",
};

describe("new course editor selection", () => {
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

  it("requires a choice between the responsive block and interactive slide editors", () => {
    act(() => {
      root.render(createElement(DashboardDialogs, {
        openFolder: false,
        openCourse: true,
        data,
        busy: false,
        onCloseFolder: vi.fn(),
        onCloseCourse: vi.fn(),
        onSubmit: async () => {},
      }));
    });

    const choices = [...container.querySelectorAll<HTMLInputElement>('input[name="editorType"]')];
    expect(choices.map((choice) => choice.value)).toEqual(["block", "slide"]);
    expect(choices.every((choice) => choice.required)).toBe(true);
    expect(container.textContent).toContain("Responsive Course");
    expect(container.textContent).toContain("Interactive Course");
    expect(container.textContent).toContain("Content blocks, interactive text, quizzes and media with a layer timeline.");
  });
});
