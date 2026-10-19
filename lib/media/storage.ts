import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DashboardError } from "@/lib/dashboard/rules";

let s3Client: S3Client | null = null;

function getStorage() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !bucket) {
    throw new DashboardError("Media storage is not configured. Set AWS_REGION and AWS_S3_BUCKET.", 503);
  }
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new DashboardError("Configure both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or use an AWS role.", 503);
  }

  s3Client ??= new S3Client({
    region,
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 5_000, requestTimeout: 30_000 },
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey, ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}) } } : {}),
  });
  return { client: s3Client, bucket };
}

export async function createMediaUploadPost({
  objectKey,
  assetId,
  contentType,
  size,
}: {
  objectKey: string;
  assetId: string;
  contentType: string;
  size: number;
}) {
  const { client, bucket } = getStorage();
  return createPresignedPost(client, {
    Bucket: bucket,
    Key: objectKey,
    Expires: 300,
    Fields: {
      "Content-Type": contentType,
      "x-amz-meta-asset-id": assetId,
    },
    Conditions: [
      ["content-length-range", size, size],
      ["eq", "$Content-Type", contentType],
      ["eq", "$x-amz-meta-asset-id", assetId],
    ],
  });
}

export async function inspectMediaObject(objectKey: string) {
  const { client, bucket } = getStorage();
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
}

export async function deleteMediaObject(objectKey: string) {
  const { client, bucket } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}

export async function copyMediaObject({ sourceKey, objectKey, assetId, contentType }: {
  sourceKey: string;
  objectKey: string;
  assetId: string;
  contentType: string;
}) {
  const { client, bucket } = getStorage();
  await client.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    CopySource: `${bucket}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
    MetadataDirective: "REPLACE",
    Metadata: { "asset-id": assetId },
    ContentType: contentType,
    CacheControl: "private, max-age=300",
  }));
}

export async function storeGeneratedImage({
  objectKey,
  assetId,
  body,
}: {
  objectKey: string;
  assetId: string;
  body: Buffer;
}) {
  await putMediaObject({ objectKey, assetId, body, contentType: "image/png", metadata: { source: "ai-course-generation" } });
}

export async function putMediaObject({ objectKey, assetId, contentType, body, metadata }: {
  objectKey: string; assetId: string; contentType: string; body: Buffer; metadata?: Record<string, string>;
}) {
  const { client, bucket } = getStorage();
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: objectKey, Body: body, ContentType: contentType,
    CacheControl: "private, max-age=300", Metadata: { ...metadata, "asset-id": assetId },
  }));
}

export async function createMediaReadUrl({ objectKey, contentType }: { objectKey: string; contentType: string }) {
  const { client, bucket } = getStorage();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ResponseContentType: contentType,
    ResponseContentDisposition: "inline",
    ResponseCacheControl: "private, max-age=300",
  }), { expiresIn: 300 });
}
