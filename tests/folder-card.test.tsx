/** @vitest-environment jsdom */
import { act, type ComponentProps, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FolderCard } from "@/app/dashboard/_components/(dashboard_client_components)/folder-card";
import { roleCeilings } from "@/lib/auth/policy";
import type { DashboardData, DashboardFolder } from "@/lib/dashboard/types";

vi.mock("@/app/dashboard/_components/dashboard-link", () => ({ DashboardLink: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a> }));

const folder: DashboardFolder = { id: "folder-1", name: "Training", parentId: null, courseCount: 2, subfolderCount: 0, createdAt: "2026-11-02T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z" };
const data: DashboardData = { currentFolder: null, breadcrumbs: [], folders: [folder], courses: [], folderTree: [], folderOptions: [{ id: "folder-1", label: "Training", depth: 0 }, { id: "folder-2", label: "Team", depth: 0 }], workspaces: [], workspaceId: null, workspaceName: "Personal", workspaceRole: "owner", permissions: [...roleCeilings.editor] };

describe("folder card popover", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("keeps rename, move, and confirmed delete actions in a panel above the cards", async () => {
    const onSubmit = vi.fn(async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); });
    const onRequest = vi.fn(async () => {});
    act(() => root.render(<FolderCard folder={folder} data={data} href="/dashboard?folderId=folder-1" disabled={false} busy={false} onSubmit={onSubmit} onRequest={onRequest} />));
    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
    const panel = document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
    expect(panel.parentElement).toBe(document.body);
    expect(panel.getAttribute("aria-modal")).toBe("false");
    expect([...panel.querySelectorAll("select option")].map((option) => option.getAttribute("value"))).toEqual(["", "folder-2"]);
    await act(async () => {
      for (const form of panel.querySelectorAll("form")) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), "/api/folders/folder-1", "PATCH");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const deleteButton = [...panel.querySelectorAll("button")].find((button) => button.textContent?.includes("Delete empty folder"))!;
    act(() => deleteButton.click());
    expect(onRequest).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    await act(async () => deleteButton.click());
    expect(onRequest).toHaveBeenCalledWith("/api/folders/folder-1", "DELETE");
  });

  it("fades out on Escape or outside click and restores trigger focus", () => {
    vi.useFakeTimers();
    act(() => root.render(<FolderCard folder={folder} data={data} href="/dashboard" disabled={false} busy={false} onSubmit={async () => {}} onRequest={async () => {}} />));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
    act(() => trigger.click());
    const panel = document.querySelector<HTMLElement>("[data-card-popover]")!;
    expect(panel.dataset.state).toBe("open");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true, bubbles: true })));
    expect(panel.dataset.state).toBe("closed");
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(trigger);
    act(() => vi.advanceTimersByTime(149));
    expect(document.body.contains(panel)).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(document.body.contains(panel)).toBe(false);
    act(() => trigger.click());
    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("hides settings for viewers and prevents edits while busy", () => {
    const props = { folder, data, href: "/dashboard", disabled: false, busy: false, onSubmit: async () => {}, onRequest: async () => {} };
    act(() => root.render(<FolderCard {...props} data={{ ...data, workspaceRole: "viewer", permissions: [...roleCeilings.viewer] }} />));
    expect(container.querySelector("button")).toBeNull();
    act(() => root.render(<FolderCard {...props} />));
    act(() => container.querySelector<HTMLButtonElement>("button")!.click());
    act(() => root.render(<FolderCard {...props} busy error="Could not save folder." />));
    const panel = document.querySelector<HTMLElement>("[data-card-popover]")!;
    expect(panel.querySelector('[role="alert"]')?.textContent).toBe("Could not save folder.");
    expect([...panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")].every((control) => control.disabled)).toBe(true);
  });
});
