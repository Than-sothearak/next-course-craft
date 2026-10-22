import { afterEach, describe, expect, it, vi } from "vitest";
import { Course } from "../models/Course";
import { acquireGenerationLease, getGenerationLeaseStatus, releaseGenerationLease } from "../lib/ai/generation-lease";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("generation lease during long requests", () => {
  it("keeps a course locked beyond ten minutes and releases only its matching token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
    const ownerId = "507f1f77bcf86cd799439011";
    const courseId = "507f1f77bcf86cd799439012";
    const acquire = vi.spyOn(Course, "findOneAndUpdate").mockReturnValue({
      select: () => ({ lean: async () => ({ _id: courseId }) }),
    } as never);
    const lease = await acquireGenerationLease(ownerId, courseId);
    const update = acquire.mock.calls[0][1] as { $set: { generationLockUntil: Date } };
    vi.spyOn(Course, "findOne").mockReturnValue({
      select: () => ({ lean: async () => ({ generationLockUntil: update.$set.generationLockUntil }) }),
    } as never);

    vi.advanceTimersByTime(11 * 60 * 1_000);
    expect(await getGenerationLeaseStatus(ownerId, courseId)).toMatchObject({ locked: true });

    const release = vi.spyOn(Course, "updateOne").mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
    await releaseGenerationLease(lease);
    expect(release).toHaveBeenCalledWith({ _id: courseId, generationLockToken: lease.token }, { $set: { generationLockToken: null, generationLockUntil: null } });
  });
});
