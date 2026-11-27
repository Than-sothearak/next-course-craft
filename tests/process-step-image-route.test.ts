import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/courses/[courseId]/process-step-image/route";
import { requireActiveUser, requireAIEnabled } from "@/lib/auth/authorization";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { acquireGenerationLease, releaseGenerationLease } from "@/lib/ai/generation-lease";
import { createGeneratedImageAsset } from "@/lib/ai/generation/images";
import { DashboardError } from "@/lib/dashboard/rules";
import { Asset } from "@/models/Asset";

vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireActiveUser: vi.fn(), requireAIEnabled: vi.fn() }));
vi.mock("@/lib/workspaces/access", () => ({ resolveCourseAccess: vi.fn() }));
vi.mock("@/lib/ai/generation-lease", () => ({ acquireGenerationLease: vi.fn(), releaseGenerationLease: vi.fn() }));
vi.mock("@/lib/ai/generation/images", () => ({ createGeneratedImageAsset: vi.fn() }));
vi.mock("@/models/Asset", () => ({ Asset: { findOne: vi.fn() } }));

const userId = "507f1f77bcf86cd799439010", ownerId = "507f1f77bcf86cd799439011", courseId = "507f1f77bcf86cd799439012", assetId = "507f1f77bcf86cd799439013";
const lease = { courseId, token: "00000000-0000-0000-0000-000000000000" as const };
const media = { src: `/api/assets/${assetId}/file`, fileName: "generated.webp", mimeType: "image/webp", size: 150_000 };
function submit(body: unknown = { title: "Prepare", instructions: "Wash the vegetables." }, options: { origin?: string; id?: string } = {}) {
  return POST(new NextRequest(`http://localhost/api/courses/${courseId}/process-step-image`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(options.origin ? { Origin: options.origin } : {}) }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ courseId: options.id ?? courseId }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireActiveUser).mockResolvedValue({ id: userId } as Awaited<ReturnType<typeof requireActiveUser>>);
  vi.mocked(resolveCourseAccess).mockResolvedValue({ ownerId, permissions: [] } as unknown as Awaited<ReturnType<typeof resolveCourseAccess>>);
  vi.mocked(acquireGenerationLease).mockResolvedValue(lease);
  vi.mocked(releaseGenerationLease).mockResolvedValue(undefined);
  vi.mocked(createGeneratedImageAsset).mockResolvedValue({ id: assetId, src: media.src });
  vi.mocked(Asset.findOne).mockReturnValue({ select: () => ({ lean: async () => ({ originalName: media.fileName, mimeType: media.mimeType, size: media.size }) }) } as never);
});

describe("process step image generation", () => {
  it("uses draft instructions and stores media under the resolved course owner", async () => {
    const response = await submit();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ media });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(resolveCourseAccess).toHaveBeenCalledWith(userId, courseId, "courses.edit");
    expect(resolveCourseAccess).toHaveBeenCalledWith(userId, courseId, "ai.generate");
    expect(requireAIEnabled).toHaveBeenCalledOnce();
    expect(createGeneratedImageAsset).toHaveBeenCalledWith(ownerId, courseId, expect.stringContaining("Wash the vegetables."), { purpose: "process-step-guide" });
    expect(Asset.findOne).toHaveBeenCalledWith({ _id: assetId, ownerId, courseId, status: "ready" });
    expect(releaseGenerationLease).toHaveBeenCalledWith(lease);
  });
  it("lets a custom prompt replace the step instructions", async () => {
    expect((await submit({ title: "Prepare", instructions: "Original step text", customPrompt: "  Draw a bowl of carrots  " })).status).toBe(201);
    const prompt = vi.mocked(createGeneratedImageAsset).mock.calls[0][2];
    expect(prompt).toContain("Draw a bowl of carrots");
    expect(prompt).not.toContain("Original step text");
  });
  it("accepts custom instructions for an empty step", async () => {
    expect((await submit({ customPrompt: "Show a seedling" })).status).toBe(201);
  });
  it.each([{}, { instructions: "  " }, { instructions: "x".repeat(5001) }, { customPrompt: "x".repeat(5001) }, { title: "x".repeat(161), instructions: "Draw" }])("rejects invalid input before acquiring a lease: %j", async (body) => {
    expect((await submit(body)).status).toBe(400);
    expect(acquireGenerationLease).not.toHaveBeenCalled();
    expect(createGeneratedImageAsset).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests and invalid course IDs", async () => {
    expect((await submit(undefined, { origin: "https://other.example" })).status).toBe(403);
    expect((await submit(undefined, { id: "invalid" })).status).toBe(400);
    expect(createGeneratedImageAsset).not.toHaveBeenCalled();
  });
  it.each(["courses.edit", "ai.generate"])("enforces %s access", async (permission) => {
    vi.mocked(resolveCourseAccess).mockImplementation(async (_user, _course, requested) => {
      if (requested === permission) throw new DashboardError("Access denied", 403);
      return { ownerId, permissions: [] } as unknown as Awaited<ReturnType<typeof resolveCourseAccess>>;
    });
    expect((await submit()).status).toBe(403);
    expect(createGeneratedImageAsset).not.toHaveBeenCalled();
  });
  it("enforces the platform AI switch", async () => {
    vi.mocked(requireAIEnabled).mockRejectedValueOnce(new DashboardError("AI disabled", 403));
    expect((await submit()).status).toBe(403);
    expect(acquireGenerationLease).not.toHaveBeenCalled();
  });
  it("requires an authenticated author", async () => {
    vi.mocked(requireActiveUser).mockRejectedValueOnce(new DashboardError("Sign in required", 401));
    expect((await submit()).status).toBe(401);
    expect(createGeneratedImageAsset).not.toHaveBeenCalled();
  });
  it("does not return missing or unowned generated assets", async () => {
    vi.mocked(Asset.findOne).mockReturnValue({ select: () => ({ lean: async () => null }) } as never);
    expect((await submit()).status).toBe(502);
    expect(releaseGenerationLease).toHaveBeenCalledWith(lease);
  });
  it("prevents concurrent generation", async () => {
    vi.mocked(acquireGenerationLease).mockRejectedValueOnce(new DashboardError("Generation busy", 409));
    expect((await submit()).status).toBe(409);
    expect(createGeneratedImageAsset).not.toHaveBeenCalled();
    expect(releaseGenerationLease).not.toHaveBeenCalled();
  });
  it("releases the generation lease on provider failure", async () => {
    vi.mocked(createGeneratedImageAsset).mockRejectedValueOnce(new DashboardError("Image service unavailable", 502));
    const response = await submit();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Image service unavailable" });
    expect(releaseGenerationLease).toHaveBeenCalledWith(lease);
  });
  it("rejects an ownership change while generating", async () => {
    vi.mocked(resolveCourseAccess).mockResolvedValueOnce({ ownerId } as never).mockResolvedValueOnce({ ownerId } as never).mockResolvedValueOnce({ ownerId: userId } as never);
    expect((await submit()).status).toBe(409);
    expect(releaseGenerationLease).toHaveBeenCalledWith(lease);
  });
});
