import { randomUUID } from "node:crypto";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import { renderCodeExampleHtml } from "@/lib/editor/code-example";
import { type GeneratedAssessmentQuestion, type GeneratedCourseDraft, type GeneratedCourseSeed } from "../course-generation-schemas";
import { createGeneratedImageAsset } from "./images";

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
    title.trim() ? `<h2>${escapeHtml(title.trim())}</h2>` : "",
    body.trim()
      ? `<p>${escapeHtml(body.trim()).replace(/\n/g, "<br />")}</p>`
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
    ...block.cards.flatMap((card) => [card.front, card.back]),
    ...block.chartFields.map((field) => field.label),
  ].join("").length;
  return contentLength >= 850 || block.steps.length >= 6 || block.chartFields.length >= 12;
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
    width: "full",
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
) {
  const labels = khmer
    ? {
        description: "ការពិពណ៌នាវគ្គសិក្សា",
        summary: "សេចក្តីសង្ខេបមេរៀន",
        next: "មេរៀនបន្ទាប់",
      }
    : {
        description: "Course description",
        summary: "Lesson summary",
        next: "Next lesson",
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
  const lastLesson = [...orderedLessons].reverse().find(
    (lesson) => lesson.sectionId === lastSectionId,
  );
  if (!firstLesson || !lastLesson) return { sections, lessons };

  const metadataBlocks = (title: string, body: string) => [
    richTextBlock(textHtml(title, body, [], khmer)),
    ...(body.trim().length >= 850 ? [continueBlock(khmer)] : []),
  ];
  firstLesson.blocks.unshift(
    ...metadataBlocks(labels.description, seed.description),
  );
  lastLesson.blocks.push(
    ...metadataBlocks(labels.summary, seed.lessonSummary),
    ...metadataBlocks(labels.next, seed.nextLesson),
  );
  return { sections, lessons: orderedLessons };
}

export async function toContentBlock(
  seed: GeneratedCourseSeed["sections"][number]["lessons"][number]["blocks"][number],
  ownerId: string,
  courseId: string,
  includeImages: boolean,
  khmer: boolean,
  registerGeneratedAsset: (assetId: string) => void,
): Promise<{ block: ContentBlock; generatedImage: boolean; assetId?: string }> {
  const id = randomUUID();
  const base = { id, version: 1 as const };
  if (
    seed.type === "image" &&
    includeImages &&
    seed.imagePrompt.trim()
  ) {
    const generatedImage = await createGeneratedImageAsset(
      ownerId,
      courseId,
      seed.imagePrompt.trim(),
    );
    registerGeneratedAsset(generatedImage.id);
    return {
      block: blockSchema.parse({
        ...base,
        type: "image",
        width: "medium",
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
          data: { steps },
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
          width: "full",
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
      ? `<h2>${escapeHtml(seed.title.trim())}</h2>`
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
