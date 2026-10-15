import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { copyMediaObject } from "../lib/media/storage";
import { courseAssetIds, remapCourseAssetUrls } from "../lib/media/asset-references";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-s3", async (importOriginal) => ({
  ...await importOriginal<typeof import("@aws-sdk/client-s3")>(),
  S3Client: class { send = send; },
}));

describe("private media copying", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AWS_REGION", "ap-southeast-1");
    vi.stubEnv("AWS_S3_BUCKET", "course-media");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    send.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("copies bytes privately with the new asset ID and encodes source object names", async () => {
    await copyMediaObject({ sourceKey: "owner/course/image #1 %.png", objectKey: "owner/copy/new-asset", assetId: "new-asset", contentType: "image/png" });
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(CopyObjectCommand);
    expect(command.input).toEqual({
      Bucket: "course-media", Key: "owner/copy/new-asset", CopySource: "course-media/owner/course/image%20%231%20%25.png",
      MetadataDirective: "REPLACE", Metadata: { "asset-id": "new-asset" },
      ContentType: "image/png", CacheControl: "private, max-age=300",
    });
    expect(command.input.ACL).toBeUndefined();
  });

  it("propagates storage failures so callers can roll back a partial copy", async () => {
    send.mockRejectedValueOnce(new Error("Missing object"));
    await expect(copyMediaObject({ sourceKey: "missing", objectKey: "copy", assetId: "new", contentType: "image/png" })).rejects.toThrow("Missing object");
  });

  it("requires the existing storage configuration", async () => {
    vi.stubEnv("AWS_S3_BUCKET", "");
    await expect(copyMediaObject({ sourceKey: "source", objectKey: "copy", assetId: "new", contentType: "image/png" })).rejects.toMatchObject({ status: 503 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("course media references", () => {
  const id = "abcdef0123456789abcdef01";
  it("rewrites nested media and HTML without changing the original or unrelated URLs", () => {
    const input = { src: `/api/assets/${id}/file`, nested: [{ html: `<img src="/api/assets/${id.toUpperCase()}/file">`, external: "https://example.com/image.png" }], empty: null, count: 1 };
    const output = remapCourseAssetUrls(input, new Map([[id, "/api/assets/0123456789abcdef01234567/file"]]));
    expect([...courseAssetIds(input)]).toEqual([id]);
    expect(output.src).toBe("/api/assets/0123456789abcdef01234567/file");
    expect(output.nested[0].html).toContain(output.src);
    expect(output.nested[0].external).toBe(input.nested[0].external);
    expect(input.src).toContain(id);
    expect(output.empty).toBeNull();
    expect(output.count).toBe(1);
    expect(remapCourseAssetUrls(input, new Map())).toEqual(input);
    expect(courseAssetIds(undefined).size).toBe(0);
  });
});
