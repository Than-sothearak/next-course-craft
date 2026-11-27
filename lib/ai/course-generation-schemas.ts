import { z } from "zod";
import { codeLanguageValues, codeTemplateValues } from "../editor/code-example";
import { isSafeLinkHref } from "../editor/link-utils";
import {
  blockTypes,
  chartTypeSchema,
  imageLayoutSchema,
  statementStyleSchema,
  timelineStyleSchema,
} from "../schemas/block";
import { courseImageStyleSchema } from "./image-style";

const generatedNativeBlockTypes = [
  "heading",
  "richText",
  "formula",
  "table",
  "checklist",
  "image",
  "gallery",
  "video",
  "link",
  "divider",
  "knowledgeCheck",
  "survey",
  "statement",
  "flipCard",
  "accordion",
  "labeledGraphic",
  "conceptMap",
  "databaseSchema",
  "processSteps",
  "timeline",
  "chart",
] as const satisfies readonly (typeof blockTypes)[number][];

export const generatedStatementStyleValues = ["alert", "danger", "info", "success"] as const satisfies readonly z.infer<typeof statementStyleSchema>[];

export const generatedBlockTypeValues = [
  ...generatedNativeBlockTypes,
  "text",
  "code",
] as const;

export const courseBlockGenerationGuide = `CourseCraft block catalog and instructional design guide:

EXPLANATION AND STRUCTURE BLOCKS
- heading: reserve for a genuine standalone topic boundary with no accompanying explanation. When a title introduces paragraphs or bullets, use one richText block with title and body/bullets together instead of a separate heading block. Do not repeat the lesson title.
- richText (also the text intent): teaches through clear, concise paragraphs in body and unordered lists through bullets. Keep paragraphs to 2-4 sentences. Use bullets only for grouped facts, tips, and takeaways that have no meaningful order. For ordered procedures use the existing processSteps block, not bullets. Definitions, examples, worked reasoning, quotations, case studies, and short comparisons can use a clear heading and paragraphs in this block. Use the Title and paragraph template: put a meaningful heading in title and its explanation in body/bullets in the SAME block. Leave title empty only for untitled continuation paragraphs. A title alone is not an explanation.
- INLINE EMPHASIS: In every learner-facing field that supports rich formatting (richText title/body/bullets, heading titles, statement title/body, flipCard front/back text, accordion steps, processSteps, timeline items, and codeExample explanations), emphasize important words or short phrases inside the content itself—not only in keyTerms, titles, or headings. When a paragraph contains a key concept, domain term, cause-and-effect relationship, decision, or procedure, place 1–2 meaningful emphasis spans around those words in the paragraph; do the same inside substantive item explanations in other supported blocks. Leave short transitions and non-substantive text unformatted. Use ***keyword*** (three asterisks on each side) for a padded theme-colored keyword highlight, **bold** for bold text, or ==highlight== for an ordinary text highlight without padding. Use backticks only for inline code snippets, tags, identifiers or commands; ordinary keywords use ***keyword***. Keep emphasis tied to the meaning and source, and never use markers in raw code blocks, URLs, image prompts, or plain-only data fields. Do not use HTML tags to format prose; keep literal HTML examples inside backtick-delimited inline code.
- formula: use for a meaningful standalone mathematical relationship. Provide valid LaTeX, a short explanation, and an explanation for every variable below the equation. Preserve source notation and never invent a relationship or variable meaning.
- table: use for a factual structured comparison. Provide concise column headings and equally sized rows. Preserve exact source values and labels; never invent missing data.
- checklist: use for explicit assumptions, requirements, or verification steps grounded in the material. Items are informational and concise, not learner completion tracking.
- statement: highlights one concise takeaway or status message, with a title and body; never use it instead of the full explanation. For AI-generated statements, use only alert, danger, info, or success. Use info for a neutral takeaway or clarification, alert for a notice that needs attention, danger only for a clearly stated risk or harmful outcome, and success for a confirmed positive result or completed goal. Do not generate key, tip, warning, or centered styles; those remain available to authors in the editor. Choose semantic styles for the meaning of the text, never just for decoration.
- divider: separates substantial sections or gives learners a Continue control. dividerStyle is line, space, or continue. Use completionType none unless the author explicitly asks to require completion above it.

ACTIVE LEARNING BLOCKS
- knowledgeCheck: lets learners retrieve or apply an idea with one scored practice question. Provide question, 2–8 options, correctOptionIndex, and useful correct/incorrect feedback. Use for decisions, misconceptions, and quick checks.
- survey: a non-graded reflection or confidence check. Provide question plus minLabel and maxLabel; do not mark an answer correct.
- flipCard: supports active recall, vocabulary, question/answer practice, or matching a concept to an explanation, with 1–30 cards. Each face needs nonempty text (front/back) or a matching image prompt (frontImagePrompt/backImagePrompt). For image faces provide accessible alt text (frontImageAlt/backImageAlt); front/back text may also be provided as a fallback when images are disabled. Do not leave both the text and image prompt empty for either face. Do not repeat the template's automatically generated keyword cards.
- accordion: groups related details learners may want to reveal selectively; use 2–12 steps/items and layout accordion or tabs. Generated blocks use displayMode all so learners can open multiple items.
- processSteps: teaches a real ordered procedure with 2–20 steps. Give each step a title and explanation; do not use it for unrelated facts. Keep activityMode guided when learners follow an explanation; use ordering only when the learning objective asks learners to reconstruct or practise the source-supported sequence.
- timeline: presents 2–20 ordered historical events, milestones, or phases that are not an instructional procedure. For each event provide an optional short date/period label, a title, and a concise explanation. Use vertical, horizontal, or stacked style. Do not invent dates or chronology; use processSteps for instructions.

VISUAL AND DATA BLOCKS
- image: one useful generated supporting visual. Provide imagePrompt and accessible imageAlt. The application adds a separate full-width lesson cover when generated images are enabled. The cover uses a 1536x512 WebP source in a 1200x312 frame; course-mode instructions determine the supporting-image layout.
- gallery: presents 1–8 images. Use galleryImages only with image URLs explicitly present in the source; never invent image URLs.
- video: embeds a playable direct MP4/WebM source. Use videoSrc only when a direct video URL appears in the source, and provide videoMimeType and captions when available. Never invent a URL.
- audio: authors upload audio files manually after generation. Do not generate audio blocks or invent audio URLs.
- attachment: authors add uploaded files manually after generation. Do not generate attachment blocks or invent file download URLs.
- link: adds a resource button, card, or inline link only when the source explicitly includes its destination URL. Set linkUrl to that exact safe destination. Write linkLabel to tell learners what the referenced resource is or what they will reach, and linkDescription to briefly explain how it relates to the lesson using source-grounded information. Avoid generic labels such as "Click here" and never invent a destination or unsupported resource details.
- labeledGraphic: explains parts of a generated visual with 1–20 markers. Provide imagePrompt, imageAlt, and concise marker labels/descriptions with x/y positions from 0 to 100.
- conceptMap (Standard mode only): use for one supplied-material-supported central concept and 2–12 related concepts with explicit relationship labels. Keep supplied wording and connections; do not invent a network to decorate a lesson.
- chart: visualizes data actually present in the source. Choose bar, column, line, donut, or stacked; provide a title, optional description, and 1–20 labeled numeric fields. Never invent data.
- databaseSchema (Standard mode only): use only when the supplied lesson material explicitly presents a relational model with at least two named entities, their fields, and relationships with cardinality. Preserve its names and relationship endpoints. Do not infer conventional fields, key roles, nullability, relationships, or cardinality; explain incomplete models in richText instead. This block documents a schema and never executes queries.

CODE BLOCK
- code: preserves exact raw code in body, never Markdown fences. Use codeExample with template, language, and a complete paragraph explaining its purpose, important lines, and result. Templates: ${codeTemplateValues.join(", ")}. Explained templates place the explanation above or below the code. Choose consistently, follow author style requests, and leave title empty unless a meaningful example heading is needed. Code is stored in the editable richText block. Return codeExample null on other block types.

BLOCK CHOICE AND VARIETY
Teach with a purposeful mix: use richText for explanation, then select active-learning, visual, or data blocks when they help learners recall, decide, reflect, compare, follow a procedure, understand historical chronology, or interpret information. Prefer concise 2-4 sentence paragraphs, scannable lists, and helpful supporting visuals when they explain the subject clearly. For substantive lessons, include an appropriate learner-active block when the material supports one. Vary suitable interaction types across lessons instead of repeating the same interaction pattern throughout the course. Respect the requested interactivity level. Keep explanations alongside activities, preserve all meaningful source details, and never force an unsuitable interaction or invent facts, data, or media.

Interactivity levels: low means use interactions selectively; medium means include a suitable learner interaction in most substantive lessons; high means include at least one suitable learner interaction in each substantive lesson and vary the formats across the course. Apply these levels only where the source and learning goal support an activity.

For unused string/array fields return empty strings/arrays; for required settings use these neutral values: style info, headingLevel 3, correctOptionIndex 0, layout accordion, displayMode all, timelineStyle vertical, timelineItems [], activityMode guided, conceptMapCentralConcept "", conceptMapCentralExplanation "", conceptMapBranches [], databaseDescription "", databaseEntities [], databaseRelationships [], imageLayout full, dividerStyle continue, dividerCompletionType none, chartType bar, and chartColor #4f46e5. The application assigns block IDs and visual styling.`;

export const courseBlockLearnGuide = `BLOCKS (${generatedNativeBlockTypes.join(",")},text/code): richText explains; quiz/reflect/recall/group/procedure blocks have their purpose; timeline orders historical events; statement emphasizes; formula renders source LaTeX and explains variables; table compares source facts; checklist states grounded requirements; chart uses source data; conceptMap shows source-supported relationships in Standard mode; databaseSchema documents only a source-explicit relational model in Standard mode; media use source URLs. Keep titles with explanations; follow mode.

STATEMENT STYLE: AI-generated statements use only alert, danger, info, or success. Use info for a neutral takeaway, alert for an attention notice, danger only for a clear risk, and success for a confirmed positive result. Do not generate key, tip, warning, or centered styles. Choose by meaning, not decoration.

TEXT FORMATTING: In every text field supported by rich-text formatting, use ***keyword*** for padded theme-colored keywords, **bold** for bold text, or ==highlight== for an ordinary text highlight without padding on important words or short phrases within the explanatory paragraph or item body. Apply this to meaningful concepts, terms, causal relationships, decisions, and procedure details across richText, statement, heading, flipCard, accordion, processSteps, timeline, and codeExample explanation content; do not limit emphasis to titles or keyword cards. Keep formatting sparse and source-grounded. For links, use an exact source-provided URL and a clear learner-facing label and description based on the referenced resource and lesson context. Never invent a URL or resource facts.

BLOCK CHOICE AND VARIETY: choose by purpose; high, one interaction per lesson; medium, most; low, selective. Vary; no filler or invented data/media.`;

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

const courseGenerationInputBaseSchema = z.object({
  prompt: z.string().max(5_000),
  audience: z.string().max(300),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  lessonCount: z.number().int().min(1).max(20),
  template: z.enum(["custom", "preLearnPost"]),
  learnGroupingMode: learnGroupingModeSchema.default("smart"),
  slidesPerContent: z.number().int().min(1).max(500).default(5),
  targetLanguage: z.enum(["English", "Khmer"]).default("English"),
  contentDepth: z
    .enum(["concise", "detailed", "veryDetailed"])
    .default("detailed"),
  interactivity: z.enum(["low", "medium", "high"]).default("high"),
  postTestCount: z.number().int().min(1).max(20).default(5),
  standardMode: z.boolean().default(true),
  includeImages: z.boolean(),
  generateCoverImage: z.boolean().default(false),
  imageStyle: courseImageStyleSchema.default("auto"),
  customImageStyle: z.string().trim().max(240).default(""),
  coverImageStyle: courseImageStyleSchema.optional(),
  coverCustomImageStyle: z.string().trim().max(240).optional(),
  courseTitle: z.string().max(160),
  courseDescription: z.string().max(5_000),
  model: courseGenerationModelSchema.optional(),
});

export const courseGenerationInputSchema = courseGenerationInputBaseSchema
  .transform((input) => ({
    ...input,
    // Older saved sessions and clients used the lesson-image style for covers.
    // Preserve that choice when the new independent cover fields are absent.
    coverImageStyle: input.coverImageStyle ?? input.imageStyle,
    coverCustomImageStyle: input.coverCustomImageStyle ?? input.customImageStyle,
  }))
  .superRefine((input, context) => {
    if (input.includeImages && input.imageStyle === "custom" && !input.customImageStyle) {
      context.addIssue({ code: "custom", path: ["customImageStyle"], message: "Describe the custom image style." });
    }
    if (input.generateCoverImage && input.coverImageStyle === "custom" && !input.coverCustomImageStyle) {
      context.addIssue({ code: "custom", path: ["coverCustomImageStyle"], message: "Describe the custom cover image style." });
    }
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
    style: statementStyleSchema.default("info"),
    headingLevel: z.number().int().min(1).max(3).default(3),
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
    activityMode: z.enum(["guided", "ordering"]).default("guided"),
    timelineStyle: timelineStyleSchema.default("vertical"),
    timelineItems: z.array(z.object({
      label: z.string().max(120).default(""),
      title: z.string().max(160),
      body: z.string().max(5_000).default(""),
    })).max(500).default([]),
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
    linkUrl: z.string().max(2_048).default(""),
    linkLabel: z.string().max(200).default(""),
    linkDescription: z.string().max(1_000).default(""),
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
    conceptMapCentralConcept: z.string().max(160).default(""),
    conceptMapCentralExplanation: z.string().max(1_000).default(""),
    conceptMapBranches: z.array(z.object({
      relationship: z.string().max(80),
      concept: z.string().max(160),
      explanation: z.string().max(1_000).default(""),
    })).max(12).default([]),
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
    formulaLatex: z.string().max(5_000).default(""),
    formulaExplanation: z.string().max(5_000).default(""),
    formulaVariables: z.array(z.object({
      symbol: z.string().max(80),
      explanation: z.string().max(500),
    })).max(30).default([]),
    tableCaption: z.string().max(500).default(""),
    tableColumns: z.array(z.string().max(120)).max(8).default([]),
    tableRows: z.array(z.array(z.string().max(2_000)).max(8)).max(100).default([]),
    checklistItems: z.array(z.string().max(1_000)).max(30).default([]),
    databaseDescription: z.string().max(1_000).default(""),
    databaseEntities: z.array(z.object({
      name: z.string().trim().min(1).max(100),
      description: z.string().max(500).default(""),
      fields: z.array(z.object({
        name: z.string().trim().min(1).max(100),
        type: z.string().trim().min(1).max(80),
        nullable: z.boolean().default(false),
        keyType: z.enum(["", "primary", "foreign", "unique"]).default(""),
      })).min(1).max(20),
    })).max(8).default([]),
    databaseRelationships: z.array(z.object({
      fromEntity: z.string().trim().min(1).max(100),
      fromField: z.string().trim().min(1).max(100),
      toEntity: z.string().trim().min(1).max(100),
      toField: z.string().trim().min(1).max(100),
      label: z.string().trim().min(1).max(120),
      cardinality: z.enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]),
    })).max(16).default([]),
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
    if (block.type === "timeline") {
      if (block.timelineItems.length < 2)
        addIssue(["timelineItems"], "Timelines need at least two ordered events.");
      block.timelineItems.forEach((item, index) => {
        if (!item.title.trim() && !item.body.trim())
          addIssue(["timelineItems", index], "Each timeline event needs a title or explanation.");
      });
    }
    if (block.type === "flipCard") {
      if (!block.cards.length)
        addIssue(["cards"], "Flip cards need at least one card.");
      block.cards.forEach((card, index) => {
        if (!card.front.trim() && !card.frontImagePrompt.trim())
          addIssue(
            ["cards", index, "front"],
            "Each front face needs text or an image prompt.",
          );
        if (!card.back.trim() && !card.backImagePrompt.trim())
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
    if (block.type === "link" && !isSafeLinkHref(block.linkUrl))
      addIssue(["linkUrl"], "Link blocks need an explicit safe destination URL.");
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
    if (block.type === "formula" && !block.formulaLatex.trim())
      addIssue(["formulaLatex"], "Formula blocks need LaTeX source.");
    if (block.type === "table") {
      if (!block.tableColumns.length) addIssue(["tableColumns"], "Tables need at least one column.");
      if (!block.tableRows.length) addIssue(["tableRows"], "Tables need at least one row.");
      block.tableRows.forEach((row, index) => {
        if (row.length !== block.tableColumns.length)
          addIssue(["tableRows", index], "Every table row must match its column count.");
      });
    }
    if (block.type === "checklist" && !block.checklistItems.some((item) => item.trim()))
      addIssue(["checklistItems"], "Checklists need at least one item.");
    if (block.type === "conceptMap") {
      if (!block.conceptMapCentralConcept.trim())
        addIssue(["conceptMapCentralConcept"], "Concept maps need a source-supported central concept.");
      if (block.conceptMapBranches.length < 2)
        addIssue(["conceptMapBranches"], "Concept maps need at least two source-supported branches.");
      block.conceptMapBranches.forEach((branch, index) => {
        if (!branch.relationship.trim())
          addIssue(["conceptMapBranches", index, "relationship"], "Each concept-map branch needs an explicit relationship label.");
        if (!branch.concept.trim())
          addIssue(["conceptMapBranches", index, "concept"], "Each concept-map branch needs a related concept.");
      });
    }
    if (block.type === "databaseSchema") {
      const normalizeName = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase();
      const entityNames = new Set<string>();
      if (block.databaseEntities.length < 2)
        addIssue(["databaseEntities"], "Database schemas need at least two source-supported entities.");
      if (!block.databaseRelationships.length)
        addIssue(["databaseRelationships"], "Database schemas need at least one source-supported relationship.");
      block.databaseEntities.forEach((entity, entityIndex) => {
        const entityKey = normalizeName(entity.name);
        if (entityNames.has(entityKey))
          addIssue(["databaseEntities", entityIndex, "name"], "Entity names must be unique.");
        entityNames.add(entityKey);
        const fieldNames = new Set<string>();
        entity.fields.forEach((field, fieldIndex) => {
          const fieldKey = normalizeName(field.name);
          if (fieldNames.has(fieldKey))
            addIssue(["databaseEntities", entityIndex, "fields", fieldIndex, "name"], "Field names must be unique within an entity.");
          fieldNames.add(fieldKey);
        });
      });
      block.databaseRelationships.forEach((relationship, relationshipIndex) => {
        const from = block.databaseEntities.find((entity) => normalizeName(entity.name) === normalizeName(relationship.fromEntity));
        const to = block.databaseEntities.find((entity) => normalizeName(entity.name) === normalizeName(relationship.toEntity));
        if (!from)
          addIssue(["databaseRelationships", relationshipIndex, "fromEntity"], "Relationship source entity must exist in the schema.");
        else if (!from.fields.some((field) => normalizeName(field.name) === normalizeName(relationship.fromField)))
          addIssue(["databaseRelationships", relationshipIndex, "fromField"], "Relationship source field must exist in its entity.");
        if (!to)
          addIssue(["databaseRelationships", relationshipIndex, "toEntity"], "Relationship target entity must exist in the schema.");
        else if (!to.fields.some((field) => normalizeName(field.name) === normalizeName(relationship.toField)))
          addIssue(["databaseRelationships", relationshipIndex, "toField"], "Relationship target field must exist in its entity.");
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
    course.sections.forEach((section, sectionIndex) => section.lessons.forEach((lesson, lessonIndex) => {
      const imageCount = lesson.blocks.reduce((blockTotal, block) => {
        if ((block.type === "image" || block.type === "labeledGraphic") && block.imagePrompt.trim()) return blockTotal + 1;
        if (block.type === "flipCard") return blockTotal + block.cards.reduce((cardTotal, card) =>
          cardTotal + Number(Boolean(card.frontImagePrompt.trim())) + Number(Boolean(card.backImagePrompt.trim())), 0);
        return blockTotal;
      }, 0);
      if (imageCount > 8)
        context.addIssue({ code: "custom", path: ["sections", sectionIndex, "lessons", lessonIndex, "blocks"], message: "A lesson can include at most eight generated supporting images." });
    }));
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
  uncertainSourcePages?: number[];
  course?: GeneratedCourseDraft;
};
