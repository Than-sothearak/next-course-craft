import { lstat, opendir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { DashboardError } from "@/lib/dashboard/rules";
import { localStorageDirectory } from "./providers/local";
import type { MediaStorageFolders } from "./settings-schema";

export function localBrowserRoot(): string | null {
  if (process.env.MEDIA_LOCAL_ROOT) return process.env.MEDIA_LOCAL_ROOT;
  const directory = process.env.MEDIA_LOCAL_DIRECTORY;
  return directory && isAbsolute(directory) ? dirname(resolve(directory)) : null;
}

function within(root: string, path: string) {
  const part = relative(root, path);
  return !isAbsolute(part) && part !== ".." && !part.startsWith(`..${sep}`);
}

// Applies to user-selected locations, not historical asset reads. Operators may
// narrow the browse root later without making existing media inaccessible.
export async function validateLocalDirectorySelection(input?: string) {
  const configuredRoot = localBrowserRoot();
  if (!configuredRoot || !isAbsolute(configuredRoot) || resolve(configuredRoot) === parse(resolve(configuredRoot)).root) throw new DashboardError("Set MEDIA_LOCAL_ROOT to an absolute storage parent directory before browsing folders.", 503);
  if (input !== undefined && (!isAbsolute(input) || input.includes("\0"))) throw new DashboardError("Choose an absolute server directory.", 400);
  const root = await realpath(configuredRoot).catch(() => { throw new DashboardError("The configured storage parent directory is unavailable. Check MEDIA_LOCAL_ROOT and server permissions.", 503); });
  if (root === parse(root).root) throw new DashboardError("The folder browser cannot use the filesystem root.", 503);
  const requested = input === undefined ? root : resolve(input);
  // Check lexical boundaries before accessing an arbitrary path.
  const base = within(root, requested) ? root : resolve(configuredRoot);
  if (!within(base, requested)) throw new DashboardError("Choose a folder inside the allowed storage directory.", 403);
  const parts = relative(base, requested).split(sep).filter(Boolean);
  let path = root;
  for (const part of parts) {
    if (part.startsWith(".")) throw new DashboardError("Hidden folders cannot be selected for media storage.", 403);
    path = join(path, part);
    const info = await lstat(path).catch(() => { throw new DashboardError("That folder is unavailable. Choose another folder or check server permissions.", 400); });
    if (info.isSymbolicLink() || !info.isDirectory()) throw new DashboardError("Choose a real server folder, not a symbolic link or file.", 400);
  }
  const canonical = await realpath(path);
  if (!within(root, canonical)) throw new DashboardError("Choose a folder inside the allowed storage directory.", 403);
  localStorageDirectory(canonical); // Also prevents storing uploads in the application.
  return { root, path: canonical };
}

export async function listLocalStorageFolders(input?: string): Promise<MediaStorageFolders> {
  const { root, path } = await validateLocalDirectorySelection(input);
  const folders: MediaStorageFolders["folders"] = [];
  const entries = await opendir(path).catch(() => { throw new DashboardError("This server folder cannot be opened. Check its permissions.", 403); });
  let truncated = false;
  let inspected = 0;
  for await (const entry of entries) {
    if (++inspected > 5000 || folders.length >= 200) { truncated = true; break; }
    if (entry.isDirectory() && !entry.name.startsWith(".")) folders.push({ name: entry.name, path: join(path, entry.name) });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  return { root, path, parent: path === root ? null : dirname(path), folders, truncated };
}
