import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { GenerationJob } from "../models/GenerationJob";
import { GenerationCheckpoint } from "../models/GenerationCheckpoint";
import { advanceSourceGenerationJob, startSourceGenerationJob } from "../lib/ai/course-generation";
import { courseGenerationInputSchema } from "../lib/ai/course-generation-schemas";
import { parseScorm12Snapshot } from "../lib/scorm12/snapshot";

const sourceText = "Display determines how an element participates in the layout. Flexbox arranges children along a main axis.";
const sourceCode = ".container {\n  display: flex;\n  gap: 16px;\n}";
const explanation = "This CSS makes the container a flex container. Its children are arranged along the main axis with a gap of 16px between neighboring items.";

function response(blocks: object[]) {
  return new Response(JSON.stringify({ output_text: JSON.stringify({
    title: "Generated part", objective: "Explain the assigned source examples.",
    summary: "This part explains the layout concept and its original example in detail.", blocks,
  }) }));
}

function mockLearnJob(failed = false) {
  const identity = {
    ownerId: new Types.ObjectId("507f1f77bcf86cd799439011"),
    courseId: new Types.ObjectId("507f1f77bcf86cd799439012"),
    _id: new Types.ObjectId("507f1f77bcf86cd799439013"),
  };
  const input = courseGenerationInputSchema.parse({
    prompt: "", audience: "", level: "beginner", lessonCount: 2, template: "custom",
    includeImages: false, courseTitle: "", courseDescription: "",
  });
  const job = {
    ...identity, status: failed ? "failed" : "generatingLearn", failedStatus: failed ? "generatingLearn" : null,
    input, sourceFileName: "slides.pdf", sourceContentType: "application/pdf", sourceBytes: null,
    sourcePageCount: 2, extractionCursor: 2, learnCursor: 0, sourceLanguage: "English", summary: "CSS layout and flexbox examples.",
    completedWorkUnits: 3, totalWorkUnits: 5, errorMessage: failed ? "Course generation took too long." : null,
    leaseUntil: null as Date | null, expiresAt: new Date(Date.now() + 60_000),
  };
  const checkpoints = new Map<string, unknown>([
    ["inventoryBatch:0001-0002", {
      summary: job.summary,
      pages: [
        { pageNumber: 1, elements: [{ kind: "text", content: sourceText, visualKind: "other", visibleText: "", uncertainContent: false }] },
        { pageNumber: 2, elements: [{ kind: "code", content: sourceCode, visualKind: "other", visibleText: "", uncertainContent: false }] },
      ],
    }],
    ["plan:course", {
      title: "CSS Display and Flexbox", description: "Learn CSS display properties and practical flexbox layout.",
      objectives: ["Explain display and use flexbox."], sourceLanguage: "English", targetLanguage: "English",
      items: [{
        title: "Display and Flexbox Basics", focus: "Explain display and apply the flexbox example.",
        startPage: 1, endPage: 2, sourceElementIds: ["p1-e1", "p2-e1"],
        recommendedBlockTypes: ["text", "code"], interactionOpportunities: [],
      }],
    }],
  ]);
  vi.spyOn(GenerationJob, "findOneAndUpdate").mockImplementation((async () => ({ ...job, toObject: () => ({ ...job }) })) as never);
  vi.spyOn(GenerationJob, "findOne").mockImplementation((async () => job) as never);
  vi.spyOn(GenerationJob, "updateOne").mockImplementation((async (_filter: unknown, value: unknown) => {
    const update = value as { $set?: Record<string, unknown>; $inc?: Record<string, number> };
    Object.assign(job, update.$set);
    for (const [key, amount] of Object.entries(update.$inc ?? {}))
      (job as unknown as Record<string, number>)[key] += amount;
    return {};
  }) as never);
  vi.spyOn(GenerationCheckpoint, "findOne").mockImplementation(((filter: { stage: string; unitKey: string }) => ({
    lean: async () => checkpoints.has(`${filter.stage}:${filter.unitKey}`) ? { payload: checkpoints.get(`${filter.stage}:${filter.unitKey}`) } : null,
  })) as never);
  const save = vi.spyOn(GenerationCheckpoint, "updateOne").mockImplementation((async (filter: { stage: string; unitKey: string }, update: { $set?: { payload?: unknown }; $setOnInsert?: { payload?: unknown } }) => {
    const key = `${filter.stage}:${filter.unitKey}`;
    if (update.$set?.payload !== undefined) checkpoints.set(key, structuredClone(update.$set.payload));
    else if (!checkpoints.has(key)) checkpoints.set(key, structuredClone(update.$setOnInsert?.payload));
    return {};
  }) as never);
  vi.spyOn(GenerationCheckpoint, "updateMany").mockImplementation((async () => ({})) as never);
  const args = { ownerId: identity.ownerId.toString(), courseId: identity.courseId.toString(), jobId: identity._id.toString() };
  return { job, input, args, checkpoints, save };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Learn-stage timeout recovery", () => {
  it("continues a timeout in smaller saved parts and merges an editor/SCORM-compatible lesson", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = mockLearnJob();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException("Deadline", "TimeoutError"))
      .mockResolvedValueOnce(response([{ type: "text", title: "", body: sourceText, bullets: [], sourceElementIds: ["p1-e1"] }]))
      .mockResolvedValueOnce(response([{
        type: "code", title: "Flexbox example", body: sourceCode, sourceElementIds: ["p2-e1"],
        codeExample: { template: "midnight-explained-below", language: "css", explanation },
      }]));
    vi.stubGlobal("fetch", fetchMock);

    const split = await advanceSourceGenerationJob(store.args);
    expect(split).toMatchObject({ status: "generatingLearn", completedWorkUnits: 3, learnProgress: { completedParts: 0, totalParts: 2 } });
    expect(store.job.learnCursor).toBe(0);
    expect((await advanceSourceGenerationJob(store.args)).learnProgress).toEqual({ completedParts: 1, totalParts: 2 });
    expect(store.job.learnCursor).toBe(0);
    expect((await advanceSourceGenerationJob(store.args)).status).toBe("assembling");
    expect(store.job.learnCursor).toBe(1);
    const completed = await advanceSourceGenerationJob(store.args);
    expect(completed.status).toBe("completed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const draft = completed.course!;
    expect(draft.learningLessonCount).toBe(1);
    expect(draft.lessons[0].title).toBe("Display and Flexbox Basics");
    expect(draft.sourceCoverage?.complete).toBe(true);
    const html = draft.lessons[0].blocks.filter((block) => block.type === "richText").map((block) => block.data.html).join("\n");
    expect(html).toContain(sourceText);
    expect(html).toContain(sourceCode);
    expect(html).toContain(explanation);
    expect(parseScorm12Snapshot({ title: draft.title, description: draft.description, revision: 0, sections: draft.sections, lessons: draft.lessons }).lessons).toHaveLength(1);

    const request = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(request.reasoning.effort).toBe("low");
    expect(request.service_tier).toBeUndefined();
    const variants = request.text.format.schema.properties.blocks.items.anyOf;
    const textVariant = variants.find((variant: { properties: { type: { enum: string[] } } }) => variant.properties.type.enum[0] === "text");
    expect(textVariant.required).toEqual(["sourceElementIds", "type", "title", "body", "bullets"]);
    expect(Object.keys(textVariant.properties)).not.toContain("markers");
    for (const [filter] of store.save.mock.calls) {
      expect(filter).toMatchObject({ ownerId: store.job.ownerId, courseId: store.job.courseId, jobId: store.job._id });
    }
  });

  it("retries an older timed-out job in smaller parts immediately without re-extracting its source", async () => {
    const store = mockLearnJob(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const resumed = await startSourceGenerationJob({ ...store.args, input: store.input });
    expect(resumed.status).toBe("generatingLearn");
    expect(resumed.learnProgress).toEqual({ completedParts: 0, totalParts: 2 });
    expect(store.checkpoints.has("inventoryBatch:0001-0002")).toBe(true);
    expect(store.checkpoints.has("plan:course")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles the dialog's direct advance retry of an older failed job", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const store = mockLearnJob(true);
    const fetchMock = vi.fn().mockResolvedValue(response([{ type: "text", title: "", body: sourceText, bullets: [], sourceElementIds: ["p1-e1"] }]));
    vi.stubGlobal("fetch", fetchMock);
    const resumed = await advanceSourceGenerationJob(store.args);
    expect(resumed.status).toBe("generatingLearn");
    expect(resumed.learnProgress).toEqual({ completedParts: 1, totalParts: 2 });
    expect(store.job.learnCursor).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].body).toContain("Generate only Learn content item 1-1");
    expect(store.checkpoints.has("inventoryBatch:0001-0002")).toBe(true);
  });

  it("retains a validated first response when its source-coverage correction times out", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = mockLearnJob();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([{ type: "text", title: "", body: sourceText, bullets: [], sourceElementIds: ["p1-e1"] }]))
      .mockRejectedValueOnce(new DOMException("Deadline", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    expect((await advanceSourceGenerationJob(store.args)).status).toBe("assembling");
    const saved = store.checkpoints.get("learnItem:000") as { lesson: { blocks: { body: string }[] }; coverageIssues: string[] };
    expect(saved.lesson.blocks[0].body).toBe(sourceText);
    expect(saved.coverageIssues.some((issue) => issue.includes("correction timed out"))).toBe(true);
    expect(saved.coverageIssues.some((issue) => issue.includes("p2-e1"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
