import { describe, expect, it } from "vitest";
import { backgroundPaint, colorValueSchema, gradientColor, parseGradient, representativeColor, textPaint } from "@/lib/color";
import { blockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { slideMasterSchema } from "@/lib/editor/slide-design";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { Course } from "@/models/Course";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InteractiveLabeledGraphic } from "@/app/courses/[courseId]/preview/interactive-blocks";

const gradient = gradientColor("#2563eb", "#f97316", 135);

describe("presentation color values", () => {
  it("accepts bounded two-stop gradients and rejects arbitrary CSS or image URLs", () => {
    expect(colorValueSchema.parse(gradient)).toBe(gradient);
    expect(parseGradient(gradient)).toEqual({ start: "#2563eb", end: "#f97316", angle: 135 });
    for (const value of ["red", "url(https://example.com/image.png)", "linear-gradient(361deg, #2563eb 0%, #f97316 100%)", "linear-gradient(-1deg, #2563eb 0%, #f97316 100%)", "linear-gradient(90deg, red, blue)", gradient + ";color:red", "linear-gradient(90deg, #2563eb 0%, url(x) 100%)"]) expect(colorValueSchema.safeParse(value).success).toBe(false);
  });

  it("applies opacity to both stops without fading text or other object content", () => {
    expect(backgroundPaint(gradient, 50)).toEqual({ backgroundColor: "transparent", backgroundImage: "linear-gradient(135deg, rgba(37, 99, 235, 0.5) 0%, rgba(249, 115, 22, 0.5) 100%)" });
    expect(backgroundPaint("#2563eb")).toEqual({ backgroundColor: "#2563eb" });
    expect(textPaint(gradient)).toMatchObject({ backgroundImage: gradient, color: "transparent", backgroundClip: "text" });
    expect(representativeColor(gradientColor("#000000", "#ffffff"))).toBe("#808080");
  });

  it("also renders gradient number text and pulses in graphic mini-games", () => {
    const markup = renderToStaticMarkup(createElement(InteractiveLabeledGraphic, { blockId: "game", src: "", alt: "Game scene", interactionMode: "spotTarget", sceneTheme: "data", challengePrompt: "Find the clue", successMessage: "Found it", markerColor: gradient, textColor: gradient, radarColor: gradient, markers: [{ id: "point", label: "Target", description: "Clue", x: 50, y: 50, isTarget: true }] }));
    expect(markup).toContain("background-clip:text");
    expect(markup).toContain("linear-gradient(135deg, rgba(37, 99, 235, 0.4) 0%, rgba(249, 115, 22, 0.4) 100%)");
  });

  it("retains gradients in object-specific colors and offline snapshots", () => {
    const blocks = [
      { type: "heading", data: { text: "Gradient heading", level: 1 } },
      { type: "divider", data: { style: "line", lineColor: gradient } },
      { type: "flipCard", data: { cardBackgroundColor: gradient, cardTextColor: gradient, cards: [{ id: "card", frontLabel: "Question", backLabel: "Answer", front: { type: "text", text: "Front" }, back: { type: "text", text: "Back" } }] } },
      { type: "labeledGraphic", data: { src: "/diagram.png", alt: "Diagram", markerColor: gradient, textColor: gradient, radarColor: gradient, markers: [{ id: "point", label: "Point", description: "Detail", x: 25, y: 50, color: gradient }] } },
      { type: "chart", data: { chartType: "column", title: "Results", color: gradient, fields: [{ id: "field", label: "Value", value: 5 }] } },
      { type: "processSteps", data: { accentColor: gradient, steps: [{ id: "one", title: "One", body: "First" }, { id: "two", title: "Two", body: "Second" }] } },
    ].map((block, index) => blockSchema.parse({ ...block, id: `block-${index}`, version: 1, slideBackground: { color: gradient, opacity: 70 } }));
    const snapshot = editorSnapshotSchema.parse({ title: "Slides", description: "", revision: 1, courseLayout: "slides", slideMaster: { backgroundColor: gradient, textColor: gradient, accentColor: gradient, header: { backgroundColor: gradient, textColor: gradient }, footer: { backgroundColor: gradient, textColor: gradient, borderColor: gradient } }, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Colors", order: 0, blocks }] });
    expect(parseScorm12Snapshot(JSON.parse(JSON.stringify(snapshot)))).toMatchObject(snapshot);
    const document = new Course({ ownerId: "123456789012345678901234", title: "Slides", slideMaster: snapshot.slideMaster });
    expect(document.validateSync()).toBeUndefined();
    expect(slideMasterSchema.parse(document.toObject().slideMaster)).toEqual(snapshot.slideMaster);
  });
});
