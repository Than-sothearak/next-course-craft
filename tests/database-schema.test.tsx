/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ContentBlock } from "@/lib/schemas/block";
import { blockSchema } from "@/lib/schemas/block";
import { duplicateLessonBlocks } from "@/lib/editor/course-content";
import { getHandoutBlockText } from "@/lib/pdf/content";
import { getInteractiveBlockProgressIds } from "@/lib/export/progress";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { TemplatePreview } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/template-preview";
import { ContentBlockPreview } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/content-block-preview";
import { DatabaseSchemaBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/database-schema-block-editor";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const template = blockTemplates.find((item) => item.type === "databaseSchema")!;

describe("database schema block", () => {
  it("inserts a validated Standard template with remapped, connected IDs", () => {
    expect(template.standardOnly).toBe(true);
    const [inserted] = createBlocksFromTemplate(template, "new-schema");
    const block = blockSchema.parse(inserted);
    if (block.type !== "databaseSchema") throw new Error("Expected a database schema");

    expect(block).toMatchObject({ width: "medium", data: { title: "Users and orders", relationships: [{ label: "belongs to", cardinality: "many-to-one" }] } });
    expect(getInteractiveBlockProgressIds(block)).toEqual([]);
    expect(block.data.entities.map((entity) => entity.id)).not.toEqual(template.databaseSchema?.entities.map((entity) => entity.id));
    const relationship = block.data.relationships[0];
    expect(block.data.entities.find((entity) => entity.id === relationship.fromEntityId)?.fields.some((field) => field.id === relationship.fromFieldId)).toBe(true);
    expect(block.data.entities.find((entity) => entity.id === relationship.toEntityId)?.fields.some((field) => field.id === relationship.toFieldId)).toBe(true);

    const learnerMarkup = renderToStaticMarkup(<PreviewBlock block={block} device="mobile" orientation="portrait" />);
    const editorMarkup = renderToStaticMarkup(<ContentBlockPreview block={block} onChange={() => {}} />);
    const templateMarkup = renderToStaticMarkup(<TemplatePreview template={template} />);
    expect(learnerMarkup).toContain('data-database-schema="true"');
    expect(learnerMarkup).toContain("grid-cols-1");
    expect(learnerMarkup).toContain("break-words");
    expect(learnerMarkup).toContain("Orders.");
    expect(learnerMarkup).toContain("user_id");
    expect(learnerMarkup).toContain("Users.");
    expect(learnerMarkup).toContain(">id</span>");
    expect(learnerMarkup).toContain("many to one");
    expect(editorMarkup).toContain("Primary key");
    expect(templateMarkup).toContain("Users and orders");
    expect(getHandoutBlockText(block)).toContain("Orders.user_id belongs to Users.id (many-to-one)");
  });

  it("rejects relationships pointing to missing entity fields", () => {
    const [block] = createBlocksFromTemplate(template, "invalid-schema");
    if (block.type !== "databaseSchema") throw new Error("Expected a database schema");
    expect(blockSchema.safeParse({ ...block, data: { ...block.data, relationships: [{ ...block.data.relationships[0], toFieldId: "missing-field" }] } }).success).toBe(false);
  });

  it("duplicates entities, fields, and relationships while preserving their references", () => {
    const [source] = createBlocksFromTemplate(template, "source-schema");
    if (source.type !== "databaseSchema") throw new Error("Expected a database schema");
    let nextId = 0;
    const [duplicate] = duplicateLessonBlocks([source], () => `duplicate-${++nextId}`);
    if (duplicate.type !== "databaseSchema") throw new Error("Expected a duplicated database schema");
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.data.entities.map((entity) => entity.id)).not.toEqual(source.data.entities.map((entity) => entity.id));
    expect(duplicate.data.entities.flatMap((entity) => entity.fields.map((field) => field.id))).not.toEqual(source.data.entities.flatMap((entity) => entity.fields.map((field) => field.id)));
    const relationship = duplicate.data.relationships[0];
    expect(duplicate.data.entities.find((entity) => entity.id === relationship.fromEntityId)?.fields.some((field) => field.id === relationship.fromFieldId)).toBe(true);
    expect(duplicate.data.entities.find((entity) => entity.id === relationship.toEntityId)?.fields.some((field) => field.id === relationship.toFieldId)).toBe(true);
  });

  it("offers subject-specific math, science, and language setups on existing block types", () => {
    const examples = ["formula-ohms-law", "science-experiment-protocol", "language-vocabulary-cards"].map((id) => blockTemplates.find((item) => item.id === id)!);
    expect(examples.every((item) => item.standardOnly)).toBe(true);
    const created = examples.map((item) => blockSchema.parse(createBlocksFromTemplate(item, `subject-${item.id}`)[0]));
    expect(created.map((block) => block.type)).toEqual(["formula", "processSteps", "flipCard"]);
    expect(created[0]).toMatchObject({ data: { latex: "V = I \\times R", variables: [{ symbol: "V" }, { symbol: "I" }, { symbol: "R" }] } });
    if (created[1].type !== "processSteps" || created[2].type !== "flipCard") throw new Error("Expected reusable subject block types");
    expect(created[1].data).toMatchObject({ activityMode: "guided", style: "numbered" });
    expect(created[1].data.steps.slice(0, 2).map((step) => step.title)).toEqual(["Ask a testable question", "Make a prediction"]);
    expect(created[2].data.cards).toHaveLength(3);
    expect(created[2].data.cards[0]).toMatchObject({ frontLabel: "Word", backLabel: "Meaning" });
    expect(created[2].data.cards[1].front).toMatchObject({ type: "text", text: "Evidence" });
  });

  describe("authoring controls", () => {
    let root: Root;
    let container: HTMLDivElement;
    let saved: Extract<ContentBlock, { type: "databaseSchema" }>;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.append(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    it("adds entities and field relationships, then removes dependent relationships with an entity", async () => {
      const [initial] = createBlocksFromTemplate(template, "editing-schema");
      if (initial.type !== "databaseSchema") throw new Error("Expected a database schema");
      const initialSchema = initial as Extract<ContentBlock, { type: "databaseSchema" }>;

      function Harness() {
        const [block, setBlock] = useState(initialSchema);
        saved = block;
        return <DatabaseSchemaBlockEditor block={block} onChange={(next) => { if (next.type === "databaseSchema") setBlock(next); }} />;
      }

      await act(async () => root.render(<Harness />));
      const button = (name: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
      const namedButton = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(text))!;
      await act(async () => namedButton("Add entity").click());
      expect(saved.data.entities).toHaveLength(3);
      await act(async () => namedButton("Add relationship").click());
      expect(saved.data.relationships).toHaveLength(2);

      const thirdEntityId = saved.data.entities[2].id;
      const sourceSelect = container.querySelector<HTMLSelectElement>('[aria-label="Relationship 1 source entity"]')!;
      await act(async () => {
        sourceSelect.value = thirdEntityId;
        sourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(saved.data.relationships[0].fromEntityId).toBe(thirdEntityId);
      expect(saved.data.entities[2].fields.some((field) => field.id === saved.data.relationships[0].fromFieldId)).toBe(true);

      await act(async () => button("Delete database entity 3").click());
      expect(saved.data.entities).toHaveLength(2);
      expect(saved.data.relationships).toHaveLength(1);
      expect(container.querySelector('[data-database-schema="true"]')).not.toBeNull();
    });
  });
});
