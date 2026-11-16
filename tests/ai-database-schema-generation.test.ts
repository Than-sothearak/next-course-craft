import { describe, expect, it } from "vitest";
import { generatedBlockSeedSchema } from "../lib/ai/course-generation-schemas";
import { generatedLearnItemSchema } from "../lib/ai/generation/response-schemas";
import { toContentBlock } from "../lib/ai/generation/block-content";
import { validateLearnItemCoverage } from "../lib/ai/generation/source-coverage";
import { expandLearnBlockResponse } from "../lib/ai/learn-block-response";

function databaseSchemaSeed() {
  const expanded = expandLearnBlockResponse({
    blocks: [{
      type: "databaseSchema",
      title: "Customer orders",
      sourceElementIds: ["p1-e1"],
      databaseDescription: "One Customer places many Orders.",
      databaseEntities: [
        {
          name: "Customer",
          description: "A customer record.",
          fields: [{ name: "customer_id", type: "uuid", nullable: false, keyType: "primary" }],
        },
        {
          name: "Order",
          description: "An order record.",
          fields: [
            { name: "order_id", type: "uuid", nullable: false, keyType: "primary" },
            { name: "customer_id", type: "uuid", nullable: false, keyType: "foreign" },
          ],
        },
      ],
      databaseRelationships: [{
        fromEntity: "Customer",
        fromField: "customer_id",
        toEntity: "Order",
        toField: "customer_id",
        label: "places",
        cardinality: "one-to-many",
      }],
    }],
  }) as { blocks: unknown[] };
  return generatedBlockSeedSchema.parse(expanded.blocks[0]);
}

describe("AI database schema block integration", () => {
  it("validates source-grounded entities and rejects relationships with missing fields", () => {
    const valid = databaseSchemaSeed();
    expect(valid.type).toBe("databaseSchema");

    const invalid = {
      ...valid,
      databaseRelationships: [{
        ...valid.databaseRelationships[0],
        toField: "missing_id",
      }],
    };
    expect(generatedBlockSeedSchema.safeParse(invalid).success).toBe(false);
  });

  it("converts named references into stable native entity and field IDs", async () => {
    const converted = await toContentBlock(databaseSchemaSeed(), "owner", "course", false, false, () => {});
    expect(converted.generatedImage).toBe(false);
    expect(converted.block.type).toBe("databaseSchema");
    if (converted.block.type !== "databaseSchema") throw new Error("Expected a database schema block");

    const customer = converted.block.data.entities.find((entity) => entity.name === "Customer");
    const order = converted.block.data.entities.find((entity) => entity.name === "Order");
    expect(customer).toBeDefined();
    expect(order).toBeDefined();
    expect(converted.block.data.relationships[0]).toMatchObject({
      fromEntityId: customer?.id,
      fromFieldId: customer?.fields[0]?.id,
      toEntityId: order?.id,
      toFieldId: order?.fields[1]?.id,
      label: "places",
      cardinality: "one-to-many",
    });
  });

  it("keeps the schema content in source coverage and the generated learn-item contract", () => {
    const schema = databaseSchemaSeed();
    const lesson = generatedLearnItemSchema.parse({
      title: "Relational model",
      objective: "Read the customer and order relationship.",
      summary: "Customers place orders in a one-to-many relationship.",
      blocks: [schema],
    });
    expect(validateLearnItemCoverage(lesson, [{
      pageNumber: 1,
      elements: [{
        sourceElementId: "p1-e1",
        kind: "text",
        content: "A Customer has customer_id. An Order has order_id and customer_id. One Customer places many Orders (one-to-many).",
        visualKind: "other",
        visibleText: "",
        uncertainContent: false,
      }],
    }])).toEqual([]);
  });
});
