export async function readResponseJson<T = unknown>(response: Response): Promise<T | null | undefined> {
  const body = await response.text();
  if (!body.trim()) return undefined;
  try {
    return JSON.parse(body) as T | null;
  } catch {
    return undefined;
  }
}
