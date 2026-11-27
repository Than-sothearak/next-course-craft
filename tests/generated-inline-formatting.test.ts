import { describe, expect, it } from "vitest";
import { generatedBlockSeedSchema, generatedCourseSeedSchema } from "@/lib/ai/course-generation-schemas";
import { expandLearnBlockResponse } from "@/lib/ai/learn-block-response";
import { buildPreLearnPostActivities, toContentBlock } from "@/lib/ai/generation/block-content";
import { generatedInlineHtml, generatedPlainText, normalizeGeneratedInlineFormatting } from "@/lib/ai/generation/inline-formatting";

function block(value: object) {
  const expanded = expandLearnBlockResponse({ blocks: [value] }) as { blocks: unknown[] };
  return generatedBlockSeedSchema.parse(expanded.blocks[0]);
}

describe("generated inline code preservation", () => {
  it("preserves code delimiters and corrects HTML snippets incorrectly marked as keywords", () => {
    const normalized = normalizeGeneratedInlineFormatting("Use `HTML`, ``Flexbox``, **bold**, and ==highlight==.");
    expect(normalized).toBe("Use `HTML`, ``Flexbox``, **bold**, and ==highlight==.");
    expect(normalizeGeneratedInlineFormatting(normalized)).toBe(normalized);
    expect(normalizeGeneratedInlineFormatting("`**bold**` and `==highlight==`")).toBe("`**bold**` and `==highlight==`");
    expect(normalizeGeneratedInlineFormatting("***<p>Welcome.</p>***")).toBe("`<p>Welcome.</p>`");
    expect(normalizeGeneratedInlineFormatting("```raw code```")).toBe("```raw code```");
    expect(generatedInlineHtml("`<element>`")).toContain("&lt;element&gt;");
    expect(generatedPlainText("`HTML` and ``Flexbox``")).toBe("HTML and Flexbox");
  });

  it("normalizes generated paragraph, bullet and item HTML before saving", async () => {
    const richText = await toContentBlock(block({ type: "text", title: "***HTML***", body: "Use ***<p>Welcome.</p>*** with ***Flexbox***.", bullets: ["Set `display`."], sourceElementIds: [] }), "owner", "course", false, false, () => {});
    expect(richText.block.type).toBe("richText");
    if (richText.block.type !== "richText") throw new Error("Expected rich text");
    expect(richText.block.data.html).not.toContain("`");
    expect(richText.block.data.html.match(/data-generated-emphasis="true"/g)).toHaveLength(2);
    expect(richText.block.data.html).toContain("<code>&lt;p&gt;Welcome.&lt;/p&gt;</code>");

    const statement = await toContentBlock(block({ type: "statement", title: "`Keyword`", body: "Remember `HTML`.", style: "info", sourceElementIds: [] }), "owner", "course", false, false, () => {});
    expect(statement.block).toMatchObject({ type: "statement", data: { title: "Keyword", body: "Remember HTML.", bodyHtml: '<p>Remember <code>HTML</code>.</p>' } });
  });

  it("preserves exact raw code and URLs while normalizing code-example explanations", async () => {
    const code = 'const message = `***keep this***`;\n// ``source code``';
    const converted = await toContentBlock(block({ type: "code", title: "`Example`", body: code, codeExample: { template: "paper-explained-above", language: "javascript", explanation: "Read the `message`." }, sourceElementIds: [] }), "owner", "course", false, false, () => {});
    if (converted.block.type !== "richText") throw new Error("Expected rich text");
    expect(converted.block.data.html).toContain(`<code class="language-javascript">${code}</code>`);
    expect(converted.block.data.html).toContain('Read the <code>message</code>.');

    const url = "https://example.com/?term=%60HTML%60";
    const link = await toContentBlock(block({ type: "link", title: "", linkUrl: url, linkLabel: "Read `HTML`", linkDescription: "See ``examples``.", sourceElementIds: [] }), "owner", "course", false, false, () => {});
    expect(link.block).toMatchObject({ type: "link", data: { url, label: "Read HTML", description: "See examples." } });
  });

  it("retains supported formatting in keyword cards restored from an older generated seed", () => {
    const seed = generatedCourseSeedSchema.parse({ title: "HTML", description: "Learn HTML.", sections: [{ title: "Learn", lessons: [{ title: "Elements", objective: "Learn elements.", blocks: [block({ type: "text", title: "", body: "HTML uses elements.", bullets: [], sourceElementIds: [] })] }] }], lessonOverview: [], keyTerms: [{ term: "`HTML`", definition: "Use ``elements`` and **tags**." }], preTest: [], postTest: [], lessonSummary: "Summary", nextLesson: "Next" });
    const activities = buildPreLearnPostActivities(seed, { id: "learn", title: "Learn", order: 1 }, [], false);
    const keywords = activities.lessons.find((lesson) => lesson.title === "Keyword");
    expect(keywords?.blocks[0]).toMatchObject({ type: "flipCard", data: { cards: [{ front: { type: "text", text: "`HTML`" }, back: { type: "text", text: "Use ``elements`` and **tags**." } }] } });
  });

  it("preserves formatting on generated flip-card faces", async () => {
    const converted = await toContentBlock(block({ type: "flipCard", title: "", sourceElementIds: [], cards: [{ front: "**Question** about `HTML`", back: "Use ***elements*** and ==tags==." }] }), "owner", "course", false, false, () => {});
    expect(converted.block).toMatchObject({ type: "flipCard", data: { cards: [{ front: { type: "text", text: "**Question** about `HTML`" }, back: { type: "text", text: "Use ***elements*** and ==tags==." } }] } });
  });
});
