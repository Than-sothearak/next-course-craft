import { statfs } from "node:fs/promises";

export type LocalStorageCapacity = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};

const zero = BigInt(0);
const maxSafeBytes = BigInt(Number.MAX_SAFE_INTEGER);

export async function getLocalStorageCapacity(directory?: string | null): Promise<LocalStorageCapacity | null> {
  if (!directory) return null;

  try {
    const filesystem = await statfs(directory, { bigint: true });
    const totalBytes = filesystem.blocks * filesystem.bsize;
    const freeBytes = filesystem.bavail * filesystem.bsize;
    // bfree includes blocks reserved by the filesystem, while bavail only
    // includes blocks available to this process. Use bfree to calculate actual
    // used space so reserved blocks are not reported as used by the bar.
    const usedBytes = (filesystem.blocks - filesystem.bfree) * filesystem.bsize;
    if (
      filesystem.blocks <= zero ||
      filesystem.bsize <= zero ||
      filesystem.bfree < zero ||
      filesystem.bfree > filesystem.blocks ||
      filesystem.bavail < zero ||
      filesystem.bavail > filesystem.bfree ||
      totalBytes > maxSafeBytes ||
      freeBytes > maxSafeBytes ||
      usedBytes > maxSafeBytes
    ) return null;
    return {
      totalBytes: Number(totalBytes),
      freeBytes: Number(freeBytes),
      usedBytes: Number(usedBytes),
    };
  } catch {
    // Capacity is informative UI data. A missing/unreadable folder should not
    // prevent an administrator from seeing or changing the storage settings.
    return null;
  }
}
