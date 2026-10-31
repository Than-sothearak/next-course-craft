import { describe, expect, it } from "vitest";
import { blockSchema, defaultBlockPaddingForBlock, normalizeBlockPaddingForBlock, normalizeStoredFlipCardBlock, type ContentBlock } from "../lib/schemas/block";
import { blockSurfaceStyle } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/preview-utils";
import { courseInputSchema } from "../lib/schemas/course";

describe("shared authoring schemas", () => {
  it("accepts a versioned heading block", () => {
    expect(blockSchema.parse({ id: "b1", version: 1, type: "heading", data: { text: "Welcome", level: 1 } }).type).toBe("heading");
  });

  it("validates resource link blocks and rejects unsafe destinations", () => {
    expect(blockSchema.parse({
      id: "resource-link",
      version: 1,
      type: "link",
      data: { label: "Read the guide", url: "https://example.com/guide", style: "card" },
    })).toMatchObject({
      type: "link",
      width: "small",
      blockPadding: 40,
      data: { label: "Read the guide", description: "", style: "card", openInNewTab: true },
    });
    expect(blockSchema.safeParse({
      id: "unsafe-link",
      version: 1,
      type: "link",
      data: { url: "javascript:alert(1)" },
    }).success).toBe(false);
    expect(blockSchema.safeParse({
      id: "protocol-relative-link",
      version: 1,
      type: "link",
      data: { url: "//example.com" },
    }).success).toBe(false);
    expect(blockSchema.safeParse({
      id: "backslash-relative-link",
      version: 1,
      type: "link",
      data: { url: "/\\example.com" },
    }).success).toBe(false);
  });

  it("rejects an unsupported block version", () => {
    expect(blockSchema.safeParse({ id: "b1", version: 2, type: "divider", data: { style: "line" } }).success).toBe(false);
  });

  it("keeps legacy dividers valid and adds defaults for continue controls", () => {
    expect(blockSchema.parse({ id: "b1", version: 1, type: "divider", data: { style: "line" } })).toMatchObject({
      width: "full",
      blockPadding: 60,
      data: {
        style: "line",
        label: "Continue",
        completionType: "none",
        lineWeight: 1,
        lineColor: "#cbd5e1",
        lineStyle: "solid",
      },
    });
    expect(blockSchema.parse({ id: "b2", version: 1, type: "divider", data: { style: "continue" } })).toMatchObject({
      blockPadding: 100,
      data: { style: "continue", label: "Continue", completionType: "none" },
    });
  });

  it("uses 100px top and bottom padding for Continue blocks and fallback settings", () => {
    const block = blockSchema.parse({ id: "continue", version: 1, type: "divider", data: { style: "continue" } });
    expect(defaultBlockPaddingForBlock(block)).toBe(100);
    expect(normalizeBlockPaddingForBlock(undefined, block)).toBe(100);
    expect(blockSurfaceStyle(block)).toMatchObject({ paddingTop: "100px", paddingBottom: "100px" });
    expect(blockSchema.parse({ id: "space", version: 1, type: "divider", data: { style: "space" } }).blockPadding).toBe(40);
  });

  it.each([0, 20, 80, 120])("preserves custom Continue block padding of %ipx", (padding) => {
    const block = blockSchema.parse({ id: "continue", version: 1, type: "divider", blockPadding: padding, data: { style: "continue" } });
    expect(block.blockPadding).toBe(padding);
    expect(normalizeBlockPaddingForBlock(padding, block)).toBe(padding);
    expect(blockSurfaceStyle(block)).toMatchObject({ paddingTop: `${padding}px`, paddingBottom: `${padding}px` });
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
        cardsPerRow: 3,
        cardStyle: "classic",
        cardBackgroundColor: "#ffffff",
        cardTextColor: "#0f172a",
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
        cardsPerRow: 5,
        cardStyle: "outlined",
        cardBackgroundColor: "#fef3c7",
        cardTextColor: "#1f2937",
      },
    })).toMatchObject({
      type: "flipCard",
      data: {
        cardsPerRow: 5,
        cardStyle: "outlined",
        cardBackgroundColor: "#fef3c7",
        cardTextColor: "#1f2937",
        cards: [{ front: { type: "image" }, back: { type: "text" } }],
      },
    });
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
      data: { layout: "accordion", displayMode: "all", items: [{ title: "First" }, { title: "Second" }] },
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

  it("validates built-in graphic maps and individual point colors without an image URL", () => {
    const graphic = { id: "map", version: 1, type: "labeledGraphic", data: { src: "", alt: "Learning map", markers: [{ id: "point", label: "Start", description: "Begin here", x: 20, y: 40, color: "#16a34a" }] } };
    for (const mapTemplate of ["modernCity", "farmFields", "cityProvince", "learningRoad"]) {
      expect(blockSchema.parse({ ...graphic, data: { ...graphic.data, mapTemplate } })).toMatchObject({ data: { mapTemplate, markers: [{ color: "#16a34a" }] } });
    }
    expect(blockSchema.safeParse(graphic).success).toBe(false);
    expect(blockSchema.safeParse({ ...graphic, data: { ...graphic.data, mapTemplate: "unknown" } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...graphic, data: { ...graphic.data, mapTemplate: "learningRoad", markers: [{ ...graphic.data.markers[0], color: "red" }] } }).success).toBe(false);
  });

  it("accepts an optional boolean radar setting for each graphic point", () => {
    const graphic = { id: "graphic-radar", version: 1, type: "labeledGraphic", data: { src: "/diagram.png", alt: "Diagram", markers: [{ id: "point", label: "Start", description: "Begin here", x: 20, y: 40 }] } };
    for (const radarEnabled of [undefined, true, false]) {
      expect(blockSchema.parse({ ...graphic, data: { ...graphic.data, markers: [{ ...graphic.data.markers[0], radarEnabled }] } })).toMatchObject({ data: { markers: [{ radarEnabled }] } });
    }
    expect(blockSchema.safeParse({ ...graphic, data: { ...graphic.data, markers: [{ ...graphic.data.markers[0], radarEnabled: "false" }] } }).success).toBe(false);
  });

  it("requires one winning hotspot and complete feedback for graphic mini-games", () => {
    const game = {
      id: "spot-target-game",
      version: 1,
      type: "labeledGraphic",
      data: {
        src: "",
        alt: "A training scene with a hidden clue.",
        interactionMode: "spotTarget",
        sceneTheme: "security",
        challengePrompt: "Find the suspicious link.",
        successMessage: "Good catch. Report the message.",
        markers: [
          { id: "wrong", label: "Check here", description: "Try again.", x: 30, y: 40, isTarget: false },
          { id: "right", label: "Clue", description: "This is the clue.", x: 60, y: 70, isTarget: true },
        ],
      },
    } as const;

    expect(blockSchema.parse(game)).toMatchObject({
      type: "labeledGraphic",
      data: { interactionMode: "spotTarget", sceneTheme: "security", markers: [{ isTarget: false }, { isTarget: true }] },
    });
    expect(blockSchema.safeParse({
      ...game,
      data: { ...game.data, markers: game.data.markers.map((marker) => ({ ...marker, isTarget: false })) },
    }).success).toBe(false);
    expect(blockSchema.safeParse({
      ...game,
      data: { ...game.data, markers: game.data.markers.map((marker) => ({ ...marker, isTarget: true })) },
    }).success).toBe(false);
    expect(blockSchema.safeParse({
      ...game,
      data: { ...game.data, successMessage: " " },
    }).success).toBe(false);
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
