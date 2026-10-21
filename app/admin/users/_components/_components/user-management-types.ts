import type { Permission, PlatformRole } from "@/lib/auth/policy";

export type Authority = { actorId: string; role: PlatformRole; permissions: Permission[] };
