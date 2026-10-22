import type { GeneratedCourseSeed } from "../course-generation-schemas";

type BlockSeed = GeneratedCourseSeed["sections"][number]["lessons"][number]["blocks"][number];

export const blockSelectionGuide = `CONTENT-BASED BLOCK SELECTION: Choose the format from what learners need to understand, rather than copying a fixed block sequence into every lesson.
- Comparable numeric categories, measurements, percentages, or time-series values: use a native chart when the comparison or trend helps explain the lesson. Use bar/column for category comparisons, line for ordered trends, and donut only for genuine parts of one whole. Keep exact supplied values, labels, and units in chartFields and the chart title/description; explain the takeaway alongside the chart. Charts work even when generated images are disabled. A topic about data alone is not a dataset: never invent values or treat code constants, isolated dates, identifiers, or unrelated numbers as a dataset just to add a chart.
- Ordered procedures: processSteps. Related details or qualitative comparisons: accordion/tabs. Recall or vocabulary: flipCard. Decisions or misconceptions: knowledgeCheck within the course budget. Emphasis: statement. Explanations: richText. Use images/labeledGraphic only when a visual helps and generated images are enabled.
- Preserve the source and respect explicit author format preferences. When several formats fit equally well, prefer one used less in earlier lessons and change the activity sequence. Keep necessary prose and code; do not force every block type, add filler, or replace a suitable format merely to meet a variety quota.`;

function blockFormat(block: BlockSeed) {
  if (block.type === "text") return "richText";
  if (block.type === "accordion") return block.layout === "tabs" ? "tabs" : "accordion";
  if (block.type === "chart") return `chart:${block.chartType}`;
  return block.type;
}

export function previousBlockMixInstruction(blocks: BlockSeed[]) {
  if (!blocks.length) return "PREVIOUS BLOCK MIX: No earlier learning blocks. Choose formats that fit this material.";
  const counts: Record<string, number> = {};
  const formats = blocks.map(blockFormat);
  for (const format of formats) counts[format] = (counts[format] ?? 0) + 1;
  const recentFormats = formats.filter((format) => !["richText", "heading", "divider", "code"].includes(format)).slice(-12);
  return `PREVIOUS BLOCK MIX: ${JSON.stringify(counts)}. Recent activity/visual formats, in order: ${JSON.stringify(recentFormats)}. Avoid automatically repeating this sequence; choose a less-used format when it suits the assigned material equally well. These counts guide variety, not quotas; preserve required explanations, procedures, and code.`;
}
