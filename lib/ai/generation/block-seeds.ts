import { z } from "zod";
import { codeExamplePresets } from "@/lib/editor/code-example";
import { generatedBlockSeedSchema } from "../course-generation-schemas";

export function splitGeneratedBlockSeeds(
  blocks: z.infer<typeof generatedBlockSeedSchema>[],
) {
  const normalized: z.infer<typeof generatedBlockSeedSchema>[] = [];
  for (const block of blocks) {
    let split: z.infer<typeof generatedBlockSeedSchema>[] = [block];
    if (block.type === "heading" && (block.body.trim() || block.bullets.some((bullet) => bullet.trim()))) {
      split = [
        { ...block, body: "", bullets: [] },
        { ...block, type: "text", title: "" },
      ];
    } else if (block.type === "processSteps" && block.steps.length > 20) {
      split = chunkArray(block.steps, 20, 2).map((steps, index) => ({
        ...block,
        title: continuedTitle(block.title, index),
        steps,
      }));
    } else if (block.type === "accordion" && block.steps.length > 12) {
      split = chunkArray(block.steps, 12, 2).map((steps, index) => ({
        ...block,
        title: continuedTitle(block.title, index),
        steps,
      }));
    } else if (block.type === "flipCard" && block.cards.length > 30) {
      split = chunkArray(block.cards, 30, 1).map((cards, index) => ({
        ...block,
        title: continuedTitle(block.title, index),
        cards,
      }));
    } else if (block.type === "chart" && block.chartFields.length > 20) {
      split = chunkArray(block.chartFields, 20, 1).map((chartFields, index) => ({
        ...block,
        title: continuedTitle(block.title, index),
        chartFields,
      }));
    } else if (block.type === "labeledGraphic" && block.markers.length > 20) {
      const firstMarkers = block.markers.slice(0, 20);
      const extraMarkers = block.markers.slice(20);
      const markerText = extraMarkers.map((marker) =>
        `${marker.label}: ${marker.description} (${marker.x}%, ${marker.y}%)`,
      );
      split = [
        { ...block, markers: firstMarkers },
        ...chunkArray(markerText, 10, 1).map((markers, index) => ({
          ...emptyBlockSeed("text", block.sourceElementIds),
          title: continuedTitle("Additional graphic markers", index),
          body: markers.join("\n"),
        })),
      ];
    }
    for (const part of split.flatMap(splitLongBodyAndBullets)) {
      const previous = normalized.at(-1);
      const duplicateHeading = previous?.type === "heading"
        && ["text", "richText", "code"].includes(part.type)
        && previous.title.trim().toLocaleLowerCase() === part.title.trim().toLocaleLowerCase();
      normalized.push(duplicateHeading ? { ...part, title: "" } : part);
    }
  }
  return normalized.map((block) => generatedBlockSeedSchema.parse(block));
}

function chunkArray<T>(items: T[], max: number, min: number) {
  const chunks: T[][] = [];
  let offset = 0;
  while (items.length - offset > max) {
    const remainingAfterMax = items.length - offset - max;
    const size = remainingAfterMax > 0 && remainingAfterMax < min
      ? max - (min - remainingAfterMax)
      : max;
    chunks.push(items.slice(offset, offset + size));
    offset += size;
  }
  if (offset < items.length) chunks.push(items.slice(offset));
  return chunks;
}

function continuedTitle(title: string, chunkIndex: number) {
  return chunkIndex === 0 || !title.trim() ? title : `${title} (${chunkIndex + 1})`.slice(0, 500);
}

function emptyBlockSeed(
  type: z.infer<typeof generatedBlockSeedSchema>["type"],
  sourceElementIds: string[],
) {
  return generatedBlockSeedSchema.parse({
    sourceElementIds,
    type,
    title: "",
    body: "",
    bullets: [],
    style: "tip",
    headingLevel: 2,
    question: "",
    options: [],
    correctOptionIndex: 0,
    steps: [],
    cards: [],
    layout: "accordion",
    displayMode: "all",
    imageAlt: "",
    imagePrompt: "",
    imageLayout: "full",
    imageTitle: "",
    imageBody: "",
    galleryImages: [],
    videoSrc: "",
    videoMimeType: "",
    videoCaptions: "",
    linkUrl: "",
    linkLabel: "",
    linkDescription: "",
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
  });
}

function splitLongBodyAndBullets(
  block: z.infer<typeof generatedBlockSeedSchema>,
) {
  const chunkLimit = block.type === "code" ? 12_000 : 14_000;
  const bodyParts = splitAtLineBoundaries(block.body, chunkLimit);
  const bulletParts: string[][] = [];
  let currentBullets: string[] = [];
  let currentLength = 0;
  for (const bullet of block.bullets) {
    if (currentBullets.length && currentLength + bullet.length > 14_000) {
      bulletParts.push(currentBullets);
      currentBullets = [];
      currentLength = 0;
    }
    currentBullets.push(bullet);
    currentLength += bullet.length;
  }
  if (currentBullets.length) bulletParts.push(currentBullets);
  const count = Math.max(bodyParts.length, bulletParts.length, 1);
  if (count === 1) return [block];
  const explanationIndex = block.codeExample
    && codeExamplePresets.find((preset) => preset.id === block.codeExample?.template)?.explanationPosition === "above"
    ? 0 : count - 1;
  return Array.from({ length: count }, (_, index) => ({
    ...block,
    title: continuedTitle(block.title, index),
    body: bodyParts[index] ?? "",
    bullets: bulletParts[index] ?? [],
    ...(block.type === "code" && block.codeExample ? {
      codeExample: { ...block.codeExample, explanation: index === explanationIndex ? block.codeExample.explanation : "" },
    } : {}),
  }));
}

function splitAtLineBoundaries(value: string, max: number) {
  if (value.length <= max) return [value];
  const lines = value.match(/[^\n]*\n|[^\n]+$/g) ?? [value];
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (line.length > max) {
      if (current) chunks.push(current);
      current = "";
      const codePoints = Array.from(line);
      for (let offset = 0; offset < codePoints.length; offset += max)
        chunks.push(codePoints.slice(offset, offset + max).join(""));
    } else if (current.length + line.length > max) {
      chunks.push(current);
      current = line;
    } else {
      current += line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
