import { link, mkdtemp, rm, readFile, readdir, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageProvider, localStorageDirectory } from "@/lib/media/providers/local";

const file = { key: "owner/course/unique-file", contentType: "image/png", assetId: "asset-id", size: 10 };
let directory: string;
let provider: LocalStorageProvider;
beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), "coursecraft-storage-")));
  vi.stubEnv("MEDIA_LOCAL_DIRECTORY", directory);
  provider = new LocalStorageProvider();
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("persistent private local storage", () => {
  it("uploads atomically, survives provider restarts, reads ranges and suffixes, and deletes", async () => {
    await provider.upload({ ...file, body: Buffer.from("0123456789") });
    provider = new LocalStorageProvider();
    expect(await provider.metadata(file.key)).toEqual({ size: 10 });
    expect(await (await provider.read(file)).text()).toBe("0123456789");
    const partial = await provider.read(file, { range: "bytes=2-4" });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(await partial.text()).toBe("234");
    expect(await (await provider.read(file, { range: "bytes=-2" })).text()).toBe("89");
    const invalid = await provider.read(file, { range: "bytes=10-" });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */10");
    for (const range of ["bytes=-0", "bytes=-", "bytes=5-2", "bytes=0-1,2-3", "bytes=99999999999999999999-"]) {
      expect((await provider.read(file, { range })).status).toBe(416);
    }
    await provider.delete(file.key);
    await provider.delete(file.key);
    await expect(provider.metadata(file.key)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects overlong and truncated streams, leaving no partial files", async () => {
    for (const body of [Buffer.from("short"), Buffer.from("too much data for this file")]) {
      await expect(provider.upload({ ...file, body: new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } }) })).rejects.toThrow(/size/);
      expect(await readdir(join(directory, "owner/course"))).toEqual([]);
    }
  });

  it("does not overwrite an existing upload", async () => {
    await provider.upload({ ...file, body: Buffer.from("0123456789") });
    await expect(provider.upload({ ...file, body: Buffer.from("abcdefghij") })).rejects.toMatchObject({ status: 409 });
    expect(await readFile(join(directory, file.key), "utf8")).toBe("0123456789");
    expect(await readdir(join(directory, "owner/course"))).toEqual(["unique-file"]);
  });

  it("cleans temporary files on cancellation", async () => {
    await expect(provider.upload({ ...file, body: Buffer.from("0123456789"), signal: AbortSignal.abort() })).rejects.toThrow();
    expect(await readdir(join(directory, "owner/course"))).toEqual([]);
  });

  it.each(["../escape", "/absolute", "a/../../escape", "a\\escape", "a/%2e%2e/escape", "a//b", "a/./b", "a\0b"])("rejects unsafe key %s", async (key) => {
    await expect(provider.upload({ ...file, key, body: Buffer.from("0123456789") })).rejects.toMatchObject({ status: 400 });
  });

  it("rejects linked parent directories and files", async () => {
    await symlink(directory, join(directory, "owner"), process.platform === "win32" ? "junction" : "dir");
    await expect(provider.upload({ ...file, body: Buffer.from("0123456789") })).rejects.toThrow("Unsafe upload directory");
    await rm(join(directory, "owner"));
    await writeFile(join(directory, "outside"), "secret");
    // Junctions and hard links need no Windows symlink privilege. Linux CI also
    // exercises O_NOFOLLOW against a real file symlink.
    if (process.platform === "win32") await link(join(directory, "outside"), join(directory, "link"));
    else await symlink(join(directory, "outside"), join(directory, "link"), "file");
    await expect(provider.read({ ...file, key: "link" })).rejects.toThrow();
  });

  it("requires an absolute directory outside the application", () => {
    for (const configured of ["", "./uploads", process.cwd(), join(process.cwd(), "public/uploads"), "/", parse(process.cwd()).root]) {
      vi.stubEnv("MEDIA_LOCAL_DIRECTORY", configured);
      expect(() => localStorageDirectory()).toThrow();
    }
  });
});
