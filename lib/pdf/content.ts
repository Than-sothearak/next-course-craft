import type { ContentBlock } from "@/lib/schemas/block";
import type { QuizQuestion } from "@/lib/schemas/quiz";

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    copy: "©",
    gt: ">",
    hellip: "…",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    reg: "®",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“",
    trade: "™",
  };

  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] !== "#") return namedEntities[name.toLowerCase()] ?? entity;
    const codePoint = name[1]?.toLowerCase() === "x"
      ? Number.parseInt(name.slice(2), 16)
      : Number.parseInt(name.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return "";
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return "";
    }
  });
}

export function htmlToHandoutText(value: string) {
  const text = value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi, (_match, doubleQuoted: string | undefined, singleQuoted: string | undefined) => ` [Image: ${doubleQuoted ?? singleQuoted ?? ""}] `)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n- ")
    .replace(/<\s*\/\s*li\s*>/gi, "")
    .replace(/<\s*\/\s*(?:p|div|h[1-6]|ul|ol|blockquote|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");

  return decodeHtmlEntities(text)
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}(?=- )/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function faceText(face: { type: "text"; text: string } | { type: "image"; alt: string }) {
  return face.type === "text" ? face.text : `[Image: ${face.alt}]`;
}

export function getHandoutBlockText(block: ContentBlock): string[] {
  switch (block.type) {
    case "heading":
      return [htmlToHandoutText(block.data.html || block.data.text)].filter(Boolean);
    case "richText":
      return [htmlToHandoutText(block.data.html)].filter(Boolean);
    case "image":
      return [
        block.data.title,
        block.data.alt ? `Image: ${block.data.alt}` : undefined,
        block.data.body,
        block.data.caption ? `Caption: ${block.data.caption}` : undefined,
      ].filter((value): value is string => Boolean(value?.trim()));
    case "gallery":
      return block.data.images.map((image, index) => `Image ${index + 1}: ${image.alt}`).filter(Boolean);
    case "video":
      return [block.data.captions ? `Video captions: ${block.data.captions}` : "Video content is available in the online course."];
    case "attachment":
      return [block.data.fileName ? `Attachment: ${block.data.fileName}` : "Attachment available in the online course."];
    case "link":
      return [block.data.label, block.data.description, `Link: ${block.data.url}`].filter((value) => Boolean(value.trim()));
    case "divider":
      return block.data.style === "continue" && block.data.label ? [block.data.label] : [];
    case "knowledgeCheck":
      return [
        `Knowledge check: ${block.data.question}`,
        ...block.data.options.map((option, index) => `${index + 1}. ${option}`),
      ];
    case "survey":
      return [
        `Survey: ${block.data.question}`,
        `Scale: ${block.data.minLabel} to ${block.data.maxLabel}`,
      ];
    case "statement":
      return [
        block.data.titleHtml ? htmlToHandoutText(block.data.titleHtml) : block.data.title,
        block.data.bodyHtml ? htmlToHandoutText(block.data.bodyHtml) : block.data.body,
      ].filter(Boolean);
    case "flipCard":
      return block.data.cards.flatMap((card, index) => [
        `Card ${index + 1}: ${card.frontLabel}`,
        faceText(card.front),
        `${card.backLabel}: ${faceText(card.back)}`,
      ]);
    case "accordion":
      return block.data.items.flatMap((item) => [item.title, htmlToHandoutText(item.body)]).filter(Boolean);
    case "labeledGraphic":
      if (block.data.interactionMode === "spotTarget")
        return [
          `Mini-game: ${block.data.challengePrompt ?? "Spot the clue"}`,
          `Scene: ${block.data.alt}`,
          "Complete the hotspot activity in the interactive course.",
        ];
      return [
        `Graphic: ${block.data.alt}`,
        ...block.data.markers.map((marker, index) => `${index + 1}. ${marker.label}: ${marker.description}`),
      ];
    case "processSteps":
      return block.data.steps.flatMap((step, index) => [`Step ${index + 1}: ${step.title}`, htmlToHandoutText(step.body)]).filter(Boolean);
    case "lessonMap":
      return [
        `Lesson map: ${{ modernCity: "Modern City", farmFields: "Farm Fields", cityProvince: "City Province", learningRoad: "Learning Road" }[block.data.template]}`,
        ...block.data.checkpoints.map((checkpoint, index) => `Checkpoint ${index + 1}: ${checkpoint.title}${checkpoint.description ? ` — ${checkpoint.description}` : ""}`),
        "Open the interactive course to follow the illustrated lesson map.",
      ];
    case "chart":
      return [
        block.data.title,
        block.data.description,
        ...block.data.fields.map((field) => `${field.label}: ${field.value}`),
      ].filter(Boolean);
  }
}

export function getQuizQuestionHandoutText(question: QuizQuestion, index: number) {
  return [
    `Question ${index + 1}: ${question.prompt}`,
    question.imageAlt ? `Image: ${question.imageAlt}` : undefined,
    ...question.choices.map((choice, choiceIndex) => `${choiceIndex + 1}. ${choice.text || choice.imageAlt || "[Image answer]"}`),
  ].filter((value): value is string => Boolean(value?.trim()));
}
