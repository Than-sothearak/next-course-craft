import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { generatedBlockSeedSchema } from "@/lib/ai/course-generation-schemas";
import { expandLearnBlockResponse } from "@/lib/ai/learn-block-response";
import { splitGeneratedBlockSeeds } from "@/lib/ai/generation/block-seeds";
import { toContentBlock } from "@/lib/ai/generation/block-content";
import { reflowLongParagraphs } from "@/lib/editor/reflow-long-paragraphs";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { TemplatePreview } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/template-preview";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { BlockTemplatePicker } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/block-template-picker";

const originalGlobals = {
  DOMParser: globalThis.DOMParser,
  document: globalThis.document,
  NodeFilter: globalThis.NodeFilter,
};

// This project uses jsdom at runtime without installing its optional type package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { JSDOM } = require("jsdom") as {
  JSDOM: new () => { window: { DOMParser: typeof DOMParser; document: Document; NodeFilter: typeof NodeFilter } };
};

function useDom() {
  const dom = new JSDOM();
  vi.stubGlobal("DOMParser", dom.window.DOMParser);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("NodeFilter", dom.window.NodeFilter);
  return dom;
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) Reflect.deleteProperty(globalThis, key);
    else Reflect.set(globalThis, key, value);
  }
});

describe("Standard educational content blocks", () => {
  it("validates formula, responsive table, and informational checklist blocks", () => {
    expect(blockSchema.parse({ id: "formula", version: 1, type: "formula", data: { latex: "E=mc^2", variables: [{ symbol: "E", explanation: "Energy" }] } })).toMatchObject({ width: "medium", blockPadding: 40 });
    expect(blockSchema.parse({ id: "table", version: 1, type: "table", data: { columns: ["Name", "Value"], rows: [["A", "1"]] } }).type).toBe("table");
    expect(blockSchema.parse({ id: "checklist", version: 1, type: "checklist", data: { items: ["Review the result"] } }).type).toBe("checklist");
    expect(blockSchema.safeParse({ id: "bad-table", version: 1, type: "table", data: { columns: ["Name", "Value"], rows: [["A"]] } }).success).toBe(false);
  });

  it("converts generated formula, table, and checklist seeds into native saved blocks", async () => {
    const seed = (type: string, fields: object) => generatedBlockSeedSchema.parse((expandLearnBlockResponse({ blocks: [{ type, title: "Generated content", ...fields }] }) as { blocks: unknown[] }).blocks[0]);
    const inputs = [
      seed("formula", { formulaLatex: "a^2+b^2=c^2", formulaExplanation: "Relates the sides of a right triangle.", formulaVariables: [{ symbol: "a", explanation: "One shorter side" }] }),
      seed("table", { tableCaption: "Compare", tableColumns: ["Type", "Use"], tableRows: [["A", "B"]] }),
      seed("checklist", { checklistItems: ["Verify the units"] }),
    ];
    const converted = await Promise.all(inputs.map((item) => toContentBlock(item, "owner", "course", false, false, () => {})));
    expect(converted.map((result) => result.block.type)).toEqual(["formula", "table", "checklist"]);
    expect(converted[0].block).toMatchObject({ type: "formula", width: "medium", data: { latex: "a^2+b^2=c^2", variables: [{ symbol: "a", explanation: "One shorter side" }] } });
    expect(converted[1].block).toMatchObject({ type: "table", width: "medium", data: { columns: ["Type", "Use"], rows: [["A", "B"]] } });
    expect(converted[2].block).toMatchObject({ type: "checklist", data: { items: ["Verify the units"] } });
  });

  it("inserts and previews the new blocks as Standard-only templates", () => {
    for (const type of ["formula", "table", "checklist"] as const) {
      const template = blockTemplates.find((item) => item.type === type);
      expect(template?.standardOnly).toBe(true);
      const [block] = createBlocksFromTemplate(template!, `new-${type}`);
      expect(blockSchema.parse(block)).toMatchObject({ type, blockPadding: 40, width: "medium" });
      expect(renderToStaticMarkup(createElement(TemplatePreview, { template: template! }))).toContain(type === "formula" ? "role=\"math\"" : type === "table" ? "<table" : "<ul");
    }
    const presentationPicker = renderToStaticMarkup(createElement(BlockTemplatePicker, { open: true, onClose: () => {}, onSelect: () => {} }));
    const standardPicker = renderToStaticMarkup(createElement(BlockTemplatePicker, { open: true, standardOnly: true, onClose: () => {}, onSelect: () => {} }));
    expect(presentationPicker).not.toContain(">Formula</button>");
    expect(presentationPicker).not.toContain(">Table</button>");
    expect(presentationPicker).not.toContain(">Checklist</button>");
    expect(standardPicker).toContain(">Formula</button>");
    expect(standardPicker).toContain(">Table</button>");
    expect(standardPicker).toContain(">Checklist</button>");
  });

  it("renders formulas, semantic mobile table labels, and a non-interactive checklist in learner preview", () => {
    const formula = blockSchema.parse({ id: "formula-preview", version: 1, type: "formula", data: { title: "Energy", latex: "E=mc^2", explanation: "Mass and speed determine energy.", variables: [{ symbol: "m", explanation: "Mass" }] } });
    const table = blockSchema.parse({ id: "table-preview", version: 1, type: "table", data: { columns: ["Concept", "Meaning"], rows: [["Mass", "Amount of matter"]] } });
    const checklist = blockSchema.parse({ id: "check-preview", version: 1, type: "checklist", data: { title: "Review", items: ["Check units"] } });
    const mathMarkup = renderToStaticMarkup(createElement(PreviewBlock, { block: formula, device: "mobile", orientation: "portrait" }));
    const tableMarkup = renderToStaticMarkup(createElement(PreviewBlock, { block: table, device: "mobile", orientation: "portrait" }));
    const checklistMarkup = renderToStaticMarkup(createElement(PreviewBlock, { block: checklist, device: "mobile", orientation: "portrait" }));
    expect(mathMarkup).toContain('role="math"');
    expect(mathMarkup).toContain("Mass and speed determine energy.");
    expect(tableMarkup).toContain('scope="col"');
    expect(tableMarkup).toContain("sm:hidden");
    expect(tableMarkup).toContain("Concept");
    expect(checklistMarkup).toContain('aria-label="Review"');
    expect(checklistMarkup).not.toContain('type="checkbox"');
  });

  it("preserves AI-selected supporting images without injecting images into other sections", () => {
    const explanation = generatedBlockSeedSchema.parse((expandLearnBlockResponse({ blocks: [{ type: "richText", title: "Energy", body: "The lesson explanation remains intact." }] }) as { blocks: unknown[] }).blocks[0]);
    const selectedImage = generatedBlockSeedSchema.parse((expandLearnBlockResponse({ blocks: [{ type: "image", title: "Energy example", imagePrompt: "Show the stated relationship clearly.", imageAlt: "A visual explanation" }] }) as { blocks: unknown[] }).blocks[0]);
    expect(splitGeneratedBlockSeeds([explanation]).map((block) => block.type)).toEqual(["richText"]);
    expect(splitGeneratedBlockSeeds([explanation, selectedImage]).map((block) => block.type)).toEqual(["richText", "image"]);
  });
});

describe("display-only paragraph reflow", () => {
  it("splits long paragraphs into balanced groups while preserving text and inline emphasis", () => {
    const dom = useDom();
    const html = "<p>First sentence. Second <strong>important</strong> sentence. Third sentence. Fourth sentence. Fifth sentence.</p>";
    const result = reflowLongParagraphs(html);
    const parsed = new dom.window.DOMParser().parseFromString(result, "text/html");
    expect(parsed.querySelectorAll("p")).toHaveLength(2);
    expect(parsed.body.textContent).toBe("First sentence. Second important sentence. Third sentence. Fourth sentence. Fifth sentence.");
    expect(parsed.querySelector("strong")?.textContent).toBe("important");
    expect(html).toContain("<p>");
  });

  it("leaves lists, code, and equation paragraphs intact", () => {
    useDom();
    const html = "<ul><li><p>One. Two. Three. Four. Five.</p></li></ul><p>One. Two. Three. Four. Five. <code>x+y</code></p><p data-type=\"inline-math\">One. Two. Three. Four. Five.</p>";
    const result = reflowLongParagraphs(html);
    expect(result.match(/<p(?:\s|>)/g)).toHaveLength(3);
  });
});
