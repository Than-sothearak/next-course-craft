import { z } from "zod";
import { generatedBlockSeedSchema, type GeneratedSourceInventory, type GeneratedCourseSeed, type SourceCoverageReport } from "../course-generation-schemas";
import { generatedLearnItemSchema } from "./response-schemas";
import type { SourceCoursePlan } from "./types";
import { normalizeSourceRange } from "./source-ranges";

export function sourceIdsForRange(inventory: GeneratedSourceInventory, startPage: number, endPage: number) {
  return inventory.pages
    .filter((page) => page.pageNumber >= startPage && page.pageNumber <= endPage)
    .flatMap((page) => page.elements.map((element) => element.sourceElementId));
}

export function validateLearnItemCoverage(
  lesson: z.infer<typeof generatedLearnItemSchema>,
  pages: GeneratedSourceInventory["pages"],
) {
  const issues: string[] = [];
  const allIds = new Set(lesson.blocks.flatMap((block) => block.sourceElementIds));
  const generatedText = lesson.blocks.map(generatedBlockSearchText).join("\n");
  const normalizedNumbers = normalizeDigits(generatedText);

  for (const page of pages) {
    for (const element of page.elements) {
      if (!allIds.has(element.sourceElementId))
        issues.push(`Source element ${element.sourceElementId} on page ${page.pageNumber} has no generated block mapping.`);
      if (element.kind === "code") {
        const codeBlock = lesson.blocks.find((block) => block.type === "code" && block.body === element.content);
        if (!codeBlock)
          issues.push(`Exact source code ${element.sourceElementId} on page ${page.pageNumber} was not retained as a code block.`);
        else {
          const codeIndex = lesson.blocks.indexOf(codeBlock);
          const adjacentExplanation = [lesson.blocks[codeIndex - 1], lesson.blocks[codeIndex + 1]]
            .some((block) => block && ["text", "richText", "statement"].includes(block.type) && block.body.trim().length >= 40);
          const embeddedExplanation = (codeBlock.codeExample?.explanation.trim().length ?? 0) >= 40;
          if (!adjacentExplanation && !embeddedExplanation)
            issues.push(`Source code ${element.sourceElementId} needs an adjacent text explanation.`);
        }
      }
      for (const number of extractImportantNumbers(element.content)) {
        const escapedValue = normalizeDigits(number).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const preservedInText = new RegExp(`(?:^|[^\\d.])${escapedValue}(?!\\d|\\.\\d)`).test(normalizedNumbers);
        const preservedInChart = lesson.blocks.some((block) =>
          block.type === "chart" && block.sourceElementIds.includes(element.sourceElementId)
          && chartPreservesSourceValue(block, number),
        );
        if (!preservedInText && !preservedInChart)
          issues.push(`Important source value “${number}” from ${element.sourceElementId} is missing.`);
      }
    }
  }
  return [...new Set(issues)].slice(0, 30);
}

function chartPreservesSourceValue(
  block: z.infer<typeof generatedBlockSeedSchema>,
  sourceValue: string,
) {
  const match = /^(\d+(?:\.\d+)?)\s*([a-z%]*)$/.exec(normalizeDigits(sourceValue));
  if (!match) return false;
  const value = Number(match[1]);
  const unit = match[2];
  const unitPattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${unit}(?![\\p{L}\\p{N}])`, "u");
  return block.chartFields.some((field) => {
    if (field.value !== value) return false;
    const labels = normalizeDigits([block.title, block.chartDescription, field.label].join("\n"));
    return !unit || (unit === "%" ? labels.includes("%") : unitPattern.test(labels));
  });
}

function extractImportantNumbers(value: string) {
  return [...new Set(value.match(/\b\d+(?:[.,]\d+)?\s?(?:%|px|rem|em|vh|vw|deg|ms|s|minutes?|hours?|cm|mm|kg|mb|gb)(?![\p{L}\p{N}])|\b\d{4,}\b/giu) ?? [])];
}

function normalizeDigits(value: string) {
  return value
    .replace(/[០-៩]/g, (digit) => String("០១២៣៤៥៦៧៨៩".indexOf(digit)))
    .replaceAll(",", "")
    .toLowerCase();
}

export function readStringField(value: unknown, field: string) {
  if (!value || typeof value !== "object" || !(field in value)) return "";
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}

export function buildSourceCoverageReport(
  inventory: GeneratedSourceInventory,
  plan: SourceCoursePlan,
  seed: GeneratedCourseSeed,
  generatedBlockBySourceId: Map<string, { lessonId: string; blockId: string }>,
  issuesByItem: string[][],
): SourceCoverageReport {
  const lessonSeeds = seed.sections.flatMap((section) => section.lessons);
  const items = inventory.pages.flatMap((page) => page.elements.map((element) => {
    const lessonIndex = plan.items.findIndex((item) =>
      page.pageNumber >= item.startPage && page.pageNumber <= item.endPage,
    );
    const destination = generatedBlockBySourceId.get(element.sourceElementId);
    const lessonSeed = lessonSeeds[lessonIndex];
    const mappedBlockText = lessonSeed?.blocks
      .filter((block) => block.sourceElementIds.includes(element.sourceElementId))
      .map(generatedBlockSearchText)
      .join("\n") ?? "";
    const matchingIssues = issuesByItem[lessonIndex] ?? [];
    const issueForElement = matchingIssues.filter((issue) => issue.includes(element.sourceElementId));
    let preservationStatus: SourceCoverageReport["items"][number]["preservationStatus"] = "preserved";
    let note: string | undefined;
    if (element.uncertainContent) {
      preservationStatus = "unresolved";
      note = "The source contains unreadable or uncertain content that was not guessed.";
    } else if (!destination) {
      preservationStatus = "unresolved";
      note = "No generated block was mapped to this source element.";
    } else if (issueForElement.some((issue) => issue.includes("Exact source code"))) {
      preservationStatus = "unresolved";
      note = "The source code did not pass the exact preservation check.";
    } else if (issueForElement.length) {
      preservationStatus = "partiallyPreserved";
      note = issueForElement.join(" ");
    } else if (element.kind === "visual") {
      preservationStatus = "partiallyPreserved";
      note = "The source visual description and labels were mapped, but the original visual file was not embedded.";
    } else if (element.kind === "text" && !sourceTextSignalsPreserved(element.content, mappedBlockText)) {
      preservationStatus = "partiallyPreserved";
      note = "A generated block is mapped, but the source text's key wording could not be verified in the lesson content.";
    }
    return {
      sourcePageNumber: page.pageNumber,
      sourceElementId: element.sourceElementId,
      sourceElementType: element.kind,
      generatedLessonId: destination?.lessonId ?? null,
      generatedBlockId: destination?.blockId ?? null,
      preservationStatus,
      ...(note ? { note } : {}),
    };
  }));
  return {
    complete: items.every((item) => item.preservationStatus === "preserved"),
    items,
  };
}

function generatedBlockSearchText(block: z.infer<typeof generatedBlockSeedSchema>) {
  return [
    block.title,
    block.body,
    block.codeExample?.explanation ?? "",
    ...block.bullets,
    block.question,
    ...block.options,
    ...block.steps.flatMap((step) => [step.title, step.body]),
    ...block.cards.flatMap((card) => [card.front, card.back]),
    block.imageTitle,
    block.imageBody,
    block.imageAlt,
    ...block.markers.flatMap((marker) => [marker.label, marker.description]),
    block.chartDescription,
    ...block.chartFields.flatMap((field) => [field.label, String(field.value)]),
  ].join("\n");
}

function sourceTextSignalsPreserved(source: string, generated: string) {
  const ignoredTerms = new Set([
    "and", "are", "for", "from", "into", "that", "the", "this", "was", "with",
    "you", "your", "page", "slide", "lesson",
  ]);
  const sourceTerms = [...new Set(
    (source.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:[%#.-][\p{L}\p{N}]+)*/gu) ?? [])
      .filter((term) => term.length >= 3 && !ignoredTerms.has(term)),
  )];
  if (!sourceTerms.length) return source.trim().length > 0 && generated.includes(source.trim());
  const normalizedGenerated = generated.toLocaleLowerCase();
  const matchedTerms = sourceTerms.filter((term) => normalizedGenerated.includes(term));
  return matchedTerms.length / sourceTerms.length >= 0.75;
}

export function addSourceVisualBlocks(
  seed: GeneratedCourseSeed,
  sourceInventory: GeneratedSourceInventory,
) {
  for (const page of sourceInventory.pages)
    page.elements.forEach((element, index) => {
      if (!element.sourceElementId) element.sourceElementId = `p${page.pageNumber}-e${index + 1}`;
    });
  const lessons = seed.sections.flatMap((section) => section.lessons);
  let imageCount = seed.sections.reduce(
    (total, section) => total + section.lessons.reduce(
      (lessonTotal, lesson) => lessonTotal + lesson.blocks.reduce((blockTotal, block) => {
        if ((block.type === "image" || block.type === "labeledGraphic") && block.imagePrompt.trim())
          return blockTotal + 1;
        if (block.type === "flipCard")
          return blockTotal + block.cards.reduce((cardTotal, card) =>
            cardTotal + Number(Boolean(card.frontImagePrompt.trim())) + Number(Boolean(card.backImagePrompt.trim())), 0);
        return blockTotal;
      }, 0),
      0,
    ),
    0,
  );
  if (imageCount >= 8) return;

  for (const page of sourceInventory.pages) {
    const lessonIndex = seed.lessonOverview.findIndex((row) => {
      const match = /^(?:slides?\s*)?(\d+)\s*[-–]\s*(\d+)$/i.exec(normalizeSourceRange(row.slideRange));
      return Boolean(match && page.pageNumber >= Number(match[1]) && page.pageNumber <= Number(match[2]));
    });
    const lesson = lessons[lessonIndex];
    if (!lesson) continue;

    for (const element of page.elements) {
      if (
        element.kind !== "visual" ||
        !["diagram", "screenshot", "photo", "illustration"].includes(element.visualKind) ||
        !element.content.trim() ||
        imageCount >= 8
      ) continue;
      const sourceElementId = element.sourceElementId;
      const matchingBlockIndex = lesson.blocks.findIndex((block) =>
        block.sourceElementIds.includes(sourceElementId),
      );
      const imageBlock = generatedBlockSeedSchema.parse({
        sourceElementIds: [sourceElementId],
        type: "image",
        title: "",
        body: "",
        bullets: [],
        style: "tip",
        question: "",
        options: [],
        correctOptionIndex: 0,
        steps: [],
        imageAlt: "",
        imagePrompt: `Recreate the educational ${element.visualKind} shown on source page ${page.pageNumber}. Follow this visual description closely: ${element.content}. Visible source labels and text for context: ${element.visibleText || "none"}. Preserve the layout, relationships, and important visual details.`.slice(0, 1_000),
      });
      const insertAt = matchingBlockIndex >= 0 ? matchingBlockIndex + 1 : lesson.blocks.length;
      lesson.blocks.splice(insertAt, 0, imageBlock);
      imageCount += 1;
    }
    if (imageCount >= 8) break;
  }
}
