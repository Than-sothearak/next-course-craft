/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishMenu } from "@/components/publish-menu";

const path = `/share/${"a".repeat(48)}`;
const share = { path, publishedAt: "2026-11-27T04:00:00.000Z" };
const fetchMock = vi.fn();
const clipboard = vi.fn();
let container: HTMLDivElement;
let root: Root;
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === text)!;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboard } });
  clipboard.mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function openShare() {
  await act(async () => root.render(createElement(PublishMenu, { courseId: "course-1", title: "My course" })));
  act(() => container.querySelector<HTMLButtonElement>("button")!.click());
  await act(async () => button("Share link").click());
}

describe("publishing a course share link", () => {
  it("opens from Publish, creates a link, copies it and turns public access off", async () => {
    fetchMock.mockResolvedValueOnce(json({ share: null })).mockResolvedValueOnce(json({ share })).mockResolvedValueOnce(json({ share: null }));
    await openShare();
    expect(container.querySelector("dialog[open]")?.textContent).toContain("Share course");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="menu"]')).toBeNull();
    await act(async () => button("Publish share link").click());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/courses/course-1/publish/share", { method: "POST" });
    const input = container.querySelector<HTMLInputElement>("input")!;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(new URL(path, window.location.origin).href);
    expect(container.querySelector<HTMLAnchorElement>("a")?.href).toBe(input.value);
    await act(async () => button("Copy").click());
    expect(clipboard).toHaveBeenCalledWith(input.value);
    expect(button("Copied")).toBeDefined();
    await act(async () => button("Turn off link").click());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/courses/course-1/publish/share", { method: "DELETE" });
    expect(container.textContent).toContain("The previous link no longer works");
    expect(container.querySelector("input")).toBeNull();
  });

  it("retrieves the existing link and keeps it available when an update fails", async () => {
    fetchMock.mockResolvedValueOnce(json({ share })).mockResolvedValueOnce(json({ error: "Save the course first." }, 409));
    await openShare();
    expect(button("Publish update")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => button("Publish update").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Save the course first.");
    expect(container.querySelector<HTMLInputElement>("input")?.value).toContain(path);
    expect(button("Publish update").disabled).toBe(false);
  });

  it("allows retry after a failed load and supports manual copying", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce(json({ share }));
    await openShare();
    expect(button("Publish share link").disabled).toBe(true);
    await act(async () => button("Retry").click());
    clipboard.mockRejectedValue(new Error("Clipboard unavailable"));
    await act(async () => button("Copy").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("copy it manually");
    expect(container.querySelector<HTMLInputElement>("input")?.value).toContain(path);
  });
});
