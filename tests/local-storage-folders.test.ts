import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listLocalStorageFolders, localBrowserRoot, validateLocalDirectorySelection } from "@/lib/media/local-browser";

let root: string;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "coursecraft-folder-browser-")));
  vi.stubEnv("MEDIA_LOCAL_ROOT", root);
  vi.stubEnv("MEDIA_LOCAL_DIRECTORY", join(root, "uploads"));
  await mkdir(join(root, "uploads"));
  await mkdir(join(root, "More lessons"));
  await mkdir(join(root, ".hidden"));
  await writeFile(join(root, "private-file.txt"), "Do not list files");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });

describe("server storage folder browser boundaries", () => {
  it("lists only real visible folders, supports spaces, and stops at the allowed root", async () => {
    expect(await listLocalStorageFolders()).toEqual({ root, path: root, parent: null, folders: [ { name: "More lessons", path: join(root, "More lessons") }, { name: "uploads", path: join(root, "uploads") } ], truncated: false });
    expect(await listLocalStorageFolders(join(root, "More lessons"))).toMatchObject({ parent: root, folders: [] });
  });
  it("defaults the browsing root to the parent of the environment upload directory", () => {
    vi.stubEnv("MEDIA_LOCAL_ROOT", "");
    expect(localBrowserRoot()).toBe(root);
  });
  it.each(["/etc", "../outside", "/", "/tmp"])("rejects paths outside the allowed root: %s", async (path) => {
    await expect(listLocalStorageFolders(path)).rejects.toMatchObject({ status: path.startsWith("/") ? 403 : 400 });
  });
  it("rejects sibling-prefix escapes and hidden folders", async () => {
    await expect(listLocalStorageFolders(`${root}-outside`)).rejects.toMatchObject({ status: 403 });
    await expect(listLocalStorageFolders(join(root, "..", "outside"))).rejects.toMatchObject({ status: 403 });
    await expect(listLocalStorageFolders(join(root, ".hidden"))).rejects.toMatchObject({ status: 403 });
  });
  it("does not list or follow symbolic links, including links back inside the root", async () => {
    const linkType = process.platform === "win32" ? "junction" : "dir";
    await symlink(join(root, ".."), join(root, "external"), linkType);
    await symlink(join(root, "uploads"), join(root, "internal"), linkType);
    expect((await listLocalStorageFolders()).folders.map((folder) => folder.name)).toEqual(["More lessons", "uploads"]);
    await expect(validateLocalDirectorySelection(join(root, "external"))).rejects.toMatchObject({ status: 400 });
    await expect(validateLocalDirectorySelection(join(root, "internal"))).rejects.toMatchObject({ status: 400 });
  });
  it("rejects files and nonexistent folders without creating them", async () => {
    await expect(validateLocalDirectorySelection(join(root, "private-file.txt"))).rejects.toMatchObject({ status: 400 });
    await expect(validateLocalDirectorySelection(join(root, "not-created"))).rejects.toMatchObject({ status: 400 });
  });
  it("requires an explicit bounded root and prevents selecting the application directory", async () => {
    vi.stubEnv("MEDIA_LOCAL_ROOT", "/");
    await expect(listLocalStorageFolders()).rejects.toMatchObject({ status: 503 });
    await symlink(parse(root).root, join(root, "root-alias"), process.platform === "win32" ? "junction" : "dir");
    vi.stubEnv("MEDIA_LOCAL_ROOT", join(root, "root-alias"));
    await expect(listLocalStorageFolders(join(root, "root-alias", "etc"))).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("MEDIA_LOCAL_ROOT", process.cwd());
    await expect(listLocalStorageFolders()).rejects.toMatchObject({ status: 503 });
  });
});
