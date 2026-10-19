export type StorageProviderName = "local" | "s3";
export type StorageFile = { key: string; contentType: string; assetId: string; size: number };
export type StorageUpload = StorageFile & { body: Buffer | ReadableStream<Uint8Array>; signal?: AbortSignal };
export type StorageMetadata = { size: number; contentType?: string; assetId?: string };

export interface StorageProvider {
  upload(input: StorageUpload): Promise<void>;
  read(file: StorageFile, options?: { range?: string; signal?: AbortSignal }): Promise<Response>;
  delete(key: string): Promise<void>;
  metadata(key: string): Promise<StorageMetadata>;
}
