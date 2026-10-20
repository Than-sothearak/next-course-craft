import { DashboardError } from "@/lib/dashboard/rules";
import { readStoredMedia, type StoredMedia } from "./service";

// A bounded signature check supplements the existing MIME/size allowlist.
export function hasMediaSignature(type: string, bytes: Buffer) {
  const starts = (value: string) => bytes.subarray(0, value.length).toString("latin1") === value;
  const at = (offset: number, value: string) => bytes.subarray(offset, offset + value.length).toString("latin1") === value;
  switch (type) {
    case "image/png": return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/jpeg": return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/gif": return starts("GIF87a") || starts("GIF89a");
    case "image/webp": return starts("RIFF") && at(8, "WEBP");
    case "image/avif": return at(4, "ftyp") && /avif|avis/.test(bytes.subarray(8, 64).toString("latin1"));
    case "video/mp4": case "audio/mp4": return at(4, "ftyp");
    case "video/webm": case "audio/webm": return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    case "audio/ogg": return starts("OggS");
    case "audio/wav": return starts("RIFF") && at(8, "WAVE");
    case "audio/mpeg": return starts("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case "application/pdf": return starts("%PDF-");
    // Opaque attachments are always downloaded with nosniff; their file format
    // is not interpreted by the course player.
    case "application/octet-stream": return true;
    case "text/plain": return !bytes.includes(0) && !starts("MZ") && !starts("\x7fELF") && !starts("#!");
    default: return false;
  }
}

export async function validateStoredMediaType(asset: StoredMedia) {
  const response = await readStoredMedia(asset, { range: `bytes=0-${Math.min(asset.size, 512) - 1}` });
  if (!response.ok || !response.body) throw new DashboardError("The uploaded file could not be inspected.", 502);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (size < 512) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = Buffer.from(value.subarray(0, 512 - size));
      chunks.push(part);
      size += part.length;
    }
  } finally { await reader.cancel(); }
  if (!hasMediaSignature(asset.mimeType, Buffer.concat(chunks))) throw new DashboardError("The file contents do not match the selected media type.", 400);
}
