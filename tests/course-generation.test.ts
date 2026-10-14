import { afterEach, describe, expect, it, vi } from "vitest";
import {
  courseGenerationInputSchema,
  generatedCourseSeedSchema,
} from "../lib/ai/course-generation-schemas";
import { generateCourseDraft } from "../lib/ai/course-generation";
import { lessonContentSchema } from "../lib/schemas/block";

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

function block(type: "text" | "statement" | "knowledgeCheck" | "processSteps" | "flipCard" | "accordion" | "divider" | "image" = "text"): {
  type: "text" | "statement" | "knowledgeCheck" | "processSteps" | "flipCard" | "accordion" | "divider" | "image";
  title: string;
  body: string;
  bullets: string[];
  style: "tip";
  question: string;
  options: string[];
  correctOptionIndex: number;
  steps: { title: string; body: string }[];
  cards: { front: string; back: string }[];
  imageAlt: string;
  imagePrompt: string;
} {
  return {
    type,
    title: "Identify the request",
    body: "Read the full message before choosing a response.",
    bullets: [],
    style: "tip",
    question: "What should you do first?",
    options: ["Read the request", "Close the ticket"],
    correctOptionIndex: 0,
    steps: [],
    cards: [],
    imageAlt: "A support agent reviewing a request",
    imagePrompt: "A support agent reviewing a customer request at a computer",
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
    lessonSummary: "",
    nextLesson: "",
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AI course generation contracts", () => {
  it("accepts bounded prompt generation settings", () => {
    expect(courseGenerationInputSchema.parse(input)).toMatchObject({
      lessonCount: 5,
      includeImages: true,
      level: "beginner",
    });
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

  it("builds the Pre / Learn / Post template using existing course blocks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const templateFields = {
      lessonOverview: Array.from({ length: 2 }, (_, index) => ({
        focus: `Learning focus ${index + 1}`,
        slideRange: `Slides ${index * 10 + 1}-${index * 10 + 10}`,
      })),
      keyTerms: Array.from({ length: 5 }, (_, index) => ({
        term: `Term ${index + 1}`,
        definition: `Definition ${index + 1}`,
      })),
      preTest: Array.from({ length: 3 }, (_, index) => assessmentQuestion(index)),
      postTest: Array.from({ length: 2 }, (_, index) => assessmentQuestion(index + 3)),
      lessonSummary: "A concise recap of the course.",
      nextLesson: "Continue with advanced customer support scenarios.",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse([block(), block()], templateFields, 2)));

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse({ ...input, lessonCount: 2, template: "preLearnPost" }),
      sourceFile: { name: "slides.pdf", contentType: "application/pdf", bytes: Buffer.from("source") },
    });

    expect(course.sections.map((section) => section.title)).toEqual(["Pre activities", "Learn", "Post activities"]);
    expect(course.learningLessonCount).toBe(2);
    expect(course.lessons.filter((lesson) => lesson.sectionId === course.sections[0].id)).toHaveLength(4);
    expect(course.lessons.filter((lesson) => lesson.sectionId === course.sections[2].id)).toHaveLength(3);
    const overview = course.lessons.find((lesson) => lesson.title === "Lesson overview");
    expect(overview?.blocks[0].type === "richText" && overview.blocks[0].data.html).toContain("<ol>");
    expect(overview?.blocks[0].type === "richText" && overview.blocks[0].data.html).toContain("font-size: 18px");
    const keywords = course.lessons.find((lesson) => lesson.title === "Keyword");
    expect(keywords?.blocks[0].type === "flipCard" && keywords.blocks[0].data.cards).toHaveLength(5);
    expect(course.lessons.find((lesson) => lesson.title === "Pre-test")).toMatchObject({ lessonType: "quiz", quizQuestions: expect.arrayContaining([expect.any(Object)]) });
    expect(course.lessons.find((lesson) => lesson.title === "Pre-test")?.quizQuestions).toHaveLength(3);
    const preTest = course.lessons.find((lesson) => lesson.title === "Pre-test");
    expect(preTest?.quizQuestions[0].correctChoiceIds).toEqual([
      preTest?.quizQuestions[0].choices[0].id,
    ]);
    expect(course.lessons.find((lesson) => lesson.title === "Post-test")).toMatchObject({ lessonType: "quiz" });
    expect(course.lessons.find((lesson) => lesson.title === "Post-test")?.quizQuestions).toHaveLength(2);
  });

  it("rejects lesson counts and text that exceed generation limits", () => {
    expect(courseGenerationInputSchema.safeParse({ ...input, lessonCount: 21 }).success).toBe(false);
    expect(courseGenerationInputSchema.safeParse({ ...input, prompt: "x".repeat(5_001) }).success).toBe(false);
  });

  it("accepts a valid structured course draft using supported block intents", () => {
    expect(generatedCourseSeedSchema.parse(seed())).toMatchObject({
      title: "Support fundamentals",
      sections: [{ lessons: [{ blocks: [{ type: "text" }, { type: "text" }] }] }],
    });
  });

  it("limits generated AI images to three per course", () => {
    expect(generatedCourseSeedSchema.safeParse(seed([block("image"), block("image"), block("image"), block("image")])).success).toBe(false);
  });

  it("rejects lessons without enough blocks for an instructional sequence", () => {
    expect(generatedCourseSeedSchema.safeParse(seed([block()])).success).toBe(false);
  });

  it("requires the generated draft to match the requested lesson count", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse()));

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
      { ...block(), type: "knowledgeCheck", question: "What comes first?" },
      { ...block("flipCard"), cards: [{ front: "Question", back: "Answer" }] },
      { ...block("accordion"), steps: [{ title: "Step one", body: "First detail." }, { title: "Step two", body: "Second detail." }] },
      block("divider"),
    ])));

    const course = await generateCourseDraft({
      ownerId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      input: courseGenerationInputSchema.parse(input),
    });

    expect(course.lessons[0].blocks.map((item) => item.type)).toEqual([
      "richText", "knowledgeCheck", "flipCard", "accordion", "divider",
    ]);
    expect(lessonContentSchema.parse({ schemaVersion: 1, blocks: course.lessons[0].blocks }).blocks).toHaveLength(5);
    const textBlock = course.lessons[0].blocks[0];
    expect(textBlock.type === "richText" && textBlock.data.html).toContain("&lt;script&gt;");
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
    expect(course.lessons[0].blocks).toHaveLength(2);
    expect(lessonContentSchema.parse({ schemaVersion: 1, blocks: course.lessons[0].blocks }).blocks).toHaveLength(2);
  });
});
