import {
  defaultBlockPadding,
  defaultBlockWidth,
  type ContentBlock,
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
    return [{ ...base, type: "flipCard", data: template.flipCard }];
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
          ? { lineWeight: 1, lineColor: "#cbd5e1", lineStyle: "solid" as const }
          : {}),
      },
    },
  ];
}
