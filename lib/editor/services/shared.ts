import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { DashboardError } from "@/lib/dashboard/rules";

export function ownerObjectId(ownerId: string) {
  if (!Types.ObjectId.isValid(ownerId)) {
    throw new DashboardError("Your account session is invalid. Sign in again.", 401);
  }
  return new Types.ObjectId(ownerId);
}

export function defaultSection() {
  return { id: randomUUID(), title: "Getting started", order: 0 };
}
