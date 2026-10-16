/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardClient from "@/app/dashboard/dashboard-client";
import { DashboardProvider } from "@/app/dashboard/_components/dashboard-provider";
import { DashboardNavigationClient } from "@/app/dashboard/_components/dashboard-navigation-client";
import type { DashboardData, DashboardFilters } from "@/lib/dashboard/types";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/dashboard/actions", () => ({ signOutAction: vi.fn() }));

const filters: DashboardFilters = { folderId: null, q: "", status: "all", sort: "updated" };
const data: DashboardData = {
  currentFolder: null,
  breadcrumbs: [{ id: null, name: "All courses" }],
  folders: [],
  folderOptions: [{ id: "folder-1", label: "Training", depth: 0 }],
  folderTree: [{ id: "folder-1", name: "Training", courseCount: 1, children: [] }],
  courses: [{ id: "course-1", title: "Sample course", description: "A course", coverImage: null, folderId: null, status: "draft", revision: 1, updatedAt: "2026-10-14T00:00:00.000Z", lessonCount: 2 }],
};

function response(body: DashboardData) {
  return { ok: true, json: async () => body };
}

describe("dashboard loading and shared controls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  function render(initialFilters = filters) {
    act(() => root.render(<DashboardProvider initialFilters={initialFilters}>
      <DashboardNavigationClient initialNavigation={data} initialError={null} />
      <DashboardClient initialData={data} initialError={null} userName="Test Author" />
    </DashboardProvider>));
  }

  function select(index: number, value: string) {
    act(() => {
      const element = container.querySelectorAll("select")[index];
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("uses streamed data without immediately fetching the dashboard again", async () => {
    render();
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Sample course");
  });

  it("shows matching skeletons and ignores an older filter response", async () => {
    const resolvers: Array<(value: ReturnType<typeof response>) => void> = [];
    fetchMock.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
    render();
    select(0, "published");
    expect(container.querySelector('[aria-label="Loading courses"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Loading folders"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Sample course");
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    select(1, "created");
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);

    await act(async () => { resolvers[1](response({ ...data, courses: [{ ...data.courses[0], title: "Newest course" }] })); });
    expect(container.textContent).toContain("Newest course");
    expect(container.querySelector('[aria-label="Loading courses"]')).toBeNull();
    await act(async () => { resolvers[0](response(data)); });
    expect(container.textContent).toContain("Newest course");
    expect(container.textContent).not.toContain("Sample course");
  });

  it("opens the content dialog from the sidebar and refreshes its folder tree after creation", async () => {
    const updated = { ...data, folderTree: [...data.folderTree, { id: "folder-2", name: "New folder", courseCount: 0, children: [] }] };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockResolvedValueOnce(response(updated));
    render();
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Create folder"]')!.click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Create a folder");
    (dialog.querySelector('input[name="name"]') as HTMLInputElement).value = "New folder";
    await act(async () => {
      dialog.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/folders", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "New folder", parentId: null }) }));
    expect(container.querySelector('[role="tree"]')?.textContent).toContain("New folder");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("preserves search and filters when navigating to another folder", () => {
    render({ ...filters, q: "alpha", status: "published", sort: "title" });
    act(() => container.querySelector<HTMLButtonElement>('button[title="Training"]')!.click());
    expect(router.push).toHaveBeenCalledWith("/dashboard?folderId=folder-1&q=alpha&status=published&sort=title");
  });

  it("ends skeleton loading on failure and lets the user retry", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection failed")).mockResolvedValueOnce(response(data));
    render();
    select(0, "published");
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Connection failed");
    expect(container.querySelector('[aria-label="Loading courses"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Dismiss message"]')).toBeNull();
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry")!.click());
    expect(container.querySelector('[aria-label="Loading courses"]')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    expect(container.textContent).toContain("Sample course");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
