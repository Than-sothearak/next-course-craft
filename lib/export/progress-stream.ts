import { NextResponse, type NextRequest } from "next/server";

export type ExportProgress = { stage: string; value: number };
export type ExportArtifact = { data: Uint8Array | string; filename: string };

/** Streams progress records first, followed by a file header and the raw file bytes. */
export function progressExportResponse(
  request: NextRequest,
  build: (report: (progress: ExportProgress) => void, signal: AbortSignal) => Promise<ExportArtifact>,
) {
  const encoder = new TextEncoder();
  let cancelled = false;
  const exportController = new AbortController();
  const abortExport = () => exportController.abort(request.signal.reason);
  request.signal.addEventListener("abort", abortExport, { once: true });
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (value: unknown) => {
        if (!cancelled && !request.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      };
      void (async () => {
        try {
          send({ type: "progress", stage: "Preparing export", value: 2 });
          const artifact = await build(({ stage, value }) => send({ type: "progress", stage, value: Math.max(2, Math.min(94, Math.round(value))) }), exportController.signal);
          if (cancelled || exportController.signal.aborted) return;
          const bytes = typeof artifact.data === "string" ? encoder.encode(artifact.data) : artifact.data;
          send({ type: "file", filename: artifact.filename, size: bytes.byteLength });
          for (let offset = 0; offset < bytes.byteLength; offset += 1024 * 1024) {
            if (cancelled || exportController.signal.aborted) return;
            controller.enqueue(bytes.subarray(offset, Math.min(offset + 1024 * 1024, bytes.byteLength)));
          }
          if (!cancelled) controller.close();
        } catch (error) {
          if (!cancelled && !exportController.signal.aborted) {
            send({ type: "error", message: error instanceof Error ? error.message : "Could not create the export." });
            controller.close();
          }
        } finally { request.signal.removeEventListener("abort", abortExport); }
      })();
    },
    cancel() { cancelled = true; exportController.abort(); request.signal.removeEventListener("abort", abortExport); },
  });
  return new NextResponse(body, {
    headers: { "Content-Type": "application/vnd.coursecraft.export-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
