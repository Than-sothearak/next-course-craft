import { describe, expect, it } from "vitest";
import { filterAndSortMedia, type MediaLibraryAsset, type MediaLibrarySort } from "@/lib/media/library";
import { mediaLibraryCursorSchema } from "@/lib/media/schemas";

const asset = (id: string, originalName: string, contentType: string, size: number, createdAt: string): MediaLibraryAsset => ({ id, originalName, contentType, size, createdAt, fileUrl: `/api/assets/${id}/file` });
const assets = [
  asset("v10", "Clip 10.mp4", "video/mp4", 900, "2026-01-02T00:00:00.000Z"),
  asset("a", "Narration.wav", "audio/wav", 300, "2026-01-04T00:00:00.000Z"),
  asset("v2", "clip 2.webm", "video/webm", 600, "2026-01-03T00:00:00.000Z"),
  asset("d", "A [notes].txt", "text/plain", 100, "2026-01-01T00:00:00.000Z"),
];

describe("media library browsing", () => {
  it.each<[MediaLibrarySort, string[]]>([
    ["newest", ["a", "v2", "v10", "d"]], ["oldest", ["d", "v10", "v2", "a"]],
    ["name-asc", ["d", "v2", "v10", "a"]], ["name-desc", ["a", "v10", "v2", "d"]],
    ["type", ["a", "d", "v10", "v2"]], ["size-desc", ["v10", "v2", "a", "d"]], ["size-asc", ["d", "a", "v2", "v10"]],
  ])("sorts by %s without changing the source array", (sort, ids) => {
    const before = [...assets];
    expect(filterAndSortMedia(assets, { kind: "attachment", sort }).map(item => item.id)).toEqual(ids);
    expect(assets).toEqual(before);
  });

  it("combines case-insensitive text terms, file type, and the picker's allowed kind", () => {
    expect(filterAndSortMedia(assets, { kind: "video", query: " CLIP   WEBM ", fileType: "video/webm" }).map(item => item.id)).toEqual(["v2"]);
    expect(filterAndSortMedia(assets, { kind: "audio", query: "wav", fileType: "video/mp4" })).toEqual([]);
    expect(filterAndSortMedia(assets, { kind: "document", query: "[notes]" }).map(item => item.id)).toEqual(["d"]);
    expect(filterAndSortMedia(assets, { kind: "document", query: ".*" })).toEqual([]);
  });

  it("validates pagination cursors before they reach a database query", () => {
    const createdAt = "2026-01-01T00:00:00.000Z", id = "a".repeat(24);
    expect(mediaLibraryCursorSchema.parse(`${createdAt}~${id}`)).toEqual({ createdAt, id });
    for (const value of ["", "bad~" + id, `${createdAt}~$ne`, `${createdAt}~${id}~extra`, "x".repeat(100)]) expect(mediaLibraryCursorSchema.safeParse(value).success).toBe(false);
  });
});
