import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inlineLocalFontAssets } from "../lib/export/inline-font-assets";

describe("standalone export font assets", () => {
  let temporaryDirectory = "";

  afterEach(async () => {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = "";
  });

  it("inlines bundled WOFF assets so single-file exports keep their fonts", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "course-font-assets-"));
    await writeFile(join(temporaryDirectory, "battambang.woff2"), Buffer.from([0, 1, 2]));

    const result = await inlineLocalFontAssets(
      '@font-face { src: url("./battambang.woff2") format("woff2"); }',
      temporaryDirectory,
    );

    expect(result).toContain("data:font/woff2;base64,AAEC");
    expect(result).not.toContain("./battambang.woff2");
  });

  it("rejects local font references that escape the export asset directory", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "course-font-assets-"));

    await expect(inlineLocalFontAssets(
      'src: url("./../outside.woff2")',
      temporaryDirectory,
    )).rejects.toThrow("invalid local font path");
  });
});
