// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaStorageManagement } from "@/components/admin/media-storage-management";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
let provider = "s3";
let failure: string | null;
let localDirectory = "/data/coursecraft/uploads";
let folderFailure = false;
const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
function button(text: string) { return [...container.querySelectorAll("button")].find((node) => node.textContent === text)!; }
beforeEach(async () => {
  provider = "s3"; failure = null; folderFailure = false; localDirectory = "/data/coursecraft/uploads"; calls.length = 0;
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/folders?")) {
      if (folderFailure) return new Response(JSON.stringify({ error: "Folder is unavailable" }), { status: 403 });
      const root = "/data/coursecraft";
      const path = new URL(url, "https://coursecraft.example").searchParams.get("path") || root;
      return new Response(JSON.stringify({ root, path, parent: path === root ? null : root, folders: path === root ? [{ name: "New folder", path: `${root}/new-folder` }, { name: "uploads", path: `${root}/uploads` }] : [], truncated: false }));
    }
    if (!init?.method) {
      const requestedDirectory = new URL(url, "https://coursecraft.example").searchParams.get("localDirectory");
      const freeBytes = requestedDirectory?.endsWith("new-folder") ? 100_000_000 : 400_000_000;
      return new Response(JSON.stringify({ provider, revision: 2, local: { directory: localDirectory, browseRoot: "/data/coursecraft", capacity: { totalBytes: 1_000_000_000, freeBytes } }, s3: { bucket: "private-course-media", region: "ap-southeast-1" } }));
    }
    const body = JSON.parse(String(init.body));
    calls.push({ url, method: init.method, body });
    if (failure) return new Response(JSON.stringify({ error: failure }), { status: 503 });
    if (init.method === "PUT") { provider = body.provider; if (body.localDirectory) localDirectory = body.localDirectory; }
    return new Response(JSON.stringify({ connected: true }));
  }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  act(() => root.render(<MediaStorageManagement />)); await flush();
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

async function chooseLocalWithDefault() {
  act(() => container.querySelector<HTMLInputElement>('[value="local"]')!.click());
  await flush();
  act(() => button("Cancel").click());
}

describe("Media Storage settings UI", () => {
  it("shows current S3 configuration and a responsive accessible pair of provider choices", () => {
    expect(container.textContent).toContain("Currently active: AWS S3");
    expect(container.querySelector<HTMLInputElement>('[name="storage-provider"][value="s3"]')?.checked).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#media-bucket")?.value).toBe("private-course-media");
    expect(container.querySelector<HTMLInputElement>("#media-region")?.readOnly).toBe(true);
    expect(container.textContent).toContain("AWS S3 has no fixed bucket capacity");
    expect(container.querySelectorAll('[type="radio"]')).toHaveLength(2);
    expect(container.querySelector("fieldset")?.textContent).toContain("Select storage provider");
  });
  it("tests the selected local directory without changing the active provider", async () => {
    await chooseLocalWithDefault();
    expect(container.querySelector<HTMLInputElement>("#media-directory")?.value).toBe("/data/coursecraft/uploads");
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("60");
    expect(container.textContent).toContain("400 MB free");
    expect(container.textContent).toContain("600 MB used of 1 GB total volume capacity");
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-label")).toBe("Used local storage volume");
    act(() => button("Test Connection").click()); await flush();
    expect(calls).toEqual([{ url: "/api/admin/settings/media-storage/test", method: "POST", body: { provider: "local", localDirectory: "/data/coursecraft/uploads" } }]);
    expect(container.textContent).toContain("Currently active: AWS S3");
    expect(container.textContent).toContain("Settings have not changed");
  });
  it("saves with a revision and shows the newly active provider after success", async () => {
    await chooseLocalWithDefault();
    act(() => button("Save Settings").click()); await flush(); await flush();
    expect(calls[0]).toEqual({ url: "/api/admin/settings/media-storage", method: "PUT", body: { provider: "local", localDirectory: "/data/coursecraft/uploads", revision: 2 } });
    expect(container.textContent).toContain("Currently active: Local Server");
    expect(container.textContent).toContain("Media storage settings saved");
  });
  it("opens a folder chooser when Local Server is selected and saves the chosen server folder", async () => {
    act(() => container.querySelector<HTMLInputElement>('[value="local"]')!.click());
    await flush();
    expect(container.querySelector("dialog[open]")?.textContent).toContain("Choose storage folder");
    act(() => button("Storage folders").click()); await flush();
    act(() => button("New folder").click()); await flush();
    expect(container.querySelector('[aria-label="Current folder"]')?.textContent).toBe("/data/coursecraft/new-folder");
    act(() => button("Use this folder").click());
    expect(container.querySelector<HTMLInputElement>("#media-directory")?.value).toBe("/data/coursecraft/new-folder");
    await flush();
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("90");
    expect(container.textContent).toContain("100 MB free");
    expect(calls).toHaveLength(0);
    act(() => button("Save Settings").click()); await flush(); await flush();
    expect(calls[0].body).toEqual({ provider: "local", localDirectory: "/data/coursecraft/new-folder", revision: 2 });
    expect(container.querySelector<HTMLInputElement>("#media-directory")?.value).toBe("/data/coursecraft/new-folder");
  });
  it("keeps the saved directory when browsing fails or the chooser is cancelled", async () => {
    folderFailure = true;
    act(() => container.querySelector<HTMLInputElement>('[value="local"]')!.click()); await flush();
    expect(container.querySelector("dialog [role=alert]")?.textContent).toBe("Folder is unavailable");
    expect(button("Use this folder").disabled).toBe(true);
    act(() => button("Cancel").click());
    expect(container.querySelector<HTMLInputElement>("#media-directory")?.value).toBe("/data/coursecraft/uploads");
    expect(calls).toHaveLength(0);
  });

  it("shows connection errors and leaves the existing provider active on save failure", async () => {
    failure = "Local storage test failed. Check directory permissions.";
    await chooseLocalWithDefault();
    act(() => button("Save Settings").click()); await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Check directory permissions");
    expect(container.textContent).toContain("Currently active: AWS S3");
    expect(button("Save Settings").disabled).toBe(false);
  });
});
