import type { GeneratedCourseSeed } from "../course-generation-schemas";

type BlockSeed = GeneratedCourseSeed["sections"][number]["lessons"][number]["blocks"][number];

export const blockSelectionGuide = `CONTENT-BASED BLOCK SELECTION: Choose the format from what learners need to understand, rather than copying a fixed block sequence into every lesson.
- List meaning: richText bullets render as an unordered list, so use them only for peer facts with no meaningful order (for example, a collection of tools). Use processSteps for procedures or actions whose order matters; do not place those actions in bullets. Use a timeline for source-supported chronology, not instructions.
- Comparable numeric categories, measurements, percentages, or time-series values: use a native chart when the comparison or trend helps explain the lesson. Use bar/column for category comparisons, line for ordered trends, and donut only for genuine parts of one whole. Keep exact supplied values, labels, and units in chartFields and the chart title/description; explain the takeaway alongside the chart. Charts work even when generated images are disabled. A topic about data alone is not a dataset: never invent values or treat code constants, isolated dates, identifiers, or unrelated numbers as a dataset just to add a chart.
- Ordered procedures: processSteps. Keep its guided mode for following an explanation; select the ordering activity only when learners should reconstruct or practise a source-supported sequence. Historical events or other source-supported chronology: timeline. Related details or qualitative comparisons: accordion/tabs. Recall or vocabulary: flipCard. Decisions or misconceptions: knowledgeCheck within the course budget. Emphasis: statement. Explanations: richText. Use images/labeledGraphic only when a visual helps and generated images are enabled.
- Subject fit: programming examples use code with a complete explanation; use conceptMap in Standard mode for a central concept and explicit relationships in the supplied material, not for chronology or procedures. Use databaseSchema only in Standard mode when the supplied material names at least two entities and their fields, and states their relationships and cardinality. Preserve exact names and endpoints; never infer fields, key roles, nullability, or cardinality from a familiar domain pattern. If any of that evidence is missing, explain the model in richText. Math uses formula for relationships stated in the supplied material and table/chart only for actual values; science procedures use processSteps and source-supported parts can use labeledGraphic; language vocabulary can use flipCard; business comparisons can use table and real supplied figures can use chart; art/design examples can use source images, gallery, or a generated image when enabled. Keep case studies, definitions, quotes, worked reasoning, and short comparisons in well-structured richText or statement content when no dedicated block fits.
- Capability boundary: choose only block types in the supplied schema. Concept maps and DatabaseSchema are static teaching diagrams, not interactive systems; DatabaseSchema does not execute queries. Do not imply that a code block is an executable playground, that an image is a 3D model, or that audio has been generated; use manually uploaded audio only when available. Use a supported block or explain the concept in richText instead of inventing a missing activity type.
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
