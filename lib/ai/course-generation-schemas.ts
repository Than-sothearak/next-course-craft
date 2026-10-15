import { z } from "zod";
import { codeLanguageValues, codeTemplateValues } from "../editor/code-example";
import {
  blockTypes,
  chartTypeSchema,
  imageLayoutSchema,
} from "../schemas/block";

const generatedNativeBlockTypes = [
  "heading",
  "richText",
  "image",
  "gallery",
  "video",
  "divider",
  "knowledgeCheck",
  "survey",
  "statement",
  "flipCard",
  "accordion",
  "labeledGraphic",
  "processSteps",
  "chart",
] as const satisfies readonly (typeof blockTypes)[number][];

export const generatedBlockTypeValues = [
  ...generatedNativeBlockTypes,
  "text",
  "code",
] as const;

export const courseBlockGenerationGuide = `Course content blocks supported by this project:
- heading: a genuine topic boundary; use title and headingLevel 1, 2, or 3. Use level 2 for ordinary 24px bold headings. Do not add headings for every paragraph or repeat a lesson title.
- richText (also the text intent): normal paragraph explanations belong in body; use bullets for lists. Set title to an empty string for ordinary paragraphs and after a standalone heading; a title alone is not an explanation.
- code: body contains exact raw code, never Markdown fences. Use codeExample with template, language, and a complete paragraph explanation of its meaning, important lines, and result. Templates: ${codeTemplateValues.join(", ")}. Explained templates place the explanation above or below the code. Choose an appropriate template consistently, follow author style requests, and keep title empty unless a meaningful example heading is needed. Code is stored in the existing richText block and remains editable. Return codeExample null on other block types.
- image: one useful generated illustration; provide imagePrompt and accessible imageAlt. imageLayout may be full, banner, text-left, text-right, text-overlay, or card; title/body are optional accompanying copy.
- gallery: a group of 1–8 images; use galleryImages with source image URLs and alt text only when those URLs are explicitly present in the source. Never invent image URLs.
- video: a playable direct MP4/WebM source; use videoSrc only when a direct video URL appears in the provided source, and provide videoMimeType and captions when available. Never invent a URL.
- divider: a visual separator or Continue control; dividerStyle is line, space, or continue. Use completionType none unless the author explicitly asks to require completion above it.
- knowledgeCheck: a practice question; provide question, 2–8 options, correctOptionIndex, and learner-facing correct/incorrect feedback.
- survey: a non-graded reflection question; provide question plus minLabel and maxLabel for its response scale.
- statement: a highlighted takeaway, tip, warning, or centered callout; provide title, body, and style key/tip/warning/centered.
- flipCard: 1–30 question/answer or term/definition cards. Each face may be text or an image; when using an image face, provide its image prompt and accessible alt text.
- accordion: 2–12 grouped items in steps, with layout accordion or tabs. The project supports all/oneByOne display modes; generated blocks always use all so learners can open multiple items without closing previous ones.
- labeledGraphic: a generated visual with 1–20 labeled markers; provide imagePrompt, imageAlt, and markers with concise label/description and x/y positions from 0 to 100.
- processSteps: a real ordered procedure with 2–20 steps; do not use for unrelated facts.
- chart: a data-supported visualization; choose bar, column, line, donut, or stacked and provide a title, optional description, and 1–20 fields with labels and numeric values. Do not invent data.
Use enough blocks to preserve every meaningful source detail, example, and step. Keep each block focused and avoid repeating the same information. For unused string/array fields return empty strings/arrays; for required settings use these neutral values: style tip, headingLevel 2, correctOptionIndex 0, layout accordion, displayMode all, imageLayout full, dividerStyle continue, dividerCompletionType none, chartType bar, and chartColor #4f46e5. The application assigns block IDs and visual styling.`;

export const courseGenerationModelValues = [
  "gpt-6-astra",
  "gpt-6.1-sol",
  "gpt-6-luna",
] as const;
export const learnGroupingModeValues = ["smart", "fixed"] as const;
export const learnGroupingModeSchema = z.enum(learnGroupingModeValues);
export type LearnGroupingMode = z.infer<typeof learnGroupingModeSchema>;
export const courseGenerationModelSchema = z.enum(courseGenerationModelValues);
export type CourseGenerationModel = z.infer<typeof courseGenerationModelSchema>;
export const defaultCourseGenerationModel: CourseGenerationModel = "gpt-6-luna";
export const courseGenerationModelOptions: {
  value: CourseGenerationModel;
  label: string;
  description: string;
}[] = [
  { value: "gpt-6-astra", label: "GPT-6 Astra", description: "Most capable" },
  { value: "gpt-6.1-sol", label: "GPT-6.1 Sol", description: "Balanced" },
  { value: "gpt-6-luna", label: "GPT-6 Luna", description: "Efficient" },
];

export const courseGenerationInputSchema = z.object({
  prompt: z.string().max(5_000),
  audience: z.string().max(300),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  lessonCount: z.number().int().min(2).max(20),
  template: z.enum(["custom", "preLearnPost"]),
  learnGroupingMode: learnGroupingModeSchema.default("smart"),
  slidesPerContent: z.number().int().min(1).max(500).default(5),
  targetLanguage: z.enum(["English", "Khmer"]).default("English"),
  contentDepth: z
    .enum(["concise", "detailed", "veryDetailed"])
    .default("detailed"),
  interactivity: z.enum(["low", "medium", "high"]).default("high"),
  postTestCount: z.number().int().min(1).max(20).default(5),
  includeImages: z.boolean(),
  courseTitle: z.string().max(160),
  courseDescription: z.string().max(5_000),
  model: courseGenerationModelSchema.optional(),
});

export const generatedSourceInventorySchema = z
  .object({
    sourcePageCount: z.number().int().min(1).max(500),
    summary: z.string().trim().max(5_000).default(""),
    sourceLanguage: z.string().trim().max(80).default("unknown"),
    pages: z
      .array(
        z.object({
          pageNumber: z.number().int().min(1).max(500),
          elements: z
            .array(
              z.object({
                sourceElementId: z.string().max(120).default(""),
                kind: z.enum(["text", "code", "visual"]),
                content: z.string().max(50_000),
                visualKind: z.enum([
                  "diagram",
                  "chart",
                  "table",
                  "screenshot",
                  "photo",
                  "illustration",
                  "other",
                ]),
                visibleText: z.string().max(10_000),
                uncertainContent: z.boolean().default(false),
              }),
            )
            .max(100),
        }),
      )
      .min(1)
      .max(500),
  })
  .superRefine((source, context) => {
    if (source.pages.length !== source.sourcePageCount) {
      context.addIssue({
        code: "custom",
        path: ["pages"],
        message: "The source inventory must include every page or slide.",
      });
    }
    source.pages.forEach((page, index) => {
      if (page.pageNumber !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["pages", index, "pageNumber"],
          message: "Source pages must be listed in order without gaps.",
        });
      }
    });
  });

export const generatedAssessmentQuestionSchema = z
  .object({
    question: z.string().trim().min(1).max(1_000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(5),
    correctOptionIndex: z.number().int().min(0).max(4),
    correctFeedback: z.string().max(1_000),
    incorrectFeedback: z.string().max(1_000),
  })
  .superRefine((question, context) => {
    if (question.correctOptionIndex >= question.options.length) {
      context.addIssue({
        code: "custom",
        path: ["correctOptionIndex"],
        message:
          "The correct answer must refer to one of the available options.",
      });
    }
  });

export const generatedBlockSeedSchema = z
  .object({
    sourceElementIds: z.array(z.string().min(1).max(120)).max(500).default([]),
    type: z.enum(generatedBlockTypeValues),
    title: z.string().max(500),
    body: z.string().max(80_000),
    codeExample: z.object({
      template: z.enum(codeTemplateValues),
      language: z.enum(codeLanguageValues),
      explanation: z.string().max(10_000),
    }).nullable().default(null),
    bullets: z.array(z.string().max(5_000)).max(500),
    style: z.enum(["key", "tip", "warning", "centered"]),
    headingLevel: z.number().int().min(1).max(3).default(2),
    question: z.string().max(1_000),
    options: z.array(z.string().max(500)).max(8),
    correctOptionIndex: z.number().int().min(0).max(7),
    correctFeedback: z.string().max(1_000).default(""),
    incorrectFeedback: z.string().max(1_000).default(""),
    minLabel: z.string().max(100).default(""),
    maxLabel: z.string().max(100).default(""),
    steps: z
      .array(
        z.object({
          title: z.string().max(160),
          body: z.string().max(5_000),
        }),
      )
      .max(500),
    cards: z
      .array(
        z.object({
          front: z.string().max(2_000).default(""),
          back: z.string().max(2_000).default(""),
          frontImagePrompt: z.string().max(1_000).default(""),
          frontImageAlt: z.string().max(500).default(""),
          backImagePrompt: z.string().max(1_000).default(""),
          backImageAlt: z.string().max(500).default(""),
        }),
      )
      .max(500)
      .default([]),
    layout: z.enum(["accordion", "tabs"]).default("accordion"),
    displayMode: z.literal("all").default("all"),
    imageAlt: z.string().max(500),
    imagePrompt: z.string().max(1_000),
    imageLayout: imageLayoutSchema.default("full"),
    imageTitle: z.string().max(500).default(""),
    imageBody: z.string().max(5_000).default(""),
    galleryImages: z
      .array(
        z.object({
          src: z.string().url(),
          alt: z.string().max(500),
        }),
      )
      .max(8)
      .default([]),
    videoSrc: z.string().max(2_000).default(""),
    videoMimeType: z.enum(["", "video/mp4", "video/webm"]).default(""),
    videoCaptions: z.string().max(10_000).default(""),
    dividerStyle: z.enum(["line", "space", "continue"]).default("continue"),
    dividerLabel: z.string().max(100).default("Continue"),
    dividerCompletionType: z.enum(["none", "completeAbove"]).default("none"),
    markers: z
      .array(
        z.object({
          label: z.string().max(100),
          description: z.string().max(2_000),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .or(z.literal(""))
            .default(""),
        }),
      )
      .max(500)
      .default([]),
    markerColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .or(z.literal(""))
      .default(""),
    textColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .or(z.literal(""))
      .default(""),
    radarColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .or(z.literal(""))
      .default(""),
    chartType: chartTypeSchema.default("bar"),
    chartDescription: z.string().max(2_000).default(""),
    chartColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#4f46e5"),
    chartFields: z
      .array(
        z.object({
          label: z.string().max(120),
          value: z.number().finite().min(0).max(1_000_000_000_000),
        }),
      )
      .max(500)
      .default([]),
  })
  .superRefine((block, context) => {
    const addIssue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    if (block.type === "code" && !block.body.trim())
      addIssue(["body"], "Code blocks need source code in body.");
    if (block.type === "heading" && !block.title.trim())
      addIssue(["title"], "Heading blocks need a title.");
    if (block.type === "knowledgeCheck") {
      if (!block.question.trim())
        addIssue(["question"], "Knowledge checks need a question.");
      if (block.options.length < 2)
        addIssue(
          ["options"],
          "Knowledge checks need at least two answer options.",
        );
      if (block.correctOptionIndex >= block.options.length)
        addIssue(
          ["correctOptionIndex"],
          "The correct answer must refer to an available option.",
        );
    }
    if (
      block.type === "survey" &&
      (!block.question.trim() ||
        !block.minLabel.trim() ||
        !block.maxLabel.trim())
    )
      addIssue(
        ["question"],
        "Surveys need a question and labels for both ends of the scale.",
      );
    if (block.type === "processSteps") {
      if (block.steps.length < 2)
        addIssue(["steps"], "Process steps need at least two ordered steps.");
      block.steps.forEach((step, index) => {
        if (!step.title.trim() || !step.body.trim())
          addIssue(
            ["steps", index],
            "Each process step needs a title and explanation.",
          );
      });
    }
    if (block.type === "flipCard") {
      if (!block.cards.length)
        addIssue(["cards"], "Flip cards need at least one card.");
      block.cards.forEach((card, index) => {
        if (
          Boolean(card.front.trim()) === Boolean(card.frontImagePrompt.trim())
        )
          addIssue(
            ["cards", index, "front"],
            "Each front face needs text or an image prompt.",
          );
        if (Boolean(card.back.trim()) === Boolean(card.backImagePrompt.trim()))
          addIssue(
            ["cards", index, "back"],
            "Each back face needs text or an image prompt.",
          );
        if (card.frontImagePrompt.trim() && !card.frontImageAlt.trim())
          addIssue(
            ["cards", index, "frontImageAlt"],
            "Image faces need accessible alt text.",
          );
        if (card.backImagePrompt.trim() && !card.backImageAlt.trim())
          addIssue(
            ["cards", index, "backImageAlt"],
            "Image faces need accessible alt text.",
          );
      });
    }
    if (block.type === "accordion") {
      if (block.steps.length < 2)
        addIssue(["steps"], "Accordions need at least two items.");
      block.steps.forEach((item, index) => {
        if (!item.title.trim() || !item.body.trim())
          addIssue(
            ["steps", index],
            "Each accordion item needs a title and content.",
          );
      });
    }
    if (block.type === "gallery" && !block.galleryImages.length)
      addIssue(["galleryImages"], "Galleries need at least one source image.");
    if (block.type === "video") {
      try {
        const source = new URL(block.videoSrc);
        if (!["http:", "https:"].includes(source.protocol))
          throw new Error("unsupported protocol");
      } catch {
        addIssue(
          ["videoSrc"],
          "Video blocks need a valid HTTP or HTTPS source URL.",
        );
      }
    }
    if (block.type === "labeledGraphic") {
      if (!block.imagePrompt.trim())
        addIssue(
          ["imagePrompt"],
          "Labeled graphics need a generated background image prompt.",
        );
      if (!block.markers.length)
        addIssue(["markers"], "Labeled graphics need at least one marker.");
      block.markers.forEach((marker, index) => {
        if (!marker.label.trim() || !marker.description.trim())
          addIssue(
            ["markers", index],
            "Each graphic marker needs a label and description.",
          );
      });
    }
    if (block.type === "chart") {
      if (!block.title.trim()) addIssue(["title"], "Charts need a title.");
      if (!block.chartFields.length)
        addIssue(["chartFields"], "Charts need at least one data field.");
      block.chartFields.forEach((field, index) => {
        if (!field.label.trim())
          addIssue(
            ["chartFields", index, "label"],
            "Each chart value needs a label.",
          );
      });
    }
  });

export const generatedCourseSeedSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(5_000),
    sections: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(160),
          lessons: z
            .array(
              z.object({
                title: z.string().trim().min(1).max(160),
                objective: z.string().trim().min(1).max(1_000),
                blocks: z.array(generatedBlockSeedSchema).min(1).max(500),
              }),
            )
            .min(1)
            .max(20),
        }),
      )
      .min(1)
      .max(10),
    lessonOverview: z
      .array(
        z.object({
          focus: z.string().trim().min(1).max(1_000),
          slideRange: z.string().max(80),
        }),
      )
      .max(500),
    keyTerms: z
      .array(
        z.object({
          term: z.string().trim().min(1).max(160),
          definition: z.string().trim().min(1).max(1_000),
        }),
      )
      .max(5),
    preTest: z.array(generatedAssessmentQuestionSchema).max(3),
    postTest: z.array(generatedAssessmentQuestionSchema).max(20),
    lessonSummary: z.string().trim().min(1).max(5_000),
    nextLesson: z.string().trim().min(1).max(160),
  })
  .superRefine((course, context) => {
    const lessonCount = course.sections.reduce(
      (total, section) => total + section.lessons.length,
      0,
    );
    if (lessonCount > 20) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "A generated course can contain at most 20 lessons at a time.",
      });
    }
    const imageCount = course.sections.reduce(
      (total, section) =>
        total +
        section.lessons.reduce(
          (lessonTotal, lesson) =>
            lessonTotal +
            lesson.blocks.reduce((blockTotal, block) => {
              if (
                (block.type === "image" || block.type === "labeledGraphic") &&
                block.imagePrompt.trim()
              )
                return blockTotal + 1;
              if (block.type === "flipCard")
                return (
                  blockTotal +
                  block.cards.reduce(
                    (cardTotal, card) =>
                      cardTotal +
                      Number(Boolean(card.frontImagePrompt.trim())) +
                      Number(Boolean(card.backImagePrompt.trim())),
                    0,
                  )
                );
              return blockTotal;
            }, 0),
          0,
        ),
      0,
    );
    if (imageCount > 8) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "A generated course can include at most eight AI images.",
      });
    }
  });

export type CourseGenerationInput = z.infer<typeof courseGenerationInputSchema>;
export type GeneratedSourceInventory = z.infer<
  typeof generatedSourceInventorySchema
>;
export type GeneratedCourseSeed = z.infer<typeof generatedCourseSeedSchema>;
export type GeneratedAssessmentQuestion = z.infer<
  typeof generatedAssessmentQuestionSchema
>;

export type GeneratedCourseDraft = {
  title: string;
  description: string;
  sections: { id: string; title: string; order: number }[];
  lessons: {
    id: string;
    sectionId: string;
    title: string;
    icon: "book" | "quiz";
    lessonType: "content" | "quiz";
    order: number;
    passingScore?: number;
    quizQuestions: import("@/lib/schemas/quiz").QuizQuestion[];
    blocks: import("@/lib/schemas/block").ContentBlock[];
  }[];
  template: CourseGenerationInput["template"];
  learningLessonCount: number;
  generatedImageCount: number;
  sourceCoverage?: SourceCoverageReport;
};

export type SourceCoverageStatus =
  | "preserved"
  | "partiallyPreserved"
  | "unresolved";
export type SourceCoverageReport = {
  complete: boolean;
  items: {
    sourcePageNumber: number;
    sourceElementId: string;
    sourceElementType: "text" | "code" | "visual";
    generatedLessonId: string | null;
    generatedBlockId: string | null;
    preservationStatus: SourceCoverageStatus;
    note?: string;
  }[];
};

export type SourceGenerationJobSnapshot = {
  jobId: string;
  status: string;
  fileName: string;
  sourcePageCount: number | null;
  sourceLanguage: string;
  summary: string;
  completedWorkUnits: number;
  totalWorkUnits: number;
  errorMessage: string | null;
  learnProgress?: { completedParts: number; totalParts: number };
  course?: GeneratedCourseDraft;
};
