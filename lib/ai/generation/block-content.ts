import { randomUUID } from "node:crypto";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import { renderCodeExampleHtml } from "@/lib/editor/code-example";
import { type GeneratedAssessmentQuestion, type GeneratedCourseDraft, type GeneratedCourseSeed } from "../course-generation-schemas";
import { createGeneratedImageAsset, type GeneratedImageOptions } from "./images";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export function textHtml(
  title: string,
  body: string,
  bullets: string[],
  khmer = false,
) {
  const parts = [
    title.trim() ? `<h3>${escapeHtml(title.trim())}</h3>` : "",
    body.trim()
      ? body.trim().split(/\r?\n\s*\r?\n/).map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\r?\n/g, "<br />")}</p>`).join("")
      : "",
    bullets.filter((item) => item.trim()).length
      ? `<ul>${bullets
          .filter((item) => item.trim())
          .map((item) => `<li><p>${escapeHtml(item.trim())}</p></li>`)
          .join("")}</ul>`
      : "",
  ].filter(Boolean);
  return (
    parts.join("") ||
    `<p>${khmer ? "សូមពិនិត្យឡើងវិញនូវចំណុចសំខាន់ៗក្នុងមេរៀននេះ។" : "Review the key ideas in this lesson."}</p>`
  );
}

function customSummaryHtml(title: string, body: string, khmer = false) {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = lines.map((line) => line.match(/^[-*•]\s+(.+)$/)?.[1]);
  if (!lines.length || bullets.some((bullet) => !bullet))
    return textHtml(title, body, [], khmer);
  return `<h3>${escapeHtml(title.trim())}</h3><ul>${bullets.map((bullet) => `<li><p>${escapeHtml(bullet!)}</p></li>`).join("")}</ul>`;
}

export function needsContinueAfter(
  block: GeneratedCourseSeed["sections"][number]["lessons"][number]["blocks"][number],
) {
  if (["divider", "image", "gallery", "video", "link", "knowledgeCheck", "survey", "heading", "labeledGraphic"].includes(block.type)) return false;
  if (block.type === "code") {
    return block.body.length >= 700 || block.body.split("\n").length >= 14 || (block.codeExample?.explanation.length ?? 0) >= 850;
  }
  const contentLength = [
    block.body,
    block.imageBody,
    block.chartDescription,
    ...block.bullets,
    ...block.steps.flatMap((step) => [step.title, step.body]),
    ...block.timelineItems.flatMap((item) => [item.label, item.title, item.body]),
    ...block.cards.flatMap((card) => [card.front, card.back]),
    ...block.chartFields.map((field) => field.label),
    block.formulaLatex,
    block.formulaExplanation,
    ...block.formulaVariables.flatMap((variable) => [variable.symbol, variable.explanation]),
    block.tableCaption,
    ...block.tableColumns,
    ...block.tableRows.flat(),
    ...block.checklistItems,
  ].join("").length;
  return contentLength >= 850 || block.steps.length >= 6 || block.timelineItems.length >= 6 || block.chartFields.length >= 12;
}

export function continueBlock(khmer: boolean): ContentBlock {
  return blockSchema.parse({
    id: randomUUID(),
    version: 1,
    type: "divider",
    data: {
      style: "continue",
      label: khmer ? "បន្ត" : "Continue",
      completionType: "none",
    },
  });
}

export function removeTrailingContinueBlocks(blocks: ContentBlock[]) {
  const lastContentIndex = blocks.findLastIndex((block) => block.type !== "divider");
  return blocks.filter((block, index) => index <= lastContentIndex || block.type !== "divider" || block.data.style !== "continue");
}

function richTextBlock(html: string): ContentBlock {
  return blockSchema.parse({
    id: randomUUID(),
    version: 1,
    type: "richText",
    data: { html },
  });
}

function quizQuestion(
  question: GeneratedAssessmentQuestion,
  khmer = false,
): QuizQuestion {
  const choices = question.options.map((text) => ({
    id: randomUUID(),
    text,
    imageSrc: "",
    imageAlt: "",
  }));
  return {
    id: randomUUID(),
    prompt: question.question,
    imageSrc: "",
    imageAlt: "",
    selectionMode: "single",
    choices,
    correctChoiceIds: [choices[question.correctOptionIndex].id],
    correctFeedback:
      question.correctFeedback ||
      (khmer
        ? "ត្រឹមត្រូវ។ អ្នកយល់ចំណុចសំខាន់នេះហើយ។"
        : "Correct. You understand this key point."),
    incorrectFeedback:
      question.incorrectFeedback ||
      (khmer
        ? "សូមពិនិត្យមេរៀនឡើងវិញ រួចព្យាយាមម្ដងទៀត។"
        : "Review the lesson and try again."),
  };
}

function activityLesson(
  sectionId: string,
  title: string,
  order: number,
  blocks: ContentBlock[],
): GeneratedCourseDraft["lessons"][number] {
  return {
    id: randomUUID(),
    sectionId,
    title,
    icon: "book",
    lessonType: "content",
    order,
    quizQuestions: [],
    blocks,
  };
}

function quizActivityLesson(
  sectionId: string,
  title: string,
  order: number,
  questions: GeneratedAssessmentQuestion[],
  khmer = false,
): GeneratedCourseDraft["lessons"][number] {
  return {
    id: randomUUID(),
    sectionId,
    title,
    icon: "quiz",
    lessonType: "quiz",
    passingScore: 70,
    order,
    quizQuestions: questions.map((question) => quizQuestion(question, khmer)),
    blocks: [],
  };
}

export function buildPreLearnPostActivities(
  seed: GeneratedCourseSeed,
  learnSection: GeneratedCourseDraft["sections"][number],
  learnLessons: GeneratedCourseDraft["lessons"],
  khmer: boolean,
) {
  const labels = khmer
    ? {
        pre: "សកម្មភាពមុនរៀន",
        learn: "មេរៀន",
        post: "សកម្មភាពក្រោយរៀន",
        description: "ការពិពណ៌នាវគ្គសិក្សា",
        overview: "ទិដ្ឋភាពទូទៅនៃមេរៀន",
        sourcePages: "ទំព័រប្រភព",
        keyword: "ពាក្យគន្លឹះ",
        definition: "និយមន័យ",
        preTest: "តេស្តមុនរៀន",
        postTest: "តេស្តក្រោយរៀន",
        summary: "សេចក្តីសង្ខេបមេរៀន",
        next: "មេរៀនបន្ទាប់",
      }
    : {
        pre: "Pre activities",
        learn: "Learn",
        post: "Post activities",
        description: "Course description",
        overview: "Lesson overview",
        sourcePages: "Source pages",
        keyword: "Keyword",
        definition: "Definition",
        preTest: "Pre-test",
        postTest: "Post-test",
        summary: "Lesson summary",
        next: "Next lesson",
      };
  const preSection = { id: randomUUID(), title: labels.pre, order: 0 };
  const learn = { ...learnSection, title: labels.learn, order: 1 };
  const postSection = { id: randomUUID(), title: labels.post, order: 2 };
  const overview = `<ul>${learnLessons
    .map((lesson, index) => {
      const entry = seed.lessonOverview[index];
      const sourceRange = entry.slideRange.trim();
      return `<li><p><strong>${escapeHtml(lesson.title)}</strong></p><p>${escapeHtml(entry.focus)}</p>${sourceRange ? `<p>${labels.sourcePages}: ${escapeHtml(sourceRange)}</p>` : ""}</li>`;
    })
    .join("")}</ul>`;
  const keywordBlock = blockSchema.parse({
    id: randomUUID(),
    version: 1,
    type: "flipCard",
    width: "medium",
    data: {
      cards: seed.keyTerms.map(({ term, definition }) => ({
        id: randomUUID(),
        frontLabel: labels.keyword,
        front: { type: "text", text: term },
        backLabel: labels.definition,
        back: { type: "text", text: definition },
      })),
    },
  });
  const preLessons = [
    activityLesson(preSection.id, labels.description, 0, [
      richTextBlock(`<p>${escapeHtml(seed.description)}</p>`),
    ]),
    activityLesson(preSection.id, labels.overview, 1, [
      richTextBlock(overview),
    ]),
    activityLesson(preSection.id, labels.keyword, 2, [keywordBlock]),
    quizActivityLesson(preSection.id, labels.preTest, 3, seed.preTest, khmer),
  ];
  const postLessons = [
    quizActivityLesson(postSection.id, labels.postTest, 0, seed.postTest, khmer),
    activityLesson(postSection.id, labels.summary, 1, [
      richTextBlock(textHtml(labels.summary, seed.lessonSummary, [], khmer)),
    ]),
    activityLesson(postSection.id, labels.next, 2, [
      richTextBlock(textHtml(labels.next, seed.nextLesson, [], khmer)),
    ]),
  ];
  return {
    sections: [preSection, learn, postSection],
    lessons: [
      ...preLessons,
      ...learnLessons.map((lesson, order) => ({
        ...lesson,
        sectionId: learn.id,
        order,
      })),
      ...postLessons,
    ],
  };
}

export function addCustomTemplateCourseActivities(
  seed: GeneratedCourseSeed,
  sections: GeneratedCourseDraft["sections"],
  lessons: GeneratedCourseDraft["lessons"],
  khmer: boolean,
  courseOverview?: { title: string; focus: string; slideRange?: string }[],
) {
  const labels = khmer
    ? { summary: "សេចក្តីសង្ខេបមេរៀន", next: "មេរៀនបន្ទាប់" }
    : { summary: "Lesson summary", next: "Next lesson" };
  const firstLessonCourse = addCustomTemplateFirstLessonActivities(seed, sections, lessons, khmer, courseOverview);
  const orderedLessons = firstLessonCourse.lessons;
  const lastSectionId = firstLessonCourse.sections.at(-1)?.id;
  const lastLesson = [...orderedLessons].reverse().find((lesson) => lesson.sectionId === lastSectionId);
  if (!lastLesson) return firstLessonCourse;

  const metadataBlocks = (title: string, body: string) => [
    richTextBlock(customSummaryHtml(title, body, khmer)),
    ...(body.trim().length >= 850 ? [continueBlock(khmer)] : []),
  ];
  lastLesson.blocks.push(
    ...metadataBlocks(labels.summary, seed.lessonSummary),
    ...metadataBlocks(labels.next, seed.nextLesson),
  );
  return { sections: firstLessonCourse.sections, lessons: orderedLessons };
}

export function addCustomTemplateFirstLessonActivities(
  seed: GeneratedCourseSeed,
  sections: GeneratedCourseDraft["sections"],
  lessons: GeneratedCourseDraft["lessons"],
  khmer: boolean,
  courseOverview?: { title: string; focus: string; slideRange?: string }[],
) {
  const labels = khmer
    ? {
        description: "ការពិពណ៌នាវគ្គសិក្ស",
        overview: "ទិដ្ឋភាពទូទៅនៃមេរៀន",
        objective: "គោលបំណងមេរៀន",
        keyword: "ពាក្យគន្លឹះ",
        definition: "និយមន័យ",
      }
    : {
        description: "Course description",
        overview: "Lesson overview",
        objective: "Lesson objective",
        keyword: "Keywords",
        definition: "Definition",
      };
  const orderedLessons = lessons.map((lesson) => ({
    ...lesson,
    blocks: [...lesson.blocks],
  }));
  const firstSectionId = sections[0]?.id;
  const lastSectionId = sections.at(-1)?.id;
  const firstLesson = orderedLessons.find(
    (lesson) => lesson.sectionId === firstSectionId,
  );
  if (!firstLesson) return { sections, lessons };

  const firstSeedLesson = seed.sections.flatMap((section) => section.lessons)[0];
  const overviewItems = courseOverview ?? seed.sections.flatMap((section) => section.lessons).map((lesson, index) => ({
    title: lesson.title,
    focus: seed.lessonOverview[index]?.focus || lesson.objective,
    slideRange: seed.lessonOverview[index]?.slideRange || "",
  }));
  const overviewHtml = `<ul>${overviewItems.map((item) => {
    const slideRange = item.slideRange?.trim();
    return `<li><p><strong>${escapeHtml(item.title)}</strong></p><p>${escapeHtml(item.focus)}</p>${slideRange ? `<p>${khmer ? "ទំព័រប្រភព" : "Source pages"}: ${escapeHtml(slideRange)}</p>` : ""}</li>`;
  }).join("")}</ul>`;
  const metadataBlocks: ContentBlock[] = [
    richTextBlock(textHtml(labels.description, seed.description, [], khmer)),
    ...(overviewItems.length ? [richTextBlock(`<h3>${escapeHtml(labels.overview)}</h3>${overviewHtml}`)] : []),
    ...(firstSeedLesson?.objective ? [richTextBlock(textHtml(labels.objective, firstSeedLesson.objective, [], khmer))] : []),
  ];
  if (seed.keyTerms.length) {
    metadataBlocks.push(blockSchema.parse({
      id: randomUUID(),
      version: 1,
      type: "flipCard",
      width: "medium",
      data: {
        cards: seed.keyTerms.map(({ term, definition }) => ({
          id: randomUUID(),
          frontLabel: labels.keyword,
          front: { type: "text", text: term },
          backLabel: labels.definition,
          back: { type: "text", text: definition },
        })),
      },
    }));
  }
  const coverIndex = firstLesson.blocks[0]?.type === "image" && firstLesson.blocks[0].data.imageAspectRatio === "50/13" ? 1 : 0;
  firstLesson.blocks.splice(coverIndex, 0, ...metadataBlocks);
  const quickQuiz = seed.preTest[0];
  if (quickQuiz) firstLesson.blocks.push(blockSchema.parse({
    id: randomUUID(),
    version: 1,
    type: "knowledgeCheck",
    data: {
      question: quickQuiz.question,
      options: quickQuiz.options,
      correctOptionIndex: quickQuiz.correctOptionIndex,
      correctFeedback: quickQuiz.correctFeedback || (khmer ? "ត្រឹមត្រូវ។" : "Correct."),
      incorrectFeedback: quickQuiz.incorrectFeedback || (khmer ? "សូមពិនិត្យមេរៀនឡើងវិញ រួចព្យាយាមម្ដងទៀត។" : "Review the lesson and try again."),
    },
  }));
  return { sections, lessons: orderedLessons };
}

export async function toLessonCoverBlock(
  ownerId: string,
  courseId: string,
  courseTitle: string,
  lessonTitle: string,
  objective: string,
  registerGeneratedAsset: (assetId: string) => void,
  imageOptions: Pick<GeneratedImageOptions, "imageStyle" | "customImageStyle"> = {},
) {
  const generatedImage = await createGeneratedImageAsset(
    ownerId,
    courseId,
    `Landscape cover artwork for the lesson “${lessonTitle}” in the course “${courseTitle}”. Show a clear visual that represents this learning objective: ${objective}. Keep the composition uncluttered and leave comfortable space around the main subject.`,
    { ...imageOptions, purpose: "lesson-cover" },
  );
  registerGeneratedAsset(generatedImage.id);
  return blockSchema.parse({
    id: randomUUID(),
    version: 1,
    type: "image",
    width: "full",
    widthCustom: false,
    blockPadding: 0,
    data: {
      src: generatedImage.src,
      alt: `${lessonTitle} lesson cover`,
      layout: "cover",
      imageFit: "cover",
      imageAspectRatio: "50/13",
      coverOverlayOpacity: 0,
    },
  });
}

export async function toContentBlock(
  seed: GeneratedCourseSeed["sections"][number]["lessons"][number]["blocks"][number],
  ownerId: string,
  courseId: string,
  includeImages: boolean,
  khmer: boolean,
  registerGeneratedAsset: (assetId: string) => void,
  imageOptions: Pick<GeneratedImageOptions, "imageStyle" | "customImageStyle"> = {},
): Promise<{ block: ContentBlock; generatedImage: boolean; assetId?: string }> {
  const id = randomUUID();
  const base = { id, version: 1 as const };
  if (seed.type === "formula") {
    return {
      block: blockSchema.parse({ ...base, type: "formula", width: "medium", data: {
        title: seed.title.trim(),
        latex: seed.formulaLatex.trim(),
        explanation: seed.formulaExplanation.trim(),
        variables: seed.formulaVariables.map(({ symbol, explanation }) => ({ symbol: symbol.trim(), explanation: explanation.trim() })),
      } }),
      generatedImage: false,
    };
  }
  if (seed.type === "table") {
    return {
      block: blockSchema.parse({ ...base, type: "table", width: "medium", data: {
        caption: seed.tableCaption.trim(),
        columns: seed.tableColumns.map((column) => column.trim()),
        rows: seed.tableRows.map((row) => row.map((cell) => cell.trim())),
      } }),
      generatedImage: false,
    };
  }
  if (seed.type === "checklist") {
    return {
      block: blockSchema.parse({ ...base, type: "checklist", data: {
        title: seed.title.trim(),
        items: seed.checklistItems.map((item) => item.trim()).filter(Boolean),
      } }),
      generatedImage: false,
    };
  }
  if (
    seed.type === "image" &&
    includeImages &&
    seed.imagePrompt.trim()
  ) {
    const generatedImage = await createGeneratedImageAsset(
      ownerId,
      courseId,
      seed.imagePrompt.trim(),
      imageOptions,
    );
    registerGeneratedAsset(generatedImage.id);
    return {
      block: blockSchema.parse({
        ...base,
        type: "image",
        width: "small",
        blockPadding: 16,
        data: {
          src: generatedImage.src,
          alt:
            seed.imageAlt.trim() || seed.title.trim() || (khmer ? "រូបភាពបង្ហាញមេរៀន" : "Course illustration"),
          caption: seed.title.trim() || undefined,
          layout: seed.imageLayout,
          title: seed.imageTitle.trim() || undefined,
          body: seed.imageBody.trim() || undefined,
        },
      }),
      generatedImage: true,
      assetId: generatedImage.id,
    };
  }
  if (seed.type === "heading") {
    return {
      block: blockSchema.parse({
        ...base,
        type: "heading",
        data: { text: seed.title.trim(), level: seed.headingLevel },
      }),
      generatedImage: false,
    };
  }
  if (seed.type === "gallery" && seed.galleryImages.length) {
    return {
      block: blockSchema.parse({
        ...base,
        type: "gallery",
        data: { images: seed.galleryImages },
      }),
      generatedImage: false,
    };
  }
  if (seed.type === "video" && seed.videoSrc.trim()) {
    return {
      block: blockSchema.parse({
        ...base,
        type: "video",
        data: {
          src: seed.videoSrc.trim(),
          mimeType: seed.videoMimeType || undefined,
          captions: seed.videoCaptions.trim() || undefined,
        },
      }),
      generatedImage: false,
    };
  }
  if (seed.type === "link" && seed.linkUrl.trim()) {
    return {
      block: blockSchema.parse({
        ...base,
        type: "link",
        data: {
          label: seed.linkLabel.trim() || seed.title.trim() || "Open resource",
          url: seed.linkUrl.trim(),
          description: seed.linkDescription.trim() || seed.body.trim(),
          style: "button",
          openInNewTab: true,
        },
      }),
      generatedImage: false,
    };
  }
  if (seed.type === "statement") {
    return {
      block: blockSchema.parse({
        ...base,
        type: "statement",
        data: {
          style: seed.style,
          title: seed.title.trim() || (khmer ? "ចំណុចសំខាន់" : "Key takeaway"),
          body: seed.body.trim() || seed.bullets.join(" "),
        },
      }),
      generatedImage: false,
    };
  }
  if (seed.type === "survey") {
    return {
      block: blockSchema.parse({
        ...base,
        type: "survey",
        data: {
          question: seed.question.trim(),
          minLabel: seed.minLabel.trim(),
          maxLabel: seed.maxLabel.trim(),
        },
      }),
      generatedImage: false,
    };
  }
  if (seed.type === "knowledgeCheck") {
    const options = seed.options.map((option) => option.trim()).filter(Boolean);
    if (
      seed.question.trim() &&
      options.length >= 2 &&
      seed.correctOptionIndex < options.length
    ) {
      return {
        block: blockSchema.parse({
          ...base,
          type: "knowledgeCheck",
          data: {
            question: seed.question.trim(),
            options,
            correctOptionIndex: seed.correctOptionIndex,
            correctFeedback: seed.correctFeedback.trim() ||
              (khmer
                ? "ត្រឹមត្រូវ។ អ្នកយល់ចំណុចសំខាន់នេះហើយ។"
                : "Correct. You understand this key point."),
            incorrectFeedback: seed.incorrectFeedback.trim() ||
              (khmer
                ? "សូមពិនិត្យមេរៀនឡើងវិញ រួចព្យាយាមម្ដងទៀត។"
                : "Review the lesson and try again."),
          },
        }),
        generatedImage: false,
      };
    }
  }
  if (seed.type === "processSteps") {
    const steps = seed.steps
      .filter((step) => step.title.trim() && step.body.trim())
      .map((step) => ({
        id: randomUUID(),
        title: step.title.trim(),
        body: step.body.trim(),
      }));
    if (steps.length >= 2) {
      return {
        block: blockSchema.parse({
          ...base,
          type: "processSteps",
          width: "full",
          data: { style: "slider", steps },
        }),
        generatedImage: false,
      };
    }
  }
  if (seed.type === "timeline") {
    const items = seed.timelineItems
      .filter((item) => item.title.trim() || item.body.trim())
      .map((item) => ({
        id: randomUUID(),
        label: item.label.trim(),
        title: item.title.trim(),
        body: item.body.trim(),
      }));
    if (items.length >= 2 && items.length <= 20) {
      return {
        block: blockSchema.parse({
          ...base,
          type: "timeline",
          data: { style: seed.timelineStyle, items },
        }),
        generatedImage: false,
      };
    }
  }
  if (seed.type === "flipCard") {
    const cards = [];
    for (const card of seed.cards) {
      const createFace = async (
        text: string,
        prompt: string,
        alt: string,
      ) => {
        if (includeImages && prompt.trim()) {
          const generatedImage = await createGeneratedImageAsset(
            ownerId,
            courseId,
            prompt.trim(),
            imageOptions,
          );
          registerGeneratedAsset(generatedImage.id);
          return {
            type: "image" as const,
            src: generatedImage.src,
            alt: alt.trim() || text.trim() || (khmer ? "រូបភាពក្នុងកាត" : "Flip card image"),
          };
        }
        const fallbackText = text.trim() || alt.trim();
        return fallbackText ? { type: "text" as const, text: fallbackText } : null;
      };
      const front = await createFace(card.front, card.frontImagePrompt, card.frontImageAlt);
      const back = await createFace(card.back, card.backImagePrompt, card.backImageAlt);
      if (!front || !back) continue;
      cards.push({
        id: randomUUID(),
        frontLabel: khmer ? "សំណួរ" : "Prompt",
        front,
        backLabel: khmer ? "ចម្លើយ" : "Answer",
        back,
      });
    }
    if (cards.length) {
      return {
        block: blockSchema.parse({
          ...base,
          type: "flipCard",
          width: "medium",
          data: { cards },
        }),
        generatedImage: false,
      };
    }
  }
  if (seed.type === "accordion") {
    const items = seed.steps
      .filter((step) => step.title.trim() && step.body.trim())
      .map((step) => ({
        id: randomUUID(),
        title: step.title.trim(),
        body: step.body.trim(),
      }));
    if (items.length >= 2) {
      return {
        block: blockSchema.parse({
          ...base,
          type: "accordion",
          data: { layout: seed.layout, displayMode: seed.displayMode, items },
        }),
        generatedImage: false,
      };
    }
  }
  if (seed.type === "divider") {
    return {
      block: blockSchema.parse({
        ...base,
        type: "divider",
        data: {
          style: seed.dividerStyle,
          label: khmer && (!seed.dividerLabel.trim() || seed.dividerLabel.trim() === "Continue")
            ? "បន្ត"
            : seed.dividerLabel.trim() || "Continue",
          completionType: seed.dividerCompletionType,
        },
      }),
      generatedImage: false,
    };
  }
  if (seed.type === "labeledGraphic" && includeImages && seed.imagePrompt.trim()) {
    const generatedImage = await createGeneratedImageAsset(
      ownerId,
      courseId,
      seed.imagePrompt.trim(),
      imageOptions,
    );
    registerGeneratedAsset(generatedImage.id);
    return {
      block: blockSchema.parse({
        ...base,
        type: "labeledGraphic",
        width: "full",
        data: {
          src: generatedImage.src,
          alt: seed.imageAlt.trim() || seed.title.trim() || (khmer ? "ក្រាហ្វិកដែលមានស្លាក" : "Labeled course graphic"),
          markerColor: seed.markerColor || undefined,
          textColor: seed.textColor || undefined,
          radarColor: seed.radarColor || undefined,
          markers: seed.markers.map((marker) => ({
            id: randomUUID(),
            label: marker.label.trim(),
            description: marker.description.trim(),
            x: marker.x,
            y: marker.y,
            color: marker.color || undefined,
          })),
        },
      }),
      generatedImage: true,
      assetId: generatedImage.id,
    };
  }
  if (seed.type === "chart") {
    return {
      block: blockSchema.parse({
        ...base,
        type: "chart",
        data: {
          chartType: seed.chartType,
          title: seed.title.trim(),
          description: seed.chartDescription.trim(),
          color: seed.chartColor,
          fields: seed.chartFields.map((field) => ({ id: randomUUID(), ...field })),
        },
      }),
      generatedImage: false,
    };
  }
  if (seed.type === "code") {
    if (seed.codeExample) {
      return {
        block: blockSchema.parse({
          ...base,
          type: "richText",
          data: { html: renderCodeExampleHtml({ title: seed.title, code: seed.body, ...seed.codeExample }) },
        }),
        generatedImage: false,
      };
    }
    const title = seed.title.trim()
      ? `<h3>${escapeHtml(seed.title.trim())}</h3>`
      : "";
    const code = seed.body.trim() ? seed.body : seed.bullets.join("\n");
    return {
      block: blockSchema.parse({
        ...base,
        type: "richText",
        data: { html: `${title}<pre><code>${escapeHtml(code)}</code></pre>` },
      }),
      generatedImage: false,
    };
  }
  return {
    block: blockSchema.parse({
      ...base,
      type: "richText",
      data: { html: textHtml(seed.title, seed.body, seed.bullets, khmer) },
    }),
    generatedImage: false,
  };
}
