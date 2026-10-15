import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { PDFDocument } from "pdf-lib";
import { Asset } from "../models/Asset";
import { GenerationCheckpoint } from "../models/GenerationCheckpoint";
import { GenerationJob } from "../models/GenerationJob";
import * as mediaStorage from "../lib/media/storage";
import {
  courseGenerationInputSchema,
  generatedBlockSeedSchema,
  generatedBlockTypeValues,
  defaultCourseGenerationModel,
  type CourseGenerationInput,
  generatedCourseSeedSchema,
  generatedSourceInventorySchema,
} from "../lib/ai/course-generation-schemas";
import {
  addSourceVisualBlocks,
  advanceSourceGenerationJob,
  cancelSourceGenerationJob,
  generateCourseDraft,
  generateSourceInventoryPageBatch,
  getLastCompletedSourceGenerationJob,
  summarizeCourseSource,
  buildFixedSourceRanges,
  splitGeneratedBlockSeeds,
} from "../lib/ai/course-generation";
import { blockTypes, lessonContentSchema } from "../lib/schemas/block";
import { parseScorm12Snapshot } from "../lib/scorm12/snapshot";
import type { CodeExampleTemplate, CodeLanguage } from "../lib/editor/code-example";

const input = {
  prompt: "Teach new support staff how to triage incoming customer requests.",
  audience: "New customer support hires",
  level: "beginner",
  lessonCount: 5,
  template: "custom",
  includeImages: true,
  courseTitle: "Support fundamentals",
  courseDescription: "A short onboarding course.",
};

type GenerationBlockType = (typeof generatedBlockTypeValues)[number];

function block(type: GenerationBlockType = "text"): {
  type: GenerationBlockType;
  title: string;
  body: string;
  codeExample: { template: CodeExampleTemplate; language: CodeLanguage; explanation: string } | null;
  bullets: string[];
  style: "tip";
  headingLevel: number;
  question: string;
  options: string[];
  correctOptionIndex: number;
  correctFeedback: string;
  incorrectFeedback: string;
  minLabel: string;
  maxLabel: string;
  steps: { title: string; body: string }[];
  cards: {
    front: string;
    back: string;
    frontImagePrompt: string;
    frontImageAlt: string;
    backImagePrompt: string;
    backImageAlt: string;
  }[];
  layout: "accordion" | "tabs";
  displayMode: "all";
  imageAlt: string;
  imagePrompt: string;
  imageLayout: "full" | "banner" | "text-left" | "text-right" | "text-overlay" | "card";
  imageTitle: string;
  imageBody: string;
  galleryImages: { src: string; alt: string }[];
  videoSrc: string;
  videoMimeType: "" | "video/mp4" | "video/webm";
  videoCaptions: string;
  dividerStyle: "line" | "space" | "continue";
  dividerLabel: string;
  dividerCompletionType: "none" | "completeAbove";
  markers: { label: string; description: string; x: number; y: number; color: string }[];
  markerColor: string;
  textColor: string;
  radarColor: string;
  chartType: "bar" | "column" | "line" | "donut" | "stacked";
  chartDescription: string;
  chartColor: string;
  chartFields: { label: string; value: number }[];
} {
  return {
    type,
    title: "Identify the request",
    body: "Read the full message before choosing a response.",
    codeExample: null,
    bullets: [],
    style: "tip",
    headingLevel: 2,
    question: "What should you do first?",
    options: ["Read the request", "Close the ticket"],
    correctOptionIndex: 0,
    correctFeedback: "Correct.",
    incorrectFeedback: "Review the lesson.",
    minLabel: "Not confident",
    maxLabel: "Very confident",
    steps: [],
    cards: [],
    layout: "accordion",
    displayMode: "all",
    imageAlt: "A support agent reviewing a request",
    imagePrompt: "A support agent reviewing a customer request at a computer",
    imageLayout: "full",
    imageTitle: "",
    imageBody: "",
    galleryImages: [],
    videoSrc: "",
    videoMimeType: "",
    videoCaptions: "",
    dividerStyle: "continue",
    dividerLabel: "Continue",
    dividerCompletionType: "none",
    markers: [],
    markerColor: "",
    textColor: "",
    radarColor: "",
    chartType: "bar",
    chartDescription: "",
    chartColor: "#4f46e5",
    chartFields: [],
  };
}

function assessmentQuestion(index: number) {
  return {
    question: `Question ${index + 1}?`,
    options: ["First answer", "Second answer"],
    correctOptionIndex: 0,
    correctFeedback: "Correct.",
    incorrectFeedback: "Review the lesson.",
  };
}

function seed(
  blocks = [block(), block()],
  templateFields: {
    lessonOverview?: { focus: string; slideRange: string }[];
    keyTerms?: { term: string; definition: string }[];
    preTest?: ReturnType<typeof assessmentQuestion>[];
    postTest?: ReturnType<typeof assessmentQuestion>[];
    lessonSummary?: string;
    nextLesson?: string;
  } = {},
  learningLessonCount = 5,
) {
  return {
    title: "Support fundamentals",
    description: "Learn to triage and respond to customer requests.",
    sections: [{
      title: "Triage",
      lessons: Array.from({ length: learningLessonCount }, (_, index) => ({
        title: index === 0 ? "Read the request" : `Triage lesson ${index + 1}`,
        objective: `Learn triage skill ${index + 1}.`,
        blocks: index === 0 ? blocks : [block(), block()],
      })),
    }],
    lessonOverview: [],
    keyTerms: [],
    preTest: [],
    postTest: [],
    lessonSummary: "This course explains how to read a customer request, identify its key details, and choose a suitable next action. It connects request triage with urgency, impact, prioritization, and clear communication. Examples and practice activities show how each step applies to real support cases, helping learners move from understanding a request to selecting and explaining an appropriate response.",
    nextLesson: "Continue with advanced customer support scenarios.",
    ...templateFields,
  };
}

function providerResponse(
  blocks = [block(), block()],
  templateFields: Parameters<typeof seed>[1] = {},
  learningLessonCount = 5,
) {
  return new Response(JSON.stringify({
    output_text: JSON.stringify(seed(blocks, templateFields, learningLessonCount)),
  }), { status: 200 });
}

function jsonProviderResponse(value: unknown) {
  return new Response(JSON.stringify({ output_text: JSON.stringify(value) }), { status: 200 });
}

async function blankPdf(pageCount: number) {
  const pdf = await PDFDocument.create();
  for (let page = 0; page < pageCount; page += 1) pdf.addPage([612, 792]);
  return Buffer.from(await pdf.save());
}

type TestSourceElement = {
  kind: "text" | "code" | "visual";
  content: string;
  visualKind: "diagram" | "chart" | "table" | "screenshot" | "photo" | "illustration" | "other";
  visibleText: string;
  uncertainContent: boolean;
};

function sourcePageBatchResponse(
  firstPage: number,
  pageCount: number,
  elementsByPage: Record<number, TestSourceElement[]> = {},
) {
  const batchPageCount = Math.min(5, pageCount - firstPage + 1);
  return jsonProviderResponse({
    summary: `Pages ${firstPage}-${firstPage + batchPageCount - 1} cover the source topics and examples.`,
    pages: Array.from({ length: batchPageCount }, (_, index) => {
      const pageNumber = firstPage + index;
      return {
        pageNumber,
        elements: elementsByPage[pageNumber] ?? [{
          kind: "text" as const,
          content: `Slide ${pageNumber} contains an important explanation and example.`,
          visualKind: "other" as const,
          visibleText: "",
          uncertainContent: false,
        }],
      };
    }),
  });
}

function sourceSummaryProviderResponse(pageCount: number) {
  return jsonProviderResponse({
    summary: `The ${pageCount}-page source explains its subject through definitions, code examples, and practical instructions.`,
    sourceLanguage: "English",
  });
}

function sourcePlanProviderResponse(ranges: { startPage: number; endPage: number }[]) {
  return jsonProviderResponse({
    title: "Source course",
    description: "A detailed course based on the uploaded instructional material.",
    objectives: ["Explain the source concepts", "Apply the supplied examples"],
    sourceLanguage: "English",
    targetLanguage: "English",
    items: ranges.map((range, index) => ({
      ...range,
      title: `Source topic ${index + 1}`,
      focus: `Learn the concepts from pages ${range.startPage}-${range.endPage}.`,
      recommendedBlockTypes: ["text", "code"],
      interactionOpportunities: ["Practice applying the page examples."],
    })),
  });
}

function preActivitiesProviderResponse() {
  return jsonProviderResponse({
    keyTerms: Array.from({ length: 5 }, (_, index) => ({ term: `Term ${index + 1}`, definition: `Definition for term ${index + 1}.` })),
    preTest: Array.from({ length: 3 }, (_, index) => assessmentQuestion(index)),
  });
}

function postActivitiesProviderResponse(postTestCount = 5) {
  return jsonProviderResponse({
    postTest: Array.from({ length: postTestCount }, (_, index) => assessmentQuestion(index + 3)),
    lessonSummary: "This course explains the source concepts in detail and connects each idea to the examples, code, and procedures in the supplied material. Learners first build a foundation in the main terms, then see how each example applies those ideas in realistic work. The explanations preserve the source details and show how the separate topics fit together. Learners finish with a clear sequence for applying the material independently.",
    nextLesson: "Applying the Concepts in a New Project",
  });
}

function sourceLearnProviderResponse(
  ids: string[],
  blocks: ReturnType<typeof block>[] = [block()],
  title = "Source topic lesson",
  sourceIdsPerBlock?: string[][],
) {
  const assignedIds = new Set(ids);
  const generatedBlocks = blocks.map((value, index) => ({
    ...value,
    sourceElementIds: sourceIdsPerBlock?.[index] ?? (index === 0 ? [...assignedIds] : []),
  }));
  return jsonProviderResponse({
    title,
    objective: "Explain and apply all assigned source material.",
    summary: `This lesson explains ${title}, preserves its examples, and shows learners how to apply the source procedures.`,
    blocks: generatedBlocks,
  });
}

function stagedSourceResponses(
  pageCount: number,
  ranges: { startPage: number; endPage: number }[],
  options: {
    template?: CourseGenerationInput["template"];
    elementsByPage?: Record<number, TestSourceElement[]>;
    learn?: (index: number, ids: string[]) => Response;
    planResponse?: Response;
    postResponse?: Response;
  } = {},
) {
  const responses: Response[] = [];
  for (let firstPage = 1; firstPage <= pageCount; firstPage += 5)
    responses.push(sourcePageBatchResponse(firstPage, pageCount, options.elementsByPage));
  responses.push(sourceSummaryProviderResponse(pageCount));
  responses.push(options.planResponse ?? sourcePlanProviderResponse(ranges));
  if (options.template === "preLearnPost") responses.push(preActivitiesProviderResponse());
  for (const [index, range] of ranges.entries()) {
    const ids = Array.from({ length: range.endPage - range.startPage + 1 }, (_, pageIndex) => {
      const pageNumber = range.startPage + pageIndex;
      const elements = options.elementsByPage?.[pageNumber] ?? [];
      return elements.length
        ? elements.map((_, elementIndex) => `p${pageNumber}-e${elementIndex + 1}`)
        : [`p${pageNumber}-e1`];
    }).flat();
    responses.push(options.learn?.(index, ids) ?? sourceLearnProviderResponse(ids));
  }
  if (options.template === "preLearnPost")
    responses.push(options.postResponse ?? postActivitiesProviderResponse());
  return responses;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AI course generation contracts", () => {
  it.each([false, true])("cancels only an owned unfinished job and preserves a racing completed draft: %s", async (completedDuringCancel) => {
    const ownerId = "507f1f77bcf86cd799439011";
    const courseId = "507f1f77bcf86cd799439012";
    const jobId = "507f1f77bcf86cd799439013";
    const job = new GenerationJob({ _id: jobId, ownerId, courseId, status: "planning", sourceFileName: "slides.pdf" });
    const find = vi.spyOn(GenerationJob, "findOne").mockImplementation((async () => job) as never);
    const update = vi.spyOn(GenerationJob, "updateOne").mockImplementation((async () => {
      job.status = completedDuringCancel ? "completed" : "cancelled";
      return { matchedCount: completedDuringCancel ? 0 : 1 };
    }) as never);
    const remove = vi.spyOn(GenerationCheckpoint, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);
    const savedCourse = { title: "Completed draft", sections: [], lessons: [] };
    vi.spyOn(GenerationCheckpoint, "findOne").mockReturnValue({ lean: async () => ({ payload: savedCourse }) } as never);

    const result = await cancelSourceGenerationJob({ ownerId, courseId, jobId });

    expect(find).toHaveBeenCalledWith({ _id: jobId, ownerId, courseId });
    expect(update).toHaveBeenCalledWith(
      { _id: job._id, ownerId, courseId, status: { $ne: "completed" } },
      { $set: { status: "cancelled", sourceBytes: null, errorMessage: null, leaseUntil: null } },
    );
    if (completedDuringCancel) {
      expect(remove).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "completed", course: savedCourse });
    } else {
      expect(remove).toHaveBeenCalledWith({ jobId: job._id, ownerId, courseId });
      expect(result.status).toBe("cancelled");
    }
  });

  it("does not change or delete an already completed job when cancelling", async () => {
    const ownerId = "507f1f77bcf86cd799439011";
    const courseId = "507f1f77bcf86cd799439012";
    const jobId = "507f1f77bcf86cd799439013";
    vi.spyOn(GenerationJob, "findOne").mockResolvedValue(new GenerationJob({ _id: jobId, ownerId, courseId, status: "completed", sourceFileName: "slides.pdf" }));
    const update = vi.spyOn(GenerationJob, "updateOne");
    const remove = vi.spyOn(GenerationCheckpoint, "deleteMany");
    vi.spyOn(GenerationCheckpoint, "findOne").mockReturnValue({ lean: async () => ({ payload: { title: "Saved draft" } }) } as never);
    expect(await cancelSourceGenerationJob({ ownerId, courseId, jobId })).toMatchObject({ status: "completed", course: { title: "Saved draft" } });
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("rejects cancellation when the owned job does not exist without changing data", async () => {
    vi.spyOn(GenerationJob, "findOne").mockResolvedValue(null);
    const update = vi.spyOn(GenerationJob, "updateOne");
    const remove = vi.spyOn(GenerationCheckpoint, "deleteMany");
    await expect(cancelSourceGenerationJob({ ownerId: "507f1f77bcf86cd799439011", courseId: "507f1f77bcf86cd799439012", jobId: "507f1f77bcf86cd799439013" })).rejects.toMatchObject({ message: "Generation job was not found.", status: 404 });
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("cleans checkpoints written by an in-flight source stage after cancellation", async () => {
    const ownerId = "507f1f77bcf86cd799439011";
    const courseId = "507f1f77bcf86cd799439012";
    const jobId = "507f1f77bcf86cd799439013";
    const job = new GenerationJob({
      _id: jobId, ownerId, courseId, status: "indexing", sourceFileName: "slides.pdf",
      sourceContentType: "application/pdf", sourceBytes: await blankPdf(1),
      input: courseGenerationInputSchema.parse(input), expiresAt: new Date(Date.now() + 60_000),
    });
    vi.spyOn(GenerationJob, "findOneAndUpdate").mockResolvedValue(job);
    vi.spyOn(GenerationJob, "findOne").mockResolvedValue(job);
    vi.spyOn(GenerationJob, "updateOne").mockImplementation((async (filter: { status?: string }, update: { $set: Record<string, unknown> }) => {
      if (!filter.status || filter.status === job.status) Object.assign(job, update.$set);
      return {};
    }) as never);
    const checkpointWrite = vi.spyOn(GenerationCheckpoint, "updateOne").mockImplementation((async () => {
      // Cancellation completes while the already-running index stage is writing its output.
      job.status = "cancelled";
      return {};
    }) as never);
    vi.spyOn(GenerationCheckpoint, "updateMany").mockResolvedValue({} as never);
    const remove = vi.spyOn(GenerationCheckpoint, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await advanceSourceGenerationJob({ ownerId, courseId, jobId })).toMatchObject({ status: "cancelled" });
    expect(checkpointWrite).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith({ jobId: job._id, ownerId, courseId });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recovers the latest unexpired completed draft scoped to its owner and course", async () => {
    const ownerId = "507f1f77bcf86cd799439011";
    const courseId = "507f1f77bcf86cd799439012";
    const jobId = new Types.ObjectId();
    const draft = { title: "Saved source draft", sections: [], lessons: [] };
    const sort = vi.fn().mockResolvedValue({
      _id: jobId,
      ownerId: new Types.ObjectId(ownerId),
      courseId: new Types.ObjectId(courseId),
      status: "completed",
      sourceFileName: "slides.pdf",
      sourcePageCount: 20,
      sourceLanguage: "English",
      summary: "The source summary.",
      completedWorkUnits: 12,
      totalWorkUnits: 12,
      errorMessage: null,
    });
    const findJob = vi.spyOn(GenerationJob, "findOne").mockReturnValue({ sort } as never);
    const findCheckpoint = vi.spyOn(GenerationCheckpoint, "findOne").mockReturnValue({
      lean: vi.fn().mockResolvedValue({ payload: draft }),
    } as never);

    const restored = await getLastCompletedSourceGenerationJob({ ownerId, courseId });

    expect(findJob).toHaveBeenCalledWith({ ownerId, courseId, status: "completed", expiresAt: { $gt: expect.any(Date) } });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(findCheckpoint).toHaveBeenCalledWith({
      jobId,
      ownerId: new Types.ObjectId(ownerId),
      courseId: new Types.ObjectId(courseId),
      stage: "result",
      unitKey: "course",
    });
    expect(restored).toMatchObject({ jobId: jobId.toString(), status: "completed", course: draft });
  });

  it("keeps the AI block catalog synchronized with every native project block type", () => {
    expect(generatedBlockTypeValues).toEqual([...blockTypes, "text", "code"]);
  });

  it("validates the project-specific fields for rich interactive block intents", () => {
    expect(generatedBlockSeedSchema.safeParse({
      ...block("labeledGraphic"),
      markers: [{ label: "Input", description: "Where information enters.", x: 20, y: 40, color: "" }],
    }).success).toBe(true);
    expect(generatedBlockSeedSchema.safeParse({
      ...block("flipCard"),
      cards: [{
        front: "",
        back: "Definition",
        frontImagePrompt: "A clear diagram of the term.",
        frontImageAlt: "Diagram illustrating the term",
        backImagePrompt: "",
        backImageAlt: "",
      }],
    }).success).toBe(true);
    expect(generatedBlockSeedSchema.safeParse({
      ...block("chart"),
      chartFields: [{ label: "Category A", value: 3 }],
    }).success).toBe(true);
    expect(generatedBlockSeedSchema.safeParse({
      ...block("video"),
      videoSrc: "not-a-video-url",
    }).success).toBe(false);
    expect(generatedBlockSeedSchema.safeParse({
      ...block("accordion"),
      steps: [{ title: "Only one", body: "An accordion needs at least two items." }],
    }).success).toBe(false);
    expect(generatedBlockSeedSchema.safeParse({
      ...block("flipCard"),
      cards: [{ front: "", back: "Answer", frontImagePrompt: "", frontImageAlt: "", backImagePrompt: "", backImageAlt: "" }],
    }).success).toBe(false);
  });

  it("accepts bounded prompt generation settings", () => {
    expect(courseGenerationInputSchema.parse(input)).toMatchObject({
      lessonCount: 5,
      includeImages: true,
      level: "beginner",
      learnGroupingMode: "smart",
      slidesPerContent: 5,
      targetLanguage: "English",
      contentDepth: "detailed",
      interactivity: "high",
      postTestCount: 5,
    });
    expect(courseGenerationInputSchema.safeParse({ ...input, targetLanguage: "Khmer" }).success).toBe(true);
    expect(courseGenerationInputSchema.safeParse({ ...input, targetLanguage: "French" }).success).toBe(false);
    expect(courseGenerationInputSchema.safeParse({ ...input, slidesPerContent: 501 }).success).toBe(false);
    expect(defaultCourseGenerationModel).toBe("gpt-6-luna");
  });

  it("computes fixed page ranges in application code, including a one-page final range", () => {
    expect(buildFixedSourceRanges(36, 5)).toEqual([
      { startPage: 1, endPage: 5 },
      { startPage: 6, endPage: 10 },
      { startPage: 11, endPage: 15 },
      { startPage: 16, endPage: 20 },
      { startPage: 21, endPage: 25 },
      { startPage: 26, endPage: 30 },
      { startPage: 31, endPage: 35 },
      { startPage: 36, endPage: 36 },
    ]);
  });

  it("splits interactions beyond native limits without losing items or order", () => {
    const sourceElementIds = ["p2-e1"];
    const longSteps = Array.from({ length: 21 }, (_, index) => ({ title: `Step ${index + 1}`, body: `Body ${index + 1}` }));
    const longAccordion = Array.from({ length: 13 }, (_, index) => ({ title: `Topic ${index + 1}`, body: `Detail ${index + 1}` }));
    const longCards = Array.from({ length: 31 }, (_, index) => ({
      front: `Term ${index + 1}`,
      back: `Definition ${index + 1}`,
      frontImagePrompt: "",
      frontImageAlt: "",
      backImagePrompt: "",
      backImageAlt: "",
    }));
    const longMarkers = Array.from({ length: 21 }, (_, index) => ({
      label: `Marker ${index + 1}`,
      description: `Description ${index + 1}`,
      x: index,
      y: index,
      color: "",
    }));
    const longFields = Array.from({ length: 41 }, (_, index) => ({ label: `Value ${index + 1}`, value: index }));
    const split = splitGeneratedBlockSeeds([
      { ...block("processSteps"), sourceElementIds, steps: longSteps },
      { ...block("accordion"), sourceElementIds, steps: longAccordion },
      { ...block("flipCard"), sourceElementIds, cards: longCards },
      { ...block("labeledGraphic"), sourceElementIds, markers: longMarkers },
      { ...block("chart"), sourceElementIds, chartFields: longFields },
    ]);
    const collect = (type: GenerationBlockType) => split.filter((item) => item.type === type);

    expect(collect("processSteps").map((item) => item.steps.length)).toEqual([19, 2]);
    expect(collect("processSteps").flatMap((item) => item.steps.map((step) => step.title))).toEqual(longSteps.map((step) => step.title));
    expect(collect("accordion").map((item) => item.steps.length)).toEqual([11, 2]);
    expect(collect("accordion").flatMap((item) => item.steps.map((step) => step.title))).toEqual(longAccordion.map((step) => step.title));
    expect(collect("flipCard").map((item) => item.cards.length)).toEqual([30, 1]);
    expect(collect("flipCard").flatMap((item) => item.cards.map((card) => card.front))).toEqual(longCards.map((card) => card.front));
    expect(collect("labeledGraphic")[0]?.markers).toHaveLength(20);
    expect(collect("text").some((item) => item.body.includes("Marker 21: Description 21"))).toBe(true);
    expect(collect("chart").map((item) => item.chartFields.length)).toEqual([20, 20, 1]);
    expect(collect("chart").flatMap((item) => item.chartFields.map((field) => field.label))).toEqual(longFields.map((field) => field.label));
  });

  it("preserves paragraph content returned inside a heading and avoids an adjacent repeated title", () => {
    const [heading, paragraph] = splitGeneratedBlockSeeds([
      generatedBlockSeedSchema.parse({ ...block("heading"), sourceElementIds: ["p1-e1"], title: "Flexbox", body: "Flexbox arranges items in a row or column." }),
    ]);
    expect(heading).toMatchObject({ type: "heading", title: "Flexbox", body: "" });
    expect(paragraph).toMatchObject({ type: "text", title: "", body: "Flexbox arranges items in a row or column.", sourceElementIds: ["p1-e1"] });
    const normalized = splitGeneratedBlockSeeds([
      generatedBlockSeedSchema.parse({ ...block("heading"), title: "Flexbox", body: "" }),
      generatedBlockSeedSchema.parse({ ...block("text"), title: "Flexbox", body: "The container controls the main axis." }),
    ]);
    expect(normalized[1]).toMatchObject({ title: "", body: "The container controls the main axis." });
  });

  it("generates a styled code example with its full explanation and source coverage intact", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const sourceCode = '<h1 class="title">Hello</h1>\n<p>Welcome to HTML.</p>';
    const explanation = "The heading displays Hello and the paragraph displays Welcome to HTML below it. The title class lets CSS style the heading.";
    const responses = stagedSourceResponses(1, [{ startPage: 1, endPage: 1 }], {
      elementsByPage: { 1: [
        { kind: "code", content: sourceCode, visualKind: "other", visibleText: "", uncertainContent: false },
        { kind: "text", content: explanation, visualKind: "other", visibleText: "", uncertainContent: false },
      ] },
      learn: (_index, ids) => sourceLearnProviderResponse(ids, [{
        ...block("code"), title: "HTML example", body: sourceCode,
        codeExample: { template: "paper-explained-above", language: "html", explanation },
      }]),
    });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);
    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011", courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes: await blankPdf(1) },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(course.sourceCoverage?.complete).toBe(true);
    const codeBlock = course.lessons[0].blocks.find((block) => block.type === "richText" && block.data.html.includes('data-code-theme="paper"'));
    if (codeBlock?.type !== "richText") throw new Error("Expected a styled code example");
    expect(codeBlock.data.html).toContain(`<p>${explanation}</p>`);
    expect(codeBlock.data.html.indexOf(`<p>${explanation}</p>`)).toBeLessThan(codeBlock.data.html.indexOf("<pre"));
    expect(codeBlock.data.html).toContain('&lt;h1 class=&quot;title&quot;&gt;Hello&lt;/h1&gt;\n&lt;p&gt;Welcome to HTML.&lt;/p&gt;');
    expect(parseScorm12Snapshot({ title: course.title, description: course.description, revision: 0, sections: course.sections, lessons: course.lessons }).lessons).toHaveLength(1);
  });

  it("splits long code at line boundaries and keeps the concatenated source unchanged", () => {
    const code = Array.from({ length: 2_000 }, (_, index) => `.class-${index} { display: flex; }`).join("\n");
    const split = splitGeneratedBlockSeeds([{ ...block("code"), body: code, sourceElementIds: ["p1-e2"] }]);
    expect(split.length).toBeGreaterThan(1);
    expect(split.every((item) => item.type === "code" && item.body.length <= 12_000)).toBe(true);
    expect(split.map((item) => item.body).join("")).toBe(code);
  });

  it("uses GPT-6 Luna when no course writing model is selected", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_TEXT_MODEL", "");
    const fetchMock = vi.fn().mockResolvedValue(providerResponse());
    vi.stubGlobal("fetch", fetchMock);

    await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
      max_output_tokens: number;
    };
    expect(requestBody.model).toBe("gpt-6-luna");
    const promptAndSchema = fetchMock.mock.calls[0][1].body as string;
    expect(promptAndSchema).toContain("Course content blocks supported by this project");
    expect(promptAndSchema).toContain("displayMode all");
    expect(promptAndSchema).toContain("chartFields");
    expect(promptAndSchema).toContain("SOURCE COMPLETENESS RULES");
    expect(promptAndSchema).toContain("Preserve code exactly as shown");
    expect(requestBody.max_output_tokens).toBe(64_000);
    for (const type of blockTypes) expect(promptAndSchema).toContain(type);
  });

  it("adds custom course description, summary, and next lesson to learner-facing content", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse(
      [block(), block()],
      {
        lessonSummary: "Learners practiced reading a request and choosing the next action.",
        nextLesson: "Continue with prioritizing requests by urgency.",
      },
      2,
    )));

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, lessonCount: 2 }),
    });

    const firstLesson = course.lessons[0];
    const lastLesson = course.lessons.at(-1);
    expect(firstLesson?.blocks[0]?.type === "richText" && firstLesson.blocks[0].data.html)
      .toContain("Course description");
    expect(lastLesson?.blocks.some((contentBlock) =>
      contentBlock.type === "richText" && contentBlock.data.html.includes("Lesson summary"),
    )).toBe(true);
    expect(lastLesson?.blocks.some((contentBlock) =>
      contentBlock.type === "richText" && contentBlock.data.html.includes("Next lesson"),
    )).toBe(true);
    expect(course.learningLessonCount).toBe(2);
  });

  it("requires contiguous source page ranges for every generated lesson", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const responses = [
      sourcePageBatchResponse(1, 10),
      sourcePageBatchResponse(6, 10),
      sourceSummaryProviderResponse(10),
      sourcePlanProviderResponse([{ startPage: 1, endPage: 3 }, { startPage: 5, endPage: 10 }]),
      sourcePlanProviderResponse([{ startPage: 1, endPage: 3 }, { startPage: 5, endPage: 10 }]),
    ];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(responses.shift())));
    const bytes = await blankPdf(10);

    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    })).rejects.toThrow("valid source page plan");
  });

  it("uses the selected OpenAI model for course writing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(providerResponse());
    vi.stubGlobal("fetch", fetchMock);

    await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, model: "gpt-6.1-sol" }),
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { model: string };
    expect(requestBody.model).toBe("gpt-6.1-sol");
    expect(courseGenerationInputSchema.safeParse({ ...input, model: "unapproved-model" }).success).toBe(false);
  });

  it("retries once when the provider returns invalid structured JSON", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: "{invalid json" }), { status: 200 }))
      .mockResolvedValueOnce(providerResponse());
    vi.stubGlobal("fetch", fetchMock);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false }),
    });

    expect(course.lessons).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).toContain("previous response was not valid JSON");
  });

  it("corrects missing source pages within the current batch", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonProviderResponse({ summary: "The source.", pages: [] }))
      .mockResolvedValueOnce(sourcePageBatchResponse(1, 1));
    vi.stubGlobal("fetch", fetchMock);
    const source = await generateSourceInventoryPageBatch(
      courseGenerationInputSchema.parse(input),
      defaultCourseGenerationModel,
      { name: "slides.pdf", contentType: "application/pdf", bytes: await blankPdf(1) },
      [{ pageNumber: 1, text: "Original source description." }],
      1,
    );
    expect(source.pages.map((page) => page.pageNumber)).toEqual([1]);
    expect(source.pages[0].elements.some((element) => element.content === "Original source description.")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).toContain("CORRECTION REQUIRED");
    const schema = JSON.parse(fetchMock.mock.calls[0][1].body).text.format.schema;
    expect(schema.properties.pages).toMatchObject({ minItems: 1, maxItems: 1 });
  });

  it.each([429, 503])("recovers from a temporary provider HTTP %i without a JSON correction prompt", async (status) => {
    vi.useFakeTimers();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: status === 429 ? "rate_limit_exceeded" : "server_error" } }), { status, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(providerResponse());
    vi.stubGlobal("fetch", fetchMock);
    const generated = generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false }),
    });
    const assertion = expect(generated).resolves.toMatchObject({ learningLessonCount: 5 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).not.toContain("previous response was not valid JSON");
  });

  it.each([
    [429, "insufficient_quota", "billing or usage limit"],
    [401, "invalid_api_key", "rejected the configured API key"],
    [400, "invalid_request_error", "rejected the generation request"],
  ])("does not retry permanent provider error %s/%s", async (status, code, message) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code } }), { status }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
    })).rejects.toThrow(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after two temporary server failures", async () => {
    vi.useFakeTimers();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("Service unavailable", { status: 503 })));
    vi.stubGlobal("fetch", fetchMock);
    const generated = generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
    });
    const assertion = expect(generated).rejects.toThrow("AI course generation failed");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not automatically repeat a truncated expensive generation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
    })).rejects.toThrow("output limit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the original stage deadline when correcting content", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => {
        now += 125_000;
        return Promise.resolve(providerResponse());
      })
      .mockResolvedValueOnce(providerResponse([block()], {}, 8));
    vi.stubGlobal("fetch", fetchMock);
    await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, lessonCount: 8, includeImages: false }),
    });
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([200_000, 75_000]);
  });

  it("shares the two-call allowance between JSON repair and course validation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: "{invalid json" })))
      .mockResolvedValueOnce(providerResponse());
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, lessonCount: 8 }),
    })).rejects.toThrow("requested number of lessons");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("repairs a wrong lesson count and sends exact template counts in the provider schema", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fields = {
      lessonOverview: Array.from({ length: 2 }, (_, index) => ({ focus: `Learning focus ${index + 1}`, slideRange: "" })),
      keyTerms: Array.from({ length: 5 }, (_, index) => ({ term: `Term ${index + 1}`, definition: "An important concept." })),
      preTest: Array.from({ length: 3 }, (_, index) => assessmentQuestion(index)),
      postTest: Array.from({ length: 7 }, (_, index) => assessmentQuestion(index)),
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse([block()], { ...fields, lessonOverview: fields.lessonOverview.slice(0, 1) }, 1))
      .mockResolvedValueOnce(providerResponse([block()], fields, 2));
    vi.stubGlobal("fetch", fetchMock);
    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, template: "preLearnPost", lessonCount: 2, postTestCount: 7, includeImages: false }),
    });
    expect(course.learningLessonCount).toBe(2);
    expect(course.sections.map((section) => section.title)).toEqual(["Pre activities", "Learn", "Post activities"]);
    const overview = course.lessons.find((lesson) => lesson.title === "Lesson overview")?.blocks[0];
    expect(overview?.type).toBe("richText");
    if (overview?.type === "richText") {
      expect(overview.data.html).toContain("<li><p><strong>Read the request</strong></p><p>Learning focus 1</p></li>");
      expect(overview.data.html).not.toContain("<table");
      expect(overview.data.html).not.toContain("Source pages:");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).toContain("expected 2, received 1");
    const schema = JSON.parse(fetchMock.mock.calls[0][1].body).text.format.schema;
    expect(schema.properties.sections).toMatchObject({ minItems: 1, maxItems: 1 });
    expect(schema.properties.sections.items.properties.lessons).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(schema.properties.postTest).toMatchObject({ minItems: 7, maxItems: 7 });
    expect(schema.properties.preTest.items.properties.options).toMatchObject({ minItems: 2, maxItems: 5 });
  });

  it("builds the Pre / Learn / Post template using existing course blocks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const ranges = Array.from({ length: 4 }, (_, index) => ({ startPage: index * 5 + 1, endPage: index * 5 + 5 }));
    const responses = stagedSourceResponses(20, ranges, { template: "preLearnPost" });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await blankPdf(20);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, lessonCount: 2, template: "preLearnPost" }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    });

    expect(course.sections.map((section) => section.title)).toEqual(["Pre activities", "Learn", "Post activities"]);
    expect(course.learningLessonCount).toBe(4);
    expect(course.lessons.filter((lesson) => lesson.sectionId === course.sections[0].id)).toHaveLength(4);
    expect(course.lessons.filter((lesson) => lesson.sectionId === course.sections[2].id)).toHaveLength(3);
    const overview = course.lessons.find((lesson) => lesson.title === "Lesson overview");
    const overviewBlock = overview?.blocks[0];
    expect(overviewBlock?.type).toBe("richText");
    if (overviewBlock?.type === "richText") {
      expect(overviewBlock.data.html).toMatch(/^<ul><li><p><strong>.+<\/strong><\/p><p>Learn the concepts from pages 1-5\.<\/p><p>Source pages: 1-5<\/p><\/li>/);
      expect(overviewBlock.data.html.match(/<li>/g)).toHaveLength(4);
      expect(overviewBlock.data.html).not.toContain("<table");
    }
    const keywords = course.lessons.find((lesson) => lesson.title === "Keyword");
    expect(keywords?.blocks[0].type === "flipCard" && keywords.blocks[0].data.cards).toHaveLength(5);
    expect(course.lessons.find((lesson) => lesson.title === "Pre-test")).toMatchObject({ lessonType: "quiz", quizQuestions: expect.arrayContaining([expect.any(Object)]) });
    expect(course.lessons.find((lesson) => lesson.title === "Pre-test")?.quizQuestions).toHaveLength(3);
    const preTest = course.lessons.find((lesson) => lesson.title === "Pre-test");
    expect(preTest?.quizQuestions[0].correctChoiceIds).toEqual([
      preTest?.quizQuestions[0].choices[0].id,
    ]);
    expect(course.lessons.find((lesson) => lesson.title === "Post-test")).toMatchObject({ lessonType: "quiz" });
    expect(course.lessons.find((lesson) => lesson.sectionId === course.sections[2]?.id && lesson.lessonType === "quiz")?.quizQuestions).toHaveLength(5);
    const summaryLesson = course.lessons.find((lesson) => lesson.title === "Lesson summary");
    expect(summaryLesson?.blocks.some((contentBlock) =>
      contentBlock.type === "richText" && contentBlock.data.html.includes("This course explains the source concepts in detail"),
    )).toBe(true);
    const nextLesson = course.lessons.find((lesson) => lesson.title === "Next lesson");
    expect(nextLesson?.blocks.some((contentBlock) =>
      contentBlock.type === "richText" && contentBlock.data.html.includes("Applying the Concepts in a New Project"),
    )).toBe(true);
    const scormSnapshot = parseScorm12Snapshot({
      title: course.title,
      description: course.description,
      revision: 0,
      sections: course.sections,
      lessons: course.lessons,
    });
    expect(scormSnapshot.sections).toHaveLength(3);
    expect(scormSnapshot.lessons).toHaveLength(course.lessons.length);
  });

  it("groups source pages into exact fixed-size Learn items", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const ranges = Array.from({ length: 4 }, (_, index) => ({ startPage: index * 5 + 1, endPage: index * 5 + 5 }));
    const responses = stagedSourceResponses(20, ranges, { template: "preLearnPost" });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await blankPdf(20);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({
        ...input,
        template: "preLearnPost",
        learnGroupingMode: "fixed",
        slidesPerContent: 5,
      }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    });

    expect(course.sections.map((section) => section.title)).toEqual(["Pre activities", "Learn", "Post activities"]);
    expect(course.learningLessonCount).toBe(4);
    expect(fetchMock.mock.calls[5][1].body).toContain("Fixed grouping is already calculated by the application");
  });

  it("generates the 36-page fixed-mode course in eight independent Learn calls with complete page coverage", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const ranges = buildFixedSourceRanges(36, 5);
    const responses = stagedSourceResponses(36, ranges, { template: "preLearnPost" });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await blankPdf(36);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({
        ...input,
        template: "preLearnPost",
        learnGroupingMode: "fixed",
        slidesPerContent: 5,
        targetLanguage: "Khmer",
        contentDepth: "detailed",
        interactivity: "high",
        includeImages: false,
      }),
      sourceFile: { name: "TP-4-Session-1.pdf", contentType: "application/pdf", bytes },
    });

    expect(course.sections.map((section) => section.title)).toEqual([
      "សកម្មភាពមុនរៀន",
      "មេរៀន",
      "សកម្មភាពក្រោយរៀន",
    ]);
    expect(course.learningLessonCount).toBe(8);
    expect(course.lessons).toHaveLength(15);
    expect(course.lessons.filter((lesson) => lesson.sectionId === course.sections[1]?.id)).toHaveLength(8);
    expect(course.lessons.filter((lesson) => lesson.sectionId === course.sections[0]?.id)).toHaveLength(4);
    expect(course.lessons.filter((lesson) => lesson.sectionId === course.sections[2]?.id)).toHaveLength(3);
    expect(course.lessons.find((lesson) =>
      lesson.sectionId === course.sections[2]?.id && lesson.lessonType === "quiz",
    )?.quizQuestions).toHaveLength(5);
    const overview = course.lessons.find((lesson) => lesson.title === "ទិដ្ឋភាពទូទៅនៃមេរៀន");
    expect(overview?.blocks[0]?.type === "richText" && overview.blocks[0].data.html).toContain("36-36");
    expect(course.sourceCoverage?.complete).toBe(false);
    expect(course.sourceCoverage?.items).toHaveLength(36);
    expect(course.sourceCoverage?.items.every((item) => item.generatedLessonId && item.generatedBlockId)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(20);
    const learnCalls = fetchMock.mock.calls.slice(11, 19).map(([, call]) => JSON.parse(call.body as string));
    expect(learnCalls).toHaveLength(8);
    expect(learnCalls.at(-1).input[1].content[0].text).toContain("Generate only Learn content item 36-36");
    expect(learnCalls.every((call) => call.input[1].content[0].text.includes("Write learner-facing content in Khmer"))).toBe(true);
  });

  it("accepts smart topic boundaries while validating exact source-page coverage", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const ranges = [
      { startPage: 1, endPage: 3 },
      { startPage: 4, endPage: 8 },
      { startPage: 9, endPage: 10 },
    ];
    const responses = stagedSourceResponses(10, ranges);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(responses.shift())));
    const bytes = await blankPdf(10);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false, learnGroupingMode: "smart" }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    });

    expect(course.learningLessonCount).toBe(3);
    expect(course.sourceCoverage?.complete).toBe(false);
    expect(course.sourceCoverage?.items.every((item) => item.generatedLessonId && item.generatedBlockId)).toBe(true);
  });

  it("resumes a failed Learn stage from its saved checkpoint without another provider call", async () => {
    const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
    const courseId = new Types.ObjectId("507f1f77bcf86cd799439012");
    const jobId = new Types.ObjectId("507f1f77bcf86cd799439013");
    const jobRecord: {
      _id: Types.ObjectId;
      ownerId: Types.ObjectId;
      courseId: Types.ObjectId;
      status: string;
      failedStatus: string | null;
      input: CourseGenerationInput;
      sourceFileName: string;
      sourceContentType: "application/pdf";
      sourceBytes: Buffer | null;
      sourcePageCount: number;
      extractionCursor: number;
      learnCursor: number;
      sourceLanguage: string;
      summary: string;
      completedWorkUnits: number;
      totalWorkUnits: number;
      errorMessage: string | null;
      leaseUntil: Date | null;
      expiresAt: Date;
      toObject: () => Record<string, unknown>;
    } = {
      _id: jobId,
      ownerId,
      courseId,
      status: "failed",
      failedStatus: "generatingLearn",
      input: courseGenerationInputSchema.parse({
        ...input,
        template: "custom",
        includeImages: false,
        model: "gpt-6-luna",
      }),
      sourceFileName: "slides.pdf",
      sourceContentType: "application/pdf",
      sourceBytes: null,
      sourcePageCount: 1,
      extractionCursor: 1,
      learnCursor: 0,
      sourceLanguage: "English",
      summary: "A source lesson about card sizing.",
      completedWorkUnits: 2,
      totalWorkUnits: 4,
      errorMessage: "The process stopped after saving the Learn item.",
      leaseUntil: null,
      expiresAt: new Date(Date.now() + 60_000),
      toObject: () => ({}),
    };
    jobRecord.toObject = () => ({ ...jobRecord });

    const checkpointPayloads = new Map<string, unknown>([
      ["inventoryBatch:0001-0001", {
        summary: "Page one describes a CSS card width example.",
        pages: [{
          pageNumber: 1,
          elements: [{
            sourceElementId: "p1-e1",
            kind: "text",
            content: "Set the card width to 30% so the row has room for spacing.",
            visualKind: "other",
            visibleText: "",
            uncertainContent: false,
          }],
        }],
      }],
      ["plan:course", {
        title: "CSS Card Layout",
        description: "A detailed course about CSS card sizing and spacing.",
        objectives: ["Explain the card width example."],
        sourceLanguage: "English",
        targetLanguage: "English",
        items: [{
          title: "Choosing a Card Width",
          focus: "Use the source width value to leave room for spacing.",
          startPage: 1,
          endPage: 1,
          sourceElementIds: ["p1-e1"],
          recommendedBlockTypes: ["text"],
          interactionOpportunities: ["Apply the width rule to a row of cards."],
        }],
      }],
      ["learnItem:000", {
        lesson: {
          title: "Choosing a Card Width",
          objective: "Explain how the width value leaves room for spacing.",
          summary: "The source uses a 30% card width so several cards can sit in one row with room for spacing between them.",
          blocks: [{
            ...block("text"),
            sourceElementIds: ["p1-e1"],
            body: "The card uses a width of 30%, leaving room for spacing between neighboring cards.",
          }],
        },
        coverageIssues: [],
      }],
    ]);

    vi.spyOn(GenerationJob, "findOneAndUpdate").mockImplementation((async () => {
      jobRecord.leaseUntil = new Date(Date.now() + 60_000);
      return { ...jobRecord, toObject: () => ({ ...jobRecord }) };
    }) as never);
    vi.spyOn(GenerationJob, "findOne").mockImplementation((async () => jobRecord) as never);
    vi.spyOn(GenerationJob, "updateOne").mockImplementation((async (_filter: unknown, update: unknown) => {
      const changes = update as { $set?: Record<string, unknown>; $inc?: Record<string, number> };
      Object.assign(jobRecord, changes.$set ?? {});
      for (const [key, amount] of Object.entries(changes.$inc ?? {})) {
        const current = jobRecord[key as keyof typeof jobRecord];
        if (typeof current === "number")
          (jobRecord as unknown as Record<string, unknown>)[key] = current + amount;
      }
      return {};
    }) as never);
    vi.spyOn(GenerationCheckpoint, "findOne").mockImplementation(((filter: { stage?: string; unitKey?: string }) => ({
      lean: async () => {
        const payload = checkpointPayloads.get(`${filter.stage}:${filter.unitKey}`);
        return payload === undefined ? null : { payload };
      },
    })) as never);
    vi.spyOn(GenerationCheckpoint, "updateMany").mockImplementation((async () => ({})) as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resumed = await advanceSourceGenerationJob({
      ownerId: ownerId.toString(),
      courseId: courseId.toString(),
      jobId: jobId.toString(),
    });

    expect(resumed.status).toBe("assembling");
    expect(jobRecord.learnCursor).toBe(1);
    expect(jobRecord.failedStatus).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps uploaded PDF bytes intact when a Mongoose generation job is converted to a plain object", async () => {
    const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
    const courseId = new Types.ObjectId("507f1f77bcf86cd799439012");
    const jobId = new Types.ObjectId("507f1f77bcf86cd799439013");
    const sourceBytes = await blankPdf(1);
    const job = new GenerationJob({
      _id: jobId,
      ownerId,
      courseId,
      status: "indexing",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false }),
      sourceFileName: "slides.pdf",
      sourceContentType: "application/pdf",
      sourceBytes,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(Buffer.from(job.toObject().sourceBytes).length).toBe(0);
    expect(Buffer.from(job.sourceBytes as Buffer).length).toBe(sourceBytes.length);

    vi.spyOn(GenerationJob, "findOneAndUpdate").mockImplementation((async () => job) as never);
    vi.spyOn(GenerationJob, "findOne").mockImplementation((async () => job) as never);
    vi.spyOn(GenerationJob, "updateOne").mockImplementation((async (_filter: unknown, update: unknown) => {
      const changes = update as { $set?: Record<string, unknown> };
      if (changes.$set) job.set(changes.$set);
      return {};
    }) as never);
    vi.spyOn(GenerationCheckpoint, "updateOne").mockImplementation((async () => ({})) as never);
    vi.spyOn(GenerationCheckpoint, "updateMany").mockImplementation((async () => ({})) as never);

    const advanced = await advanceSourceGenerationJob({
      ownerId: ownerId.toString(),
      courseId: courseId.toString(),
      jobId: jobId.toString(),
    });

    expect(advanced.status).toBe("extracting");
    expect(advanced.sourcePageCount).toBe(1);
    expect(advanced.errorMessage).toBeNull();
  });

  it("uses the configured post-test count instead of matching it to Learn item count", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const responses = stagedSourceResponses(2, [{ startPage: 1, endPage: 2 }], {
      template: "preLearnPost",
      postResponse: postActivitiesProviderResponse(3),
    });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(responses.shift())));
    const bytes = await blankPdf(2);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({
        ...input,
        template: "preLearnPost",
        postTestCount: 3,
        includeImages: false,
      }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    });

    expect(course.learningLessonCount).toBe(1);
    expect(course.lessons.find((lesson) => lesson.title === "Post-test")?.quizQuestions).toHaveLength(3);
  });

  it("rejects lesson counts and text that exceed generation limits", () => {
    expect(courseGenerationInputSchema.safeParse({ ...input, lessonCount: 21 }).success).toBe(false);
    expect(courseGenerationInputSchema.safeParse({ ...input, prompt: "x".repeat(5_001) }).success).toBe(false);
  });

  it("accepts a valid structured course draft using supported block intents", () => {
    const parsed = generatedCourseSeedSchema.parse(seed());
    expect(parsed.title).toBe("Support fundamentals");
    expect(parsed.sections[0].lessons[0].blocks.map(({ type }) => type)).toEqual([
      "text",
      "text",
    ]);
  });

  it("limits generated AI images to eight per course", () => {
    expect(generatedCourseSeedSchema.safeParse(seed(Array.from({ length: 9 }, () => block("image")))).success).toBe(false);
  });

  it("removes a stored image when the owner-scoped asset record cannot be created", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse([block("image")]))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output: [{ type: "image_generation_call", result: "iVBORw0KGgo=" }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(mediaStorage, "storeGeneratedImage").mockResolvedValue(undefined);
    const deleteMediaObject = vi.spyOn(mediaStorage, "deleteMediaObject").mockResolvedValue(undefined);
    vi.spyOn(Asset, "create").mockRejectedValue(new Error("asset record unavailable"));

    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: true }),
    })).rejects.toThrow("could not be saved to course media storage");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deleteMediaObject).toHaveBeenCalledWith(expect.stringMatching(/^507f1f77bcf86cd799439011\/507f1f77bcf86cd799439012\//));
  });

  it("adds generated illustrations for source visuals to the lesson covering each page", () => {
    const courseSeed = generatedCourseSeedSchema.parse(seed([block(), block()], {
      lessonOverview: Array.from({ length: 5 }, (_, index) => ({
        focus: `Source section ${index + 1}`,
        slideRange: `${index + 1}-${index + 1}`,
      })),
    }));
    const inventory = generatedSourceInventorySchema.parse({
      sourcePageCount: 2,
      pages: [
        {
          pageNumber: 1,
          elements: [{ kind: "visual", content: "A flowchart of the lesson process.", visualKind: "diagram", visibleText: "Start, review, finish" }],
        },
        {
          pageNumber: 2,
          elements: [{ kind: "visual", content: "A screenshot of the result.", visualKind: "screenshot", visibleText: "Success" }],
        },
      ],
    });

    addSourceVisualBlocks(courseSeed, inventory);

    const firstLesson = courseSeed.sections[0].lessons[0];
    const secondLesson = courseSeed.sections[0].lessons[1];
    expect(firstLesson.blocks.at(-1)).toMatchObject({
      type: "image",
      imagePrompt: expect.stringContaining("source page 1"),
    });
    expect(secondLesson.blocks.at(-1)).toMatchObject({
      type: "image",
      imagePrompt: expect.stringContaining("source page 2"),
    });
  });

  it("transcribes PDF pages in order and carries their exact code into the lesson", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const sourceCode = '<h1 class="title">Hello, world!</h1>\n<p>Welcome to HTML.</p>';
    const sourceElements: TestSourceElement[] = [
      { kind: "code", content: sourceCode, visualKind: "other", visibleText: "", uncertainContent: false },
      { kind: "text", content: "The HTML heading element creates the page title, while the paragraph element displays the welcome message below it.", visualKind: "other", visibleText: "", uncertainContent: false },
      { kind: "visual", content: "A screenshot showing the console output.", visualKind: "screenshot", visibleText: "hello", uncertainContent: false },
    ];
    const ranges = [{ startPage: 1, endPage: 5 }, { startPage: 6, endPage: 10 }];
    const responses = stagedSourceResponses(10, ranges, {
      elementsByPage: { 1: sourceElements },
      learn: (index, ids) => index === 0
        ? sourceLearnProviderResponse(ids, [
            { ...block("code"), title: "HTML example", body: sourceCode },
            { ...block(), title: "What the example does", body: "The HTML heading element creates the page title, while the paragraph element displays the welcome message below it. The browser renders a large heading followed by a separate paragraph. The class attribute can be used by CSS to style the heading." },
          ], "HTML elements and page structure", [["p1-e1"], ids.filter((id) => id !== "p1-e1")])
        : sourceLearnProviderResponse(ids),
    });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await blankPdf(10);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false, learnGroupingMode: "fixed", slidesPerContent: 5 }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    });

    const extractionRequest = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(extractionRequest.input[1].content[1]).toMatchObject({ type: "input_file", detail: "high" });
    expect(JSON.stringify(extractionRequest)).toContain("Recognize HTML tags and examples");
    const courseRequest = JSON.parse(fetchMock.mock.calls[4][1].body as string);
    const learnDeveloperPrompt = courseRequest.input[0].content as string;
    const lessonPrompt = courseRequest.input[1].content[0].text as string;
    expect(learnDeveloperPrompt.length).toBeLessThan(1_000);
    expect(learnDeveloperPrompt).toMatch(/map every sourceElementId to a block/i);
    expect(learnDeveloperPrompt).toContain("Avoid duplicate facts");
    expect(learnDeveloperPrompt).not.toContain("Course content blocks supported by this project");
    expect(lessonPrompt).toContain("Generate only Learn content item 1-5");
    expect(lessonPrompt).toContain("Item focus: Learn the concepts from pages 1-5.");
    expect(lessonPrompt).not.toContain("Learning objectives:");
    expect(lessonPrompt).toContain("Content depth: detailed");
    expect(JSON.stringify(courseRequest)).toContain("target-language explanation above or below the code");
    const inventoryText = JSON.stringify(courseRequest.input[1].content);
    expect(inventoryText).toContain("The HTML heading element creates the page title");
    expect(inventoryText).toContain("A screenshot showing the console output.");
    expect(lessonPrompt).toContain("\\n<p>Welcome to HTML.</p>");
    expect(course.sourceCoverage?.items.find((item) => item.sourceElementId === "p1-e1")).toMatchObject({
      sourceElementType: "code",
      preservationStatus: "preserved",
    });
    const codeBlock = course.lessons[0].blocks.find((item) => item.type === "richText" && item.data.html.includes("<pre><code>"));
    expect(codeBlock?.type === "richText" && codeBlock.data.html).toContain("<pre><code>&lt;h1 class=&quot;title&quot;&gt;Hello, world!&lt;/h1&gt;\n&lt;p&gt;Welcome to HTML.&lt;/p&gt;</code></pre>");
    expect(course.lessons[0]?.blocks.some((item) =>
      item.type === "richText" && item.data.html.includes("The HTML heading element creates the page title"),
    )).toBe(true);
    expect(lessonContentSchema.parse({ schemaVersion: 1, blocks: course.lessons[0]?.blocks }).blocks).toHaveLength(3);
    const scormSnapshot = parseScorm12Snapshot({
      title: course.title,
      description: course.description,
      revision: 0,
      sections: course.sections,
      lessons: course.lessons,
    });
    expect(scormSnapshot.lessons[0]?.blocks.some((item) =>
      item.type === "richText" && item.data.html.includes("&lt;h1 class=&quot;title&quot;&gt;Hello, world!"),
    )).toBe(true);
  });

  it("targets a Learn-item retry when an important source number is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const sourceText = "Set every product card to width: 30% so the row leaves room for spacing.";
    const responses = stagedSourceResponses(1, [{ startPage: 1, endPage: 1 }], {
      elementsByPage: {
        1: [{ kind: "text", content: sourceText, visualKind: "other", visibleText: "", uncertainContent: false }],
      },
      learn: (_index, ids) => sourceLearnProviderResponse(ids, [
        { ...block("text"), body: "Set every product card to leave enough room for spacing." },
      ]),
    });
    responses.push(sourceLearnProviderResponse(
      ["p1-e1"],
      [{ ...block("text"), body: sourceText }],
    ));
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes: await blankPdf(1) },
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const repairPrompt = JSON.parse(fetchMock.mock.calls[4][1].body as string)
      .input[1].content[0].text as string;
    expect(repairPrompt).toContain("Important source value");
    expect(repairPrompt).toContain("30%");
    expect(course.sourceCoverage?.items[0]).toMatchObject({ preservationStatus: "preserved" });
  });

  it("returns a source-grounded summary and page count for an uploaded file", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sourcePageBatchResponse(1, 3))
      .mockResolvedValueOnce(sourceSummaryProviderResponse(3));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await blankPdf(3);

    const summary = await summarizeCourseSource({
      input: courseGenerationInputSchema.parse(input),
      sourceFile: {
        name: "slides.pdf",
        contentType: "application/pdf",
        bytes,
      },
    });

    expect(summary).toEqual({
      fileName: "slides.pdf",
      sourcePageCount: 3,
      summary: "The 3-page source explains its subject through definitions, code examples, and practical instructions.",
      sourceLanguage: "English",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toContain("Inspect only source pages 1-3 of 3");
  });

  it("repairs only a Learn item with code missing its adjacent explanation and reports an unresolved result", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const sourceCode = "<h1>Hello</h1>";
    const ranges = [{ startPage: 1, endPage: 1 }];
    const missingExplanation = (ids: string[]) => sourceLearnProviderResponse(
      ids,
      [{ ...block("code"), body: sourceCode }],
      "HTML code example",
    );
    const responses = stagedSourceResponses(1, ranges, {
      elementsByPage: {
        1: [{ kind: "code", content: sourceCode, visualKind: "other", visibleText: "", uncertainContent: false }],
      },
      learn: (_index, ids) => missingExplanation(ids),
    });
    responses.push(missingExplanation(["p1-e1"]));
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await blankPdf(1);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false, learnGroupingMode: "fixed" }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(course.sourceCoverage?.items[0]).toMatchObject({
      sourceElementId: "p1-e1",
      preservationStatus: "partiallyPreserved",
      note: expect.stringContaining("adjacent text explanation"),
    });
  });

  it("repairs post-activity output when its course summary is not detailed", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const ranges = [{ startPage: 1, endPage: 1 }];
    const shortPost = jsonProviderResponse({
      postTest: Array.from({ length: 5 }, (_, index) => assessmentQuestion(index)),
      lessonSummary: "A short recap.",
      nextLesson: "Next Topic",
    });
    const responses = stagedSourceResponses(1, ranges, {
      template: "preLearnPost",
      postResponse: shortPost,
    });
    responses.push(postActivitiesProviderResponse());
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await blankPdf(1);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, template: "preLearnPost", learnGroupingMode: "fixed" }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    });

    expect(course.title).toBe("Support fundamentals");
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(String(fetchMock.mock.calls[6]?.[1]?.body)).toContain("CORRECTION REQUIRED");
  });

  it("repairs pre-activities without regenerating the source or plan", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const ranges = [{ startPage: 1, endPage: 1 }];
    const responses = stagedSourceResponses(1, ranges, { template: "preLearnPost" });
    responses.splice(3, 0, jsonProviderResponse({ keyTerms: [], preTest: [] }));
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal("fetch", fetchMock);
    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, template: "preLearnPost", includeImages: false }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes: await blankPdf(1) },
    });
    expect(course.learningLessonCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock.mock.calls[4][1].body).toContain("CORRECTION REQUIRED");
    const schema = JSON.parse(fetchMock.mock.calls[3][1].body).text.format.schema;
    expect(schema.properties.keyTerms).toMatchObject({ minItems: 5, maxItems: 5 });
    expect(schema.properties.preTest).toMatchObject({ minItems: 3, maxItems: 3 });
  });

  it("fails post-activities only after the focused correction attempt is still invalid", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const ranges = [{ startPage: 1, endPage: 1 }];
    const shortPost = () => jsonProviderResponse({
      postTest: Array.from({ length: 5 }, (_, index) => assessmentQuestion(index)),
      lessonSummary: "A short recap.",
      nextLesson: "Next Topic",
    });
    const responses = stagedSourceResponses(1, ranges, {
      template: "preLearnPost",
      postResponse: shortPost(),
    });
    responses.push(shortPost());
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(responses.shift())));
    const bytes = await blankPdf(1);

    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, template: "preLearnPost", learnGroupingMode: "fixed" }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    })).rejects.toThrow("post-activities after a correction attempt");
  });

  it("keeps a generated course when targeted code repair fails and marks source coverage unresolved", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const sourceCode = "print('source code')";
    const ranges = [{ startPage: 1, endPage: 2 }];
    const missingCode = (ids: string[]) => sourceLearnProviderResponse(ids, [block("text")]);
    const responses = stagedSourceResponses(2, ranges, {
      elementsByPage: {
        1: [{ kind: "code", content: sourceCode, visualKind: "other", visibleText: "", uncertainContent: false }],
      },
      learn: (_index, ids) => missingCode(ids),
    });
    responses.push(missingCode(["p1-e1", "p2-e1"]));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(responses.shift())));
    const bytes = await blankPdf(2);

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes },
    });
    expect(course.sourceCoverage?.complete).toBe(false);
    expect(course.sourceCoverage?.items[0]?.preservationStatus).toBe("unresolved");
  });

  it("accepts one focused block because valid editor conversion can add a continue block", () => {
    expect(generatedCourseSeedSchema.safeParse(seed([block()])).success).toBe(true);
  });

  it("requires the generated draft to match the requested lesson count", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(providerResponse())));

    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, lessonCount: 8 }),
    })).rejects.toThrow("requested number of lessons");
  });

  it("reports when the app server blocks outbound provider access", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const networkError = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("network access denied"), { code: "EACCES" }),
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
    })).rejects.toThrow("blocked from making outbound HTTPS requests");
  });

  it("explains when course generation exceeds its request time limit", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("deadline"), { name: "TimeoutError" })));

    await expect(generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
    })).rejects.toThrow("Course generation took too long");
  });

  it("converts generated output into validated existing lesson blocks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse([
      { ...block(), body: "Use <script>alert('x')</script> as untrusted text." },
      { ...block("code"), title: "JavaScript", body: "const message = '<hello>';\nconsole.log(message);" },
      { ...block(), type: "knowledgeCheck", question: "What comes first?" },
      { ...block("flipCard"), cards: [{ front: "Question", back: "Answer", frontImagePrompt: "", frontImageAlt: "", backImagePrompt: "", backImageAlt: "" }] },
      { ...block("accordion"), steps: [{ title: "Step one", body: "First detail." }, { title: "Step two", body: "Second detail." }] },
      block("divider"),
    ])));

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
    });

    expect(course.lessons[0].blocks.slice(1).map((item) => item.type)).toEqual([
      "richText", "richText", "knowledgeCheck", "flipCard", "accordion", "divider",
    ]);
    expect(lessonContentSchema.parse({ schemaVersion: 1, blocks: course.lessons[0].blocks }).blocks).toHaveLength(7);
    const textBlock = course.lessons[0].blocks[1];
    expect(textBlock.type === "richText" && textBlock.data.html).toContain("&lt;script&gt;");
    const codeBlock = course.lessons[0].blocks[2];
    expect(codeBlock.type === "richText" && codeBlock.data.html).toContain("<pre><code>const message = &#39;&lt;hello&gt;&#39;;");
    expect(textBlock.type === "richText" && textBlock.data.html).toContain("<h2>Identify the request</h2>");
  });

  it("maps native editor block types and their settings into valid course blocks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const outputBlocks = [
      { ...block("heading"), title: "Section title", headingLevel: 2, body: "", bullets: [] },
      block("richText"),
      block("statement"),
      { ...block("knowledgeCheck"), question: "Which response is correct?" },
      { ...block("processSteps"), steps: [{ title: "First", body: "Do this." }, { title: "Next", body: "Then do this." }] },
      { ...block("flipCard"), cards: [{ front: "Term", back: "Definition", frontImagePrompt: "", frontImageAlt: "", backImagePrompt: "", backImageAlt: "" }] },
      { ...block("accordion"), layout: "tabs" as const, steps: [{ title: "One", body: "Detail one." }, { title: "Two", body: "Detail two." }] },
      { ...block("divider"), dividerStyle: "line" as const },
      { ...block("survey"), question: "How confident are you?" },
      { ...block("gallery"), galleryImages: [{ src: "https://example.test/slide.png", alt: "A source slide illustration" }] },
      { ...block("video"), videoSrc: "https://media.example.test/lesson.mp4", videoMimeType: "video/mp4" as const },
      { ...block("chart"), title: "Requests by category", chartFields: [{ label: "Billing", value: 6 }, { label: "Access", value: 4 }] },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse(outputBlocks)));

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false }),
    });

    expect(course.lessons[0].blocks.slice(1).map((item) => item.type)).toEqual([
      "heading", "richText", "statement", "knowledgeCheck", "processSteps",
      "flipCard", "accordion", "divider", "survey", "gallery", "video", "chart",
    ]);
    expect(lessonContentSchema.parse({ schemaVersion: 1, blocks: course.lessons[0].blocks }).blocks).toHaveLength(13);
    const tabs = course.lessons[0].blocks[7];
    expect(tabs.type === "accordion" && tabs.data).toMatchObject({ layout: "tabs", displayMode: "all" });
  });

  it("adds Khmer Continue controls after long content and localizes the Pre / Learn / Post template", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const longKhmerText = "ក".repeat(900);
    const templateFields = {
      lessonOverview: Array.from({ length: 2 }, (_, index) => ({ focus: `ចំណុចទី ${index + 1}`, slideRange: "" })),
      keyTerms: Array.from({ length: 5 }, (_, index) => ({ term: `ពាក្យ${index + 1}`, definition: "និយមន័យ" })),
      preTest: Array.from({ length: 3 }, (_, index) => ({ ...assessmentQuestion(index), correctFeedback: "ត្រឹមត្រូវ", incorrectFeedback: "ព្យាយាមម្ដងទៀត" })),
      postTest: Array.from({ length: 2 }, (_, index) => ({ ...assessmentQuestion(index + 3), correctFeedback: "ត្រឹមត្រូវ", incorrectFeedback: "ព្យាយាមម្ដងទៀត" })),
      lessonSummary: "សេចក្តីសង្ខេប",
      nextLesson: "មេរៀនបន្ទាប់",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse([
      { ...block(), title: "ចំណុចសំខាន់", body: longKhmerText },
      { ...block(), title: "ពន្យល់បន្ថែម", body: "អត្ថបទខ្លី។" },
    ], templateFields, 2)));

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, lessonCount: 2, template: "preLearnPost", postTestCount: 2, targetLanguage: "Khmer" }),
    });

    expect(course.sections.map((section) => section.title)).toEqual(["សកម្មភាពមុនរៀន", "មេរៀន", "សកម្មភាពក្រោយរៀន"]);
    expect(course.learningLessonCount).toBe(2);
    const lesson = course.lessons.find((item) => item.title === "Read the request");
    expect(lesson?.blocks.map((item) => item.type)).toEqual(["richText", "divider", "richText"]);
    const continueButton = lesson?.blocks[1];
    expect(continueButton?.type === "divider" && continueButton.data.label).toBe("បន្ត");
    expect(course.lessons.some((item) => item.title === "តេស្តមុនរៀន")).toBe(true);
    const overview = course.lessons.find((item) => item.title === "ទិដ្ឋភាពទូទៅនៃមេរៀន")?.blocks[0];
    expect(overview?.type === "richText" && overview.data.html).toContain("<p>ចំណុចទី 1</p>");
    expect(overview?.type === "richText" && overview.data.html).not.toContain("<table");
  });

  it("keeps each lesson usable if optional image blocks are disabled", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse([
      block("image"),
      { ...block(), type: "text", title: "Key idea", body: "A short explanation." },
    ])));

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, includeImages: false }),
    });

    expect(course.generatedImageCount).toBe(0);
    expect(course.lessons[0].blocks).toHaveLength(3);
    expect(lessonContentSchema.parse({ schemaVersion: 1, blocks: course.lessons[0].blocks }).blocks).toHaveLength(3);
  });
});
