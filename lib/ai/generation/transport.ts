import { Agent, request } from "node:https";

// Node fetch has its own response-header timeout. Use the stage's AbortSignal
// as the deadline for these long requests, without changing global networking.
const generationAgent = new Agent({ keepAlive: true, timeout: 0 });
const maximumResponseBytes = 16 * 1024 * 1024;

export function requestGenerationResponse(apiKey: string, body: string, signal: AbortSignal): Promise<Response> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const pending = request("https://api.openai.com/v1/responses", {
      agent: generationAgent,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
      signal,
      timeout: 0,
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maximumResponseBytes) {
          pending.destroy(new Error("AI response exceeded its size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.once("error", (error) => reject(signal.aborted ? signal.reason : error));
      response.once("end", () => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
          else if (value !== undefined) headers.set(name, value);
        }
        resolve(new Response(size ? Buffer.concat(chunks, size).toString("utf8") : null, {
          status: response.statusCode ?? 502,
          headers,
        }));
      });
    });
    pending.once("error", (error) => reject(signal.aborted ? signal.reason : error));
    pending.end(body);
  });
}
