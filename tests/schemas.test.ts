import { describe, expect, it } from "vitest";
import { blockSchema, normalizeStoredFlipCardBlock, type ContentBlock } from "../lib/schemas/block";
import { courseInputSchema } from "../lib/schemas/course";

describe("shared authoring schemas", () => {
  it("accepts a versioned heading block", () => {
    expect(blockSchema.parse({ id: "b1", version: 1, type: "heading", data: { text: "Welcome", level: 1 } }).type).toBe("heading");
  });

  it("rejects an unsupported block version", () => {
    expect(blockSchema.safeParse({ id: "b1", version: 2, type: "divider", data: { style: "line" } }).success).toBe(false);
  });

  it("keeps legacy dividers valid and adds defaults for continue controls", () => {
    expect(blockSchema.parse({ id: "b1", version: 1, type: "divider", data: { style: "line" } })).toMatchObject({
      data: { style: "line", label: "Continue", completionType: "none" },
    });
    expect(blockSchema.parse({ id: "b2", version: 1, type: "divider", data: { style: "continue" } })).toMatchObject({
      data: { style: "continue", label: "Continue", completionType: "none" },
    });
  });

  it("adds safe defaults to existing knowledge checks and validates their answer key", () => {
    const input = { id: "check-a", version: 1, type: "knowledgeCheck", data: { question: "Choose the right answer", options: ["A", "B"] } } as const;
    expect(blockSchema.parse(input)).toMatchObject({
      data: {
        correctOptionIndex: 0,
        correctFeedback: "Correct!",
        incorrectFeedback: "Not quite. Try again.",
      },
    });
    expect(blockSchema.safeParse({
      ...input,
      data: { ...input.data, correctOptionIndex: 2 },
    }).success).toBe(false);
  });

  it("normalizes a legacy single flip card and accepts text or image faces in a card set", () => {
    const legacy = blockSchema.parse({
      id: "flip-legacy",
      version: 1,
      type: "flipCard",
      data: {
        frontLabel: "Question",
        front: "What is active recall?",
        backLabel: "Answer",
        back: "Retrieving information from memory.",
      },
    });
    expect(legacy).toMatchObject({
      data: {
        cards: [{
          id: "card-1",
          front: { type: "text", text: "What is active recall?" },
          back: { type: "text", text: "Retrieving information from memory." },
        }],
      },
    });

    expect(blockSchema.parse({
      id: "flip-set",
      version: 1,
      type: "flipCard",
      data: {
        cards: [{
          id: "card-a",
          frontLabel: "Prompt",
          front: { type: "image", src: "/assets/prompt.png", alt: "Prompt image" },
          backLabel: "Answer",
          back: { type: "text", text: "The answer" },
        }],
      },
    })).toMatchObject({ type: "flipCard", data: { cards: [{ front: { type: "image" }, back: { type: "text" } }] } });
  });

  it("validates accordion, labeled graphic, and process step interactions", () => {
    const accordion = blockSchema.parse({
      id: "reveal-a",
      version: 1,
      type: "accordion",
      data: {
        items: [
          { id: "section-a", title: "First", body: "First explanation" },
          { id: "section-b", title: "Second", body: "Second explanation" },
        ],
      },
    });
    expect(accordion).toMatchObject({
      type: "accordion",
      width: "medium",
      data: { layout: "accordion", items: [{ title: "First" }, { title: "Second" }] },
    });

    const graphic = blockSchema.parse({
      id: "graphic-a",
      version: 1,
      type: "labeledGraphic",
      data: {
        src: "/diagram.png",
        alt: "A diagram",
        markers: [{ id: "marker-a", label: "First part", description: "Explanation", x: 22, y: 67, color: "#dc2626" }],
        markerColor: "#123456",
        textColor: "#fef3c7",
        radarColor: "#f97316",
      },
    });
    if (graphic.type !== "labeledGraphic") throw new Error("Expected labeled graphic block");
    expect(graphic).toMatchObject({
      type: "labeledGraphic",
      width: "full",
      data: {
        markers: [{ x: 22, y: 67, color: "#dc2626" }],
        markerColor: "#123456",
        textColor: "#fef3c7",
        radarColor: "#f97316",
      },
    });
    expect(blockSchema.safeParse({
      ...graphic,
      data: { ...graphic.data, markers: [{ ...graphic.data.markers[0], x: 101 }] },
    }).success).toBe(false);

    const steps = blockSchema.parse({
      id: "steps-a",
      version: 1,
      type: "processSteps",
      data: { steps: [{ id: "step-a", title: "First", body: "Do this" }, { id: "step-b", title: "Next", body: "Then this" }] },
    });
    expect(steps).toMatchObject({ type: "processSteps", width: "medium", data: { steps: [{ title: "First" }, { title: "Next" }] } });
  });

  it("normalizes legacy flip cards at the persisted-block read boundary", () => {
    const storedLegacyBlock = {
      id: "saved-flip-legacy",
      version: 1,
      type: "flipCard",
      data: {
        frontLabel: "Prompt",
        front: "What is spaced practice?",
        backLabel: "Answer",
        back: "Reviewing material over time.",
      },
    } as unknown as ContentBlock;

    expect(normalizeStoredFlipCardBlock(storedLegacyBlock)).toMatchObject({
      type: "flipCard",
      data: {
        cards: [{
          id: "card-1",
          front: { type: "text", text: "What is spaced practice?" },
          back: { type: "text", text: "Reviewing material over time." },
        }],
      },
    });
  });

  it("normalizes course defaults", () => {
    expect(courseInputSchema.parse({ title: "  Intro  " })).toMatchObject({ title: "Intro", status: "draft", language: "en" });
  });
});
