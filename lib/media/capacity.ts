import { statfs } from "node:fs/promises";

export type LocalStorageCapacity = { totalBytes: number; freeBytes: number };

const zero = BigInt(0);
const maxSafeBytes = BigInt(Number.MAX_SAFE_INTEGER);

export async function getLocalStorageCapacity(directory?: string | null): Promise<LocalStorageCapacity | null> {
  if (!directory) return null;

  try {
    const filesystem = await statfs(directory, { bigint: true });
    const totalBytes = filesystem.blocks * filesystem.bsize;
    const freeBytes = filesystem.bavail * filesystem.bsize;
    if (totalBytes <= zero || freeBytes < zero || freeBytes > totalBytes || totalBytes > maxSafeBytes) return null;
    return { totalBytes: Number(totalBytes), freeBytes: Number(freeBytes) };
  } catch {
    // Capacity is informative UI data. A missing/unreadable folder should not
    // prevent an administrator from seeing or changing the storage settings.
    return null;
  }
}
