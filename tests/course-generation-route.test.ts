import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/courses/[courseId]/generate/route";
import { cancelSourceGenerationJob, generateCourseDraft, getSourceGenerationJob } from "../lib/ai/course-generation";
import { getGenerationLeaseStatus } from "../lib/ai/generation-lease";
import { resolveCourseAccess } from "../lib/workspaces/access";
import { DashboardError } from "../lib/dashboard/rules";

vi.mock("../lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "507f1f77bcf86cd799439011" } })) }));
vi.mock("../lib/db/mongodb", () => ({ connectToDatabase: vi.fn(async () => undefined) }));
vi.mock("../lib/workspaces/access", () => ({ resolveCourseAccess: vi.fn(async () => ({ ownerId: "507f1f77bcf86cd799439011", permissions: [] })) }));
vi.mock("../lib/auth/authorization", () => ({ requireActiveUser: vi.fn(async () => ({ id: "507f1f77bcf86cd799439011" })), requireAIEnabled: vi.fn() }));
vi.mock("../lib/ai/generation-lease", () => ({ acquireGenerationLease: vi.fn(async () => ({ courseId: "course", token: "lease" })), getGenerationLeaseStatus: vi.fn(async () => ({ locked: false })), releaseGenerationLease: vi.fn(async () => undefined) }));
vi.mock("../lib/ai/course-generation", () => ({
  advanceSourceGenerationJob: vi.fn(), cancelSourceGenerationJob: vi.fn(), createSourceGenerationJob: vi.fn(),
  generateCourseDraft: vi.fn(), getLastCompletedSourceGenerationJob: vi.fn(), getSourceGenerationJob: vi.fn(), startSourceGenerationJob: vi.fn(),
}));

const courseId = "507f1f77bcf86cd799439012";
const draft = { title: "Prompt course", description: "Generated without a file.", sections: [], lessons: [], template: "custom", learningLessonCount: 0, generatedImageCount: 0 };

function submit(settings: Record<string, string> = {}) {
  const form = new FormData();
  Object.entries({ action: "generate", prompt: "Teach HTML and CSS with complete examples.", template: "custom", lessonCount: "2", ...settings })
    .forEach(([key, value]) => form.set(key, value));
  return POST(new NextRequest(`http://localhost/api/courses/${courseId}/generate`, { method: "POST", body: form }), { params: Promise.resolve({ courseId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateCourseDraft).mockResolvedValue(draft as Awaited<ReturnType<typeof generateCourseDraft>>);
});

describe("prompt-only course generation requests", () => {
  it("generates Custom content without a file and ignores hidden Pre/Post and source settings", async () => {
    const response = await submit({ postTestCount: "0", slidesPerContent: "-1", learnGroupingMode: "fixed" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(draft);
    expect(generateCourseDraft).toHaveBeenCalledWith({
      ownerId: "507f1f77bcf86cd799439011", courseId, sourceFile: undefined,
      input: expect.objectContaining({ template: "custom", lessonCount: 2, postTestCount: 5, learnGroupingMode: "smart", slidesPerContent: 5 }),
    });
    expect(resolveCourseAccess).toHaveBeenCalledWith("507f1f77bcf86cd799439011", courseId, "ai.generate");
  });

  it("accepts changed visible settings in prompt-only Pre / Learn / Post mode", async () => {
    const response = await submit({
      template: "preLearnPost", lessonCount: "8", level: "advanced", targetLanguage: "Khmer",
      contentDepth: "veryDetailed", interactivity: "low", postTestCount: "10", model: "gpt-6.1-sol", slidesPerContent: "0",
    });
    expect(response.status).toBe(200);
    expect(generateCourseDraft).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({
      template: "preLearnPost", lessonCount: 8, level: "advanced", targetLanguage: "Khmer", contentDepth: "veryDetailed",
      interactivity: "low", postTestCount: 10, model: "gpt-6.1-sol", slidesPerContent: 5,
    }) }));
  });

  it("accepts a single requested Learning lesson", async () => {
    const response = await submit({ template: "preLearnPost", lessonCount: "1" });
    expect(response.status).toBe(200);
    expect(generateCourseDraft).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ template: "preLearnPost", lessonCount: 1 }),
    }));
  });

  it("uses defaults for blank optional settings", async () => {
    const response = await submit({ lessonCount: "", model: "", level: "", contentDepth: "", targetLanguage: "" });
    expect(response.status).toBe(200);
    expect(generateCourseDraft).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ lessonCount: 5, model: undefined, level: "beginner", contentDepth: "detailed", targetLanguage: "English" }) }));
  });

  it("identifies invalid visible settings before contacting the AI provider", async () => {
    const response = await submit({ template: "preLearnPost", postTestCount: "21" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Post-test questions must be a whole number from 1 to 20." });
    expect(generateCourseDraft).not.toHaveBeenCalled();
  });

  it("checks a saved job without validating unrelated generation settings", async () => {
    vi.mocked(getSourceGenerationJob).mockResolvedValue({ jobId: "saved-job", status: "completed" } as Awaited<ReturnType<typeof getSourceGenerationJob>>);
    const response = await submit({ action: "getGeneration", jobId: "saved-job", lessonCount: "invalid", model: "invalid" });
    expect(response.status).toBe(200);
    expect(getSourceGenerationJob).toHaveBeenCalledWith({ ownerId: "507f1f77bcf86cd799439011", courseId, jobId: "saved-job" });
    expect(generateCourseDraft).not.toHaveBeenCalled();
  });

  it("returns the active generation lease state through a status action", async () => {
    vi.mocked(getGenerationLeaseStatus).mockResolvedValueOnce({ locked: true, retryAfterMs: 500 });
    const formData = new FormData();
    formData.set("action", "getGenerationLease");
    const request = new NextRequest(`http://localhost/api/courses/${courseId}/generate`, { method: "POST", body: formData });
    const response = await POST(request, { params: Promise.resolve({ courseId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locked: true, retryAfterMs: 500 });
    expect(getGenerationLeaseStatus).toHaveBeenCalledWith("507f1f77bcf86cd799439011", courseId);
    expect(generateCourseDraft).not.toHaveBeenCalled();
  });

  it("rejects generation for a course the caller does not own", async () => {
    vi.mocked(resolveCourseAccess).mockRejectedValueOnce(new DashboardError("Course not found.", 404));
    const response = await submit();
    expect(response.status).toBe(404);
    expect(generateCourseDraft).not.toHaveBeenCalled();
  });

  it("cancels an owned job without validating generation settings or invoking AI", async () => {
    vi.mocked(cancelSourceGenerationJob).mockResolvedValue({ jobId: "saved-job", status: "cancelled" } as Awaited<ReturnType<typeof cancelSourceGenerationJob>>);
    const response = await submit({ action: "cancelGeneration", jobId: "saved-job", lessonCount: "invalid" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "cancelled" });
    expect(cancelSourceGenerationJob).toHaveBeenCalledWith({ ownerId: "507f1f77bcf86cd799439011", courseId, jobId: "saved-job" });
    expect(generateCourseDraft).not.toHaveBeenCalled();
  });

  it("rejects cancellation when the caller does not own the course", async () => {
    vi.mocked(resolveCourseAccess).mockRejectedValueOnce(new DashboardError("Course not found.", 404));
    const response = await submit({ action: "cancelGeneration", jobId: "saved-job" });
    expect(response.status).toBe(404);
    expect(cancelSourceGenerationJob).not.toHaveBeenCalled();
  });
});
