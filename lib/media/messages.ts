export function mediaStorageUploadError(origin: string, status?: number) {
  const statusText = status === undefined ? "" : ` (HTTP ${status})`;
  return `The upload could not reach S3${statusText}. Add ${origin} to the bucket CORS AllowedOrigins and allow POST. See docs/media-storage.md.`;
}
