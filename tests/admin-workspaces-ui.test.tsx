// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminWorkspace, AdminWorkspaceDetail } from "@/lib/admin/types";
import { WorkspaceManagement } from "@/app/admin/workspaces/_components/workspace-management";
import { WorkspaceDetail } from "@/app/admin/workspaces/[workspaceId]/_components/workspace-detail";
import { AdminNavigation } from "@/app/admin/_components/admin-navigation";
import { roleCeilings } from "@/lib/auth/policy";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, usePathname: () => "/admin/workspaces" }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
let workspace: AdminWorkspace;
let failure: string | null;
let deleted: boolean;
let listFailure: boolean;
const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
async function render(content: ReactNode) { act(() => root.render(content)); await flush(); }
function button(text: string, scope: ParentNode = container) { return [...scope.querySelectorAll("button")].find((node) => node.textContent === text)!; }
function setInput(selector: string, value: string) {
  act(() => {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function detail(): AdminWorkspaceDetail {
  return {
    workspace,
    members: [{ userId: workspace.ownerId, name: workspace.ownerName, email: workspace.ownerEmail, role: "owner" }],
    invitations: [{ id: "invitation", email: "invite@example.com", role: "viewer", expiresAt: workspace.updatedAt }],
    invitationCount: 1,
    courses: workspace.courseCount ? [{ id: "course", title: "Shared course", status: "draft", deletedAt: null, updatedAt: workspace.updatedAt }] : [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  failure = null; deleted = false; listFailure = false; calls.length = 0;
  workspace = { id: "507f1f77bcf86cd799439012", name: "Learning team", ownerId: "507f1f77bcf86cd799439013", ownerName: "Team owner", ownerEmail: "owner@example.com", memberCount: 1, courseCount: 0, folderCount: 0, createdAt: "2026-10-21T00:00:00.000Z", updatedAt: "2026-10-21T00:00:00.000Z" };
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, method, ...(body ? { body } : {}) });
    if (method !== "GET") {
      if (failure) return new Response(JSON.stringify({ error: failure }), { status: 409 });
      if (method === "PATCH") workspace = { ...workspace, name: String(body!.name) };
      if (method === "DELETE") deleted = true;
      return new Response(JSON.stringify({ id: workspace.id }));
    }
    if (listFailure) return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
    return new Response(JSON.stringify(url.includes("?") ? { items: deleted ? [] : [workspace], page: Number(new URL(url, "http://localhost").searchParams.get("page")), pageSize: 20, total: deleted ? 0 : 21 } : detail()));
  }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("workspace administration UI", () => {
  it("shows the Workspaces navigation entry only for Super Admin", async () => {
    await render(<AdminNavigation permissions={[...roleCeilings.admin]} role="admin" />);
    expect(container.querySelector('a[href="/admin/workspaces"]')).toBeNull();
    await render(<AdminNavigation permissions={[...roleCeilings.super_admin]} role="super_admin" />);
    expect(container.querySelector('a[href="/admin/workspaces"]')?.getAttribute("aria-current")).toBe("page");
  });

  it("lists workspaces and supports search and pagination", async () => {
    await render(<WorkspaceManagement />);
    expect(container.textContent).toContain("Learning team");
    expect(container.textContent).toContain("owner@example.com");
    expect(container.querySelector('a[href="/admin/workspaces/507f1f77bcf86cd799439012"]')).not.toBeNull();
    act(() => button("Next").click()); await flush();
    expect(calls.at(-1)?.url).toContain("page=2");
    setInput('[name="q"]', "Owner");
    act(() => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); await flush();
    expect(calls.at(-1)?.url).toContain("q=Owner&page=1");
  });

  it("updates the name with a stale-write check and refreshes the list", async () => {
    await render(<WorkspaceManagement />);
    act(() => button("Update").click());
    expect(button("Save changes").disabled).toBe(true);
    setInput("#workspace-name", "Renamed team");
    act(() => button("Save changes").click()); await flush();
    expect(calls.find((call) => call.method === "PATCH")).toEqual({ url: `/api/admin/workspaces/${workspace.id}`, method: "PATCH", body: { name: "Renamed team", expectedUpdatedAt: "2026-10-21T00:00:00.000Z" } });
    expect(container.querySelector("dialog")).toBeNull();
    expect(container.textContent).toContain("Workspace updated.");
    expect(container.textContent).toContain("Renamed team");
  });

  it.each(["courses", "folders"])("blocks deletion in the UI when the workspace has %s", async (kind) => {
    workspace = { ...workspace, courseCount: kind === "courses" ? 1 : 0, folderCount: kind === "folders" ? 1 : 0 };
    await render(<WorkspaceManagement />);
    act(() => button("Delete").click());
    expect(button("Delete workspace").disabled).toBe(true);
    expect(container.querySelector<HTMLDialogElement>("dialog[open]")?.textContent).toContain("including recently deleted courses");
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  });

  it("requires the exact name before deleting an empty workspace", async () => {
    await render(<WorkspaceManagement />);
    act(() => button("Delete").click());
    expect(button("Delete workspace").disabled).toBe(true);
    setInput("#workspace-confirmation", "learning team");
    expect(button("Delete workspace").disabled).toBe(true);
    setInput("#workspace-confirmation", workspace.name);
    act(() => button("Delete workspace").click()); await flush();
    expect(calls.find((call) => call.method === "DELETE")?.body).toEqual({ confirmName: "Learning team", expectedUpdatedAt: "2026-10-21T00:00:00.000Z" });
    expect(container.textContent).toContain("Workspace deleted.");
    expect(container.textContent).toContain("No workspaces match your search.");
  });

  it("keeps the dialog open and shows server conflicts without changing the list", async () => {
    failure = "The workspace changed. Refresh and try again.";
    await render(<WorkspaceManagement />);
    act(() => button("Update").click());
    setInput("#workspace-name", "New name");
    act(() => button("Save changes").click()); await flush();
    expect(container.querySelector("dialog [role=alert]")?.textContent).toBe(failure);
    expect(button("Save changes").disabled).toBe(false);
    expect(workspace.name).toBe("Learning team");
  });

  it("shows the roster, invitations and workspace-filtered courses in details", async () => {
    workspace.courseCount = 1;
    await render(<WorkspaceDetail workspaceId={workspace.id} />);
    expect(container.querySelector("h1")?.textContent).toBe(workspace.name);
    expect(container.textContent).toContain("Members (1)");
    expect(container.textContent).toContain("Shared course");
    expect(container.textContent).toContain("invite@example.com");
    expect(container.querySelector(`a[href="/admin/courses?workspaceId=${workspace.id}"]`)).not.toBeNull();
  });

  it("returns to workspace management after deleting from the detail page", async () => {
    await render(<WorkspaceDetail workspaceId={workspace.id} />);
    act(() => button("Delete").click());
    setInput("#workspace-confirmation", workspace.name);
    act(() => button("Delete workspace").click()); await flush();
    expect(navigation.push).toHaveBeenCalledWith("/admin/workspaces");
  });

  it("shows API errors without offering actions on unavailable data", async () => {
    listFailure = true;
    await render(<WorkspaceManagement />);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Access denied.");
    expect(button("Update")).toBeUndefined();
  });
});
