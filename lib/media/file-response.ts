import { NextResponse, type NextRequest } from "next/server";
import { DashboardError } from "@/lib/dashboard/rules";
import { readStoredMedia, type StoredMedia } from "./service";

export async function mediaFileResponse(request: NextRequest, asset: StoredMedia & { originalName: string }) {
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new DashboardError("Invalid media range.", 400);
  const upstream = await readStoredMedia(asset, { range: range ?? undefined, signal: request.signal });
  if (!upstream.ok && upstream.status !== 416) throw new DashboardError("The media file could not be read.", 502);
  const headers = new Headers({
    "Content-Type": asset.mimeType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  headers.set("Content-Disposition", asset.mimeType.startsWith("application/") || asset.mimeType.startsWith("text/")
    ? `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalName)}` : "inline");
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
