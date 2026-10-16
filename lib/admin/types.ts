import type { AccountStatus, Permission, PlatformRole } from "@/lib/auth/policy";

export type AdminUser = { id: string; name: string; email: string | null; image: string | null; role: string; status: AccountStatus; createdAt: string; updatedAt: string; lastLoginAt: string | null; deletedAt: string | null; suspensionReason?: string };
export type AdminCourse = { id: string; title: string; status: string; ownerId: string; ownerName: string; ownerEmail: string | null; createdAt: string; updatedAt: string; deletedAt: string | null; workspaceId: string | null };
export type AuditEntry = { id: string; actorId: string; actorName: string; action: string; targetType: string; targetId: string | null; metadata: Record<string, unknown>; createdAt: string };
export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number };
export type RolePolicy = { role: PlatformRole; permissions: Permission[]; ceiling: Permission[] };
export type AdminSummary = { counts: { totalUsers: number; pending: number; active: number; suspended: number; totalCourses: number | null; published: number | null }; registrations: AdminUser[]; activity: AuditEntry[] };
export type AdminUserDetail = { user: AdminUser; courses: AdminCourse[]; activity: AuditEntry[] };
export type CourseAssignments = { owner: { id: string; name: string; email: string | null }; assignments: Array<{ userId: string; name: string; email: string | null; role: "editor" | "viewer"; status: string }> };
