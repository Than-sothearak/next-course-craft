import type { AdminWorkspace } from "@/lib/admin/types";

export type WorkspaceAction = { workspace: AdminWorkspace; action: "update" | "delete" };
