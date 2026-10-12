export class DashboardError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DashboardError";
  }
}

export function normalizeFolderName(name: string): string {
  return name.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

export function assertNoFolderCycle(folderId: string, proposedAncestors: readonly string[]) {
  if (proposedAncestors.includes(folderId)) {
    throw new DashboardError("A folder cannot be moved inside itself or one of its subfolders.", 409);
  }
  if (proposedAncestors.length > 100) {
    throw new DashboardError("Folder nesting is limited to 100 levels.", 409);
  }
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
