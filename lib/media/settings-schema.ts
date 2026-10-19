import { z } from "zod";

export const storageProviderSchema = z.enum(["local", "s3"]);
export const localDirectorySchema = z.string().trim().min(1).max(4096).refine((value) => !value.includes("\0"), "Invalid directory.");
export const mediaStorageTestSchema = z.object({ provider: storageProviderSchema, localDirectory: localDirectorySchema.optional() }).strict();
export const mediaStorageSettingsSchema = mediaStorageTestSchema.extend({ revision: z.number().int().min(0) });
export const mediaStorageFolderQuerySchema = z.object({ path: localDirectorySchema.optional() }).strict();
export type MediaStorageFolders = {
  root: string; path: string; parent: string | null;
  folders: { name: string; path: string }[]; truncated: boolean;
};
export type MediaStorageSettings = {
  provider: z.infer<typeof storageProviderSchema>;
  revision: number;
  local: { directory: string | null; browseRoot: string | null };
  s3: { bucket: string | null; region: string | null };
};
