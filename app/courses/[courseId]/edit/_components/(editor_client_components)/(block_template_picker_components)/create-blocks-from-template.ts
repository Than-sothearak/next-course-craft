import { createClientId } from "@/lib/client-id";
import {
  defaultBlockPadding,
  defaultBlockWidth,
  type ContentBlock,
  interactionButtonBlockSchema,
  audioInstructionBlockSchema,
} from "@/lib/schemas/block";
import type { BlockTemplate } from "./block-template-data";

function commonBlock(id: string, type: ContentBlock["type"]) {
  return {
    id,
    version: 1 as const,
    width: defaultBlockWidth(type),
    widthCustom: false,
    backgroundColor: "#ffffff",
    blockPadding: defaultBlockPadding(type),
  };
}

export function createBlocksFromTemplate(
  template: BlockTemplate,
  id: string,
  courseTargets?: {
    sections: { id: string; title: string; order: number }[];
    lessons: { id: string; title: string; sectionId: string; order: number }[];
  },
): ContentBlock[] {
  const isLineDivider =
    template.type === "divider" && (template.dividerStyle ?? "line") === "line";
  const base = {
    ...commonBlock(id, template.type),
    ...(isLineDivider ? { width: "full" as const, blockPadding: 60 } : {}),
    ...(template.type === "divider" && template.dividerStyle === "continue"
      ? { blockPadding: 100 }
      : {}),
    ...(template.width ? { width: template.width } : {}),
  };
  if (template.type === "audioInstruction") return [audioInstructionBlockSchema.parse({ ...base, type: "audioInstruction", data: { src: "" } })];
  if (template.type === "interactionButton") return [interactionButtonBlockSchema.parse({ ...base, type: "interactionButton", data: { ...template.interactionButton, popup: template.interactionButton?.popup ?? { blocks: [{ id: createClientId(), type: "richText", version: 1, data: { html: "<p>Add your explanation here.</p>" }, slideFrame: { x: 8, y: 8, width: 84, height: 75, z: 0 } }] } } })];
  if (template.type === "knowledgeCheck") {
    if (!template.knowledgeCheck)
      throw new Error(
        `Knowledge check template "${template.id}" is missing its content.`,
      );
    return [{ ...base, type: "knowledgeCheck", data: template.knowledgeCheck }];
  }
  if (template.type === "survey") {
    if (!template.survey)
      throw new Error(
        `Survey template "${template.id}" is missing its content.`,
      );
    return [{ ...base, type: "survey", data: template.survey }];
  }
  if (template.type === "flipCard") {
    if (!template.flipCard)
      throw new Error(
        `Flip card template "${template.id}" is missing its content.`,
      );
    return [{
      ...base,
      type: "flipCard",
      data: {
        ...template.flipCard,
        cardsPerRow: template.flipCard.cardsPerRow ?? 3,
        cardStyle: template.flipCard.cardStyle ?? "classic",
        cardBackgroundColor: template.flipCard.cardBackgroundColor ?? "#ffffff",
        cardTextColor: template.flipCard.cardTextColor ?? "#0f172a",
      },
    }];
  }
  if (template.type === "accordion") {
    if (!template.accordion)
      throw new Error(
        `Accordion template "${template.id}" is missing its content.`,
      );
    return [{ ...base, type: "accordion", data: template.accordion }];
  }
  if (template.type === "labeledGraphic") {
    if (!template.labeledGraphic)
      throw new Error(
        `Labeled graphic template "${template.id}" is missing its content.`,
      );
    return [{ ...base, type: "labeledGraphic", data: template.labeledGraphic }];
  }
  if (template.type === "lessonMap") {
    if (!template.lessonMap)
      throw new Error(`Lesson map template "${template.id}" is missing its data.`);
    const orderedLessons = [...(courseTargets?.lessons ?? [])].sort((a, b) => {
      const sectionOrder = (courseTargets?.sections.findIndex((section) => section.id === a.sectionId) ?? 0) -
        (courseTargets?.sections.findIndex((section) => section.id === b.sectionId) ?? 0);
      return sectionOrder || a.order - b.order;
    });
    return [{
      ...base,
      type: "lessonMap",
      data: {
        ...template.lessonMap,
        checkpoints: template.lessonMap.checkpoints.map((checkpoint, index) => ({
          ...checkpoint,
          id: createClientId(),
          targetId: orderedLessons[Math.min(index, orderedLessons.length - 1)]?.id ?? "",
        })),
      },
    }];
  }
  if (template.type === "processSteps") {
    if (!template.processSteps)
      throw new Error(
        `Process steps template "${template.id}" is missing its content.`,
      );
    return [{ ...base, type: "processSteps", data: template.processSteps }];
  }
  if (template.type === "chart") {
    if (!template.chart)
      throw new Error(`Chart template "${template.id}" is missing its data.`);
    return [{ ...base, type: "chart", data: template.chart }];
  }
  if (template.type === "link") {
    if (!template.link)
      throw new Error(`Link template "${template.id}" is missing its content.`);
    return [{ ...base, type: "link", data: template.link }];
  }
  if (template.type === "statement") {
    if (!template.statement) {
      throw new Error(
        `Statement template "${template.id}" is missing its content.`,
      );
    }
    return [{ ...base, type: "statement", data: template.statement }];
  }
  if (template.type === "richText")
    return [
      { ...base, type: "richText", data: { html: template.html ?? "<p></p>" } },
    ];
  if (template.type === "image")
    return [
      {
        ...base,
        type: "image",
        data: {
          src: "https://placehold.co/1200x675?text=Add+an+image",
          alt: "",
          ...(template.imageLayout === "full" ? { caption: "" } : {}),
          ...(template.imageLayout ? { layout: template.imageLayout } : {}),
          ...(template.imageTitle ? { title: template.imageTitle } : {}),
          ...(template.imageBody ? { body: template.imageBody } : {}),
        },
      },
    ];
  if (template.type === "audio")
    return [{ ...base, type: "audio", data: { src: "", fileName: "" } }];
  if (template.type === "attachment")
    return [{ ...base, type: "attachment", data: { src: "", fileName: "", size: 0 } }];
  if (template.type === "gallery")
    return [
      {
        ...base,
        type: "gallery",
        data: {
          images: [1, 2, 3].map((number) => ({
            src: `https://placehold.co/480x360?text=Image+${number}`,
            alt: `Gallery image ${number}`,
          })),
        },
      },
    ];
  if (template.type === "video")
    return [
      {
        ...base,
        type: "video",
        data: { src: "https://www.youtube.com/watch?v=", captions: "" },
      },
    ];
  return [
    {
      ...base,
      type: "divider",
      data: {
        style: template.dividerStyle ?? "line",
        label: template.dividerLabel ?? "Continue",
        completionType: template.dividerCompletionType ?? "none",
        ...(isLineDivider
          ? {
              lineWeight: template.dividerLineWeight ?? 1,
              lineColor: template.dividerLineColor ?? "#cbd5e1",
              lineStyle: template.dividerLineStyle ?? "solid",
            }
          : {}),
      },
    },
  ];
}
