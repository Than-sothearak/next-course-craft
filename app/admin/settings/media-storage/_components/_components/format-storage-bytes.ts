export function formatStorageBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = -1;
  do { value /= 1024; unit += 1; } while (value >= 1024 && unit < units.length - 1);
  return `${Number(value.toFixed(value < 10 ? 1 : 0))} ${units[unit]}`;
}
