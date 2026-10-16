import type { ObjectId, MongoClient, Db } from "mongodb";
export function migrationFields(user: { _id: ObjectId; role?: string; status?: string; email?: string; createdAt?: Date; updatedAt?: Date }, now?: Date): Record<string, unknown>;
export function runMigration(): Promise<void>;
export function applyUserApprovalMigration(client: MongoClient, db: Db, actorId: ObjectId): Promise<number>;
