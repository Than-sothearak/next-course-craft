/** @vitest-environment jsdom */

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardClient from "@/app/dashboard/dashboard-client";
import { DashboardProvider } from "@/app/dashboard/_components/dashboard-provider";
import { DashboardNavigationClient } from "@/app/dashboard/_components/dashboard-navigation-client";
import { roleCeilings } from "@/lib/auth/policy";
import type { DashboardData, DashboardFilters } from "@/lib/dashboard/types";
import { dashboardQueryKey } from "@/lib/dashboard/query";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const linkNavigation = vi.hoisted(() => ({ navigate: vi.fn<() => Promise<void>>() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/dashboard/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("next/link", async (importOriginal) => {
  const { default: Link, ...actual } = await importOriginal<typeof import("next/link")>();
  const { createContext, useContext, useState } = await import("react");
  const LinkStatus = createContext({ pending: false });

  return {
    ...actual,
    useLinkStatus: () => useContext(LinkStatus),
    default: function TestLink({ children, ...props }: ComponentProps<typeof Link>) {
      const [pending, setPending] = useState(false);
      return <Link {...props} onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        setPending(true);
        void linkNavigation.navigate().then(() => setPending(false), () => setPending(false));
      }}>
        <LinkStatus.Provider value={{ pending }}>{children}</LinkStatus.Provider>
      </Link>;
    },
  };
});

const filters: DashboardFilters = { workspaceId: null, folderId: null, q: "", status: "all", sort: "updated" };
const data: DashboardData = {
  currentFolder: null,
  breadcrumbs: [{ id: null, name: "All courses" }],
  folders: [],
  folderOptions: [{ id: "folder-1", label: "Training", depth: 0 }],
  folderTree: [{ id: "folder-1", name: "Training", courseCount: 1, children: [] }],
  courses: [{ id: "course-1", title: "Sample course", description: "A course", coverImage: null, courseLayout: "standard", folderId: null, status: "draft", revision: 1, updatedAt: "2026-10-14T00:00:00.000Z", lessonCount: 2, accessRole: "owner", permissions: [...roleCeilings.editor] }],
  workspaces: [], workspaceId: null, workspaceName: "Personal", workspaceRole: "owner", permissions: [...roleCeilings.editor],
};
const cardFolder = {
  id: "folder-2", name: "Card folder", parentId: "folder-0", courseCount: 2, subfolderCount: 0,
  createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
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
    linkNavigation.navigate.mockReset().mockResolvedValue(undefined);
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

  function render(initialFilters = filters, initialData = data) {
    act(() => root.render(<DashboardProvider key={dashboardQueryKey(initialFilters)} initialFilters={initialFilters}>
      <DashboardNavigationClient initialNavigation={initialData} initialError={null} />
      <DashboardClient initialData={initialData} initialError={null} userName="Test Author" />
    </DashboardProvider>));
  }

  function select(index: number, value: string) {
    act(() => {
      const element = container.querySelector<HTMLSelectElement>(index === 0 ? 'select[aria-label="Filter course status"]' : 'select[aria-label="Sort courses"]')!;
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function teamData(role: DashboardData["workspaceRole"] = "owner"): DashboardData {
    return {
      ...data,
      workspaceId: "workspace-1",
      workspaceName: "Existing team",
      workspaceRole: role,
      workspaces: [{ id: "workspace-1", name: "Existing team", role, memberCount: 2 }],
    };
  }

  function createWorkspaceButton(surface: "sidebar" | "mobile" = "sidebar") {
    return [...container.querySelectorAll<HTMLButtonElement>('button[aria-label="Create team workspace"]')]
      .find((button) => Boolean(button.closest("aside")) === (surface === "sidebar"))!;
  }

  it.each(["sidebar", "mobile"] as const)("opens only workspace creation from the %s plus button while a team is selected", (surface) => {
    render({ ...filters, workspaceId: "workspace-1" }, teamData());
    act(() => createWorkspaceButton(surface).click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Create a team workspace");
    expect(dialog.querySelector('input[name="name"]')).not.toBeNull();
    expect(dialog.querySelector('input[name="email"]')).toBeNull();
    expect(dialog.textContent).not.toContain("Invite a teammate");
    expect(dialog.textContent).not.toContain("Members");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a new workspace even when the current workspace grants viewer access", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "workspace-2", name: "New team", role: "owner", memberCount: 1 }) });
    render({ ...filters, workspaceId: "workspace-1" }, teamData("viewer"));
    act(() => createWorkspaceButton().click());
    const dialog = container.querySelector('[role="dialog"]')!;
    dialog.querySelector<HTMLInputElement>('input[name="name"]')!.value = "New team";
    await act(async () => {
      dialog.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/workspaces", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "New team" }) }));
    expect(router.push).toHaveBeenCalledWith("/dashboard?workspaceId=workspace-2");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps the creation form open with the entered name when creation fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Could not create this workspace." }) });
    render({ ...filters, workspaceId: "workspace-1" }, teamData());
    act(() => createWorkspaceButton().click());
    const dialog = container.querySelector('[role="dialog"]')!;
    dialog.querySelector<HTMLInputElement>('input[name="name"]')!.value = "New team";
    await act(async () => {
      dialog.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe("Could not create this workspace.");
    expect(dialog.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe("New team");
    expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens team details only through Manage team and resets the dialog before creation", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ workspace: { id: "workspace-1", name: "Existing team", role: "owner" }, members: [], invitations: [] }) });
    render({ ...filters, workspaceId: "workspace-1" }, teamData());
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>("aside button")].find((button) => button.textContent?.includes("Manage team"))!.click();
    });
    let dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Existing team");
    expect(dialog.querySelector('input[name="email"]')).not.toBeNull();
    expect(dialog.querySelector('input[name="name"]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/workspaces/workspace-1/invitations", expect.objectContaining({ cache: "no-store" }));
    act(() => [...dialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Done")!.click());
    act(() => createWorkspaceButton().click());
    dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Create a team workspace");
    expect(dialog.querySelector('input[name="email"]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("opens workspace creation from Personal without loading a team roster", () => {
    render();
    act(() => createWorkspaceButton().click());
    expect(container.querySelector('[role="dialog"] h2')?.textContent).toBe("Create a team workspace");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides workspace creation when the account lacks workspace management permission", () => {
    render(filters, { ...data, permissions: [...roleCeilings.viewer] });
    expect(container.querySelector('button[aria-label="Create team workspace"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

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
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/folders", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "New folder", parentId: null, workspaceId: null }) }));
    expect(container.querySelector('[role="tree"]')?.textContent).toContain("New folder");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it.each([null, "workspace-1"])("preserves search, filters, and workspace %s in folder links", (workspaceId) => {
    render({ ...filters, workspaceId, q: "alpha & beta", status: "published", sort: "title" }, workspaceId ? teamData() : data);
    const link = container.querySelector<HTMLAnchorElement>('a[title="Training"]')!;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe(`/dashboard?${workspaceId ? `workspaceId=${workspaceId}&` : ""}folderId=folder-1&q=alpha+%26+beta&status=published&sort=title`);
    expect(link.hasAttribute("aria-current")).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    { view: "grid", workspaceId: null },
    { view: "list", workspaceId: null },
    { view: "grid", workspaceId: "workspace-1" },
    { view: "list", workspaceId: "workspace-1" },
  ])("uses folder card links in $view view for workspace $workspaceId", ({ view, workspaceId }) => {
    render({ ...filters, workspaceId, folderId: "folder-0", q: "alpha & beta", status: "published", sort: "title" }, {
      ...(workspaceId ? teamData() : data), folders: [cardFolder],
    });
    if (view === "list") act(() => container.querySelector<HTMLButtonElement>('button[aria-label="List view"]')!.click());
    const section = container.querySelector<HTMLElement>('section[aria-labelledby="folders-title"]')!;
    const link = section.querySelector<HTMLAnchorElement>("article a")!;
    expect(link.textContent).toContain("Card folder");
    expect(link.getAttribute("href")).toBe(`/dashboard?${workspaceId ? `workspaceId=${workspaceId}&` : ""}folderId=folder-2&q=alpha+%26+beta&status=published&sort=title`);
    expect(link.querySelector("button, details, form")).toBeNull();
    expect(section.querySelector('summary[aria-label="Manage Card folder"]')).not.toBeNull();
    expect(linkNavigation.navigate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each(["grid", "list"])("keeps skeletons visible during folder card navigation in %s view", async (view) => {
    let finishNavigation!: () => void;
    linkNavigation.navigate.mockImplementationOnce(() => new Promise<void>((resolve) => { finishNavigation = resolve; }));
    render(filters, { ...data, folders: [cardFolder] });
    if (view === "list") act(() => container.querySelector<HTMLButtonElement>('button[aria-label="List view"]')!.click());
    const section = container.querySelector<HTMLElement>('section[aria-labelledby="folders-title"]')!;
    const link = section.querySelector<HTMLAnchorElement>("article a")!;
    act(() => link.click());

    expect(container.querySelector('[aria-label="Loading courses"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Loading folders"]')).not.toBeNull();
    expect(section.hidden).toBe(true);
    expect(link.isConnected).toBe(true);
    expect(container.textContent).not.toContain("Sample course");
    expect(linkNavigation.navigate).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();

    await act(async () => { finishNavigation(); });
    render({ ...filters, folderId: cardFolder.id }, { ...data, courses: [{ ...data.courses[0], title: "Folder course" }] });
    expect(container.querySelector('[aria-label="Loading courses"]')).toBeNull();
    expect(container.querySelector('[aria-label="Loading folders"]')).toBeNull();
    expect(container.textContent).toContain("Folder course");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores folder cards when link navigation fails", async () => {
    let failNavigation!: (error: Error) => void;
    linkNavigation.navigate.mockImplementationOnce(() => new Promise<void>((_, reject) => { failNavigation = reject; }));
    render(filters, { ...data, folders: [cardFolder] });
    const section = container.querySelector<HTMLElement>('section[aria-labelledby="folders-title"]')!;
    const link = section.querySelector<HTMLAnchorElement>("article a")!;
    act(() => link.click());
    expect(section.hidden).toBe(true);
    await act(async () => { failNavigation(new Error("Navigation failed")); });
    expect(container.querySelector('[aria-label="Loading folders"]')).toBeNull();
    expect(section.hidden).toBe(false);
    expect(link.isConnected).toBe(true);
    expect(container.textContent).toContain("Sample course");
  });

  it("links All courses to the workspace root while preserving search and filters", () => {
    render({ ...filters, workspaceId: "workspace-1", folderId: "folder-1", q: "alpha", status: "published", sort: "title" }, teamData());
    const link = [...container.querySelectorAll<HTMLAnchorElement>("aside a")].find((element) => element.textContent?.includes("All courses"))!;
    expect(link.getAttribute("href")).toBe("/dashboard?workspaceId=workspace-1&q=alpha&status=published&sort=title");
    expect(link.hasAttribute("aria-current")).toBe(false);
    expect(container.querySelector('a[title="Training"]')?.getAttribute("aria-current")).toBe("page");
  });

  it("keeps nested folder expansion on buttons and renders children as links", () => {
    const initialData = {
      ...teamData(),
      folderTree: [{ ...data.folderTree[0], children: [{ id: "folder-2", name: "Nested", courseCount: 0, children: [] }] }],
    };
    render({ ...filters, workspaceId: "workspace-1", folderId: "folder-2", q: "alpha" }, initialData);
    expect(container.querySelector('a[title="Nested"]')?.getAttribute("href")).toBe("/dashboard?workspaceId=workspace-1&folderId=folder-2&q=alpha");
    expect(container.querySelector('a[title="Nested"]')?.getAttribute("aria-current")).toBe("page");
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Collapse Training"]')!.click());
    expect(container.querySelector('a[title="Nested"]')).toBeNull();
    expect(container.querySelector('a[title="Training"]')).not.toBeNull();
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Expand Training"]')!.click());
    expect(container.querySelector('a[title="Nested"]')).not.toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each(["folder-1", null])("shows skeletons while navigating through a link to folder %s", async (folderId) => {
    let finishNavigation!: () => void;
    linkNavigation.navigate.mockImplementationOnce(() => new Promise<void>((resolve) => { finishNavigation = resolve; }));
    const initialFilters = { ...filters, workspaceId: "workspace-1", folderId: "folder-0" };
    render(initialFilters, teamData());
    const link = folderId
      ? container.querySelector<HTMLAnchorElement>('a[title="Training"]')!
      : [...container.querySelectorAll<HTMLAnchorElement>("aside a")].find((element) => element.textContent?.includes("All courses"))!;

    act(() => link.click());
    expect(container.querySelector('[aria-label="Loading courses"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Loading folders"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Sample course");
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Create folder"]')?.disabled).toBe(true);

    await act(async () => { finishNavigation(); });
    render({ ...initialFilters, folderId }, { ...teamData(), courses: [{ ...data.courses[0], title: "Destination course" }] });
    expect(container.querySelector('[aria-label="Loading courses"]')).toBeNull();
    expect(container.querySelector('[aria-label="Loading folders"]')).toBeNull();
    expect(container.textContent).toContain("Destination course");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("keeps skeletons visible when another folder link is still pending", async () => {
    const completions: Array<() => void> = [];
    linkNavigation.navigate.mockImplementation(() => new Promise<void>((resolve) => { completions.push(resolve); }));
    render(filters, { ...data, folderTree: [...data.folderTree, { id: "folder-2", name: "Second folder", courseCount: 0, children: [] }] });
    act(() => container.querySelector<HTMLAnchorElement>('a[title="Training"]')!.click());
    act(() => container.querySelector<HTMLAnchorElement>('a[title="Second folder"]')!.click());
    await act(async () => { completions[0](); });
    expect(container.querySelector('[aria-label="Loading courses"]')).not.toBeNull();
    await act(async () => { completions[1](); });
    expect(container.querySelector('[aria-label="Loading courses"]')).toBeNull();
  });

  it("clears skeletons when link navigation fails", async () => {
    let failNavigation!: (error: Error) => void;
    linkNavigation.navigate.mockImplementationOnce(() => new Promise<void>((_, reject) => { failNavigation = reject; }));
    render();
    act(() => container.querySelector<HTMLAnchorElement>('a[title="Training"]')!.click());
    expect(container.querySelector('[aria-label="Loading courses"]')).not.toBeNull();
    await act(async () => { failNavigation(new Error("Navigation failed")); });
    expect(container.querySelector('[aria-label="Loading courses"]')).toBeNull();
    expect(container.textContent).toContain("Sample course");
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
