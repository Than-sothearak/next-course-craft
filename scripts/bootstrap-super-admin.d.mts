import type { MongoClient, Db, ObjectId } from "mongodb";
export function bootstrapSuperAdmin(client: MongoClient, db: Db, userId: ObjectId): Promise<void>;
export function runBootstrap(): Promise<void>;
