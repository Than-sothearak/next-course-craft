import { deflateRaw, deflateRawSync } from "node:zlib";
import { promisify } from "node:util";

export type ZipFile = { path: string; data: Uint8Array | string };
const deflateRawAsync = promisify(deflateRaw);

type EncodedFile = {
  name: Buffer;
  data: Buffer;
  compressed: Buffer;
  crc: number;
};

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function crc32Async(bytes: Uint8Array, signal?: AbortSignal) {
  let crc = 0xffffffff;
  for (let offset = 0; offset < bytes.length; offset += 1024 * 1024) {
    signal?.throwIfAborted();
    const end = Math.min(offset + 1024 * 1024, bytes.length);
    for (let index = offset; index < end; index += 1) crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  signal?.throwIfAborted();
  return (crc ^ 0xffffffff) >>> 0;
}

function safePath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === ".." || part.includes(":"))) {
    throw new Error("ZIP paths must be relative and cannot traverse directories.");
  }
  return normalized;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function assembleZip(entries: EncodedFile[], methods: number[]) {
  const now = dosDateTime(new Date());
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const [index, entry] of entries.entries()) {
    const method = methods[index];
    const local = Buffer.alloc(30 + entry.name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(now.dosTime, 10);
    local.writeUInt16LE(now.dosDate, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(entry.compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(entry.name.length, 26);
    local.writeUInt16LE(0, 28);
    entry.name.copy(local, 30);
    localParts.push(local, entry.compressed);

    const central = Buffer.alloc(46 + entry.name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(now.dosTime, 12);
    central.writeUInt16LE(now.dosDate, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(entry.name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    entry.name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length + entry.compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  if (localOffset > 0xffffffff || centralDirectory.length > 0xffffffff) {
    throw new Error("SCORM package exceeds ZIP format limits.");
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function encodeEntry(path: string, data: Uint8Array | string, compress: (bytes: Buffer) => Buffer) {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  if (bytes.length > 0xffffffff) throw new Error("SCORM package file exceeds ZIP format limits.");
  return { name: Buffer.from(safePath(path), "utf8"), data: bytes, compressed: compress(bytes), crc: crc32(bytes) };
}

export function createZipArchive(files: ZipFile[]) {
  if (files.length > 65_535) throw new Error("SCORM package contains too many files.");
  return assembleZip(files.map(({ path, data }) => encodeEntry(path, data, deflateRawSync)), files.map(() => 8));
}

const storedExtensions = new Set(["avif", "gif", "jpg", "jpeg", "png", "webp", "mp3", "m4a", "ogg", "wav", "weba", "mp4", "ogv", "webm", "pdf", "zip"]);

export async function createZipArchiveAsync(files: ZipFile[], options: { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void } = {}) {
  if (files.length > 65_535) throw new Error("SCORM package contains too many files.");
  const entries: EncodedFile[] = [];
  const methods: number[] = [];
  for (const { path, data } of files) {
    options.signal?.throwIfAborted();
    const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
    if (bytes.length > 0xffffffff) throw new Error("SCORM package file exceeds ZIP format limits.");
    const name = Buffer.from(safePath(path), "utf8");
    const crc = await crc32Async(bytes, options.signal);
    const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
    const method = storedExtensions.has(extension) ? 0 : 8;
    entries.push({ name, data: bytes, compressed: method === 0 ? bytes : await deflateRawAsync(bytes), crc });
    methods.push(method);
    options.onProgress?.(entries.length, files.length);
  }
  options.signal?.throwIfAborted();
  return assembleZip(entries, methods);
}
