/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InteractiveFlipCard } from "@/app/courses/[courseId]/preview/_components/interactive-blocks/flip-card";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cards = [{ id: "card", frontLabel: "Prompt", backLabel: "Answer", front: { type: "text" as const, text: "**Explain** ***HTML*** and ==elements==.\nKeep this line." }, back: { type: "text" as const, text: '**Answer** <img src=x onerror="alert(1)"> and ***keyword***.' } }];

describe("flip-card inline formatting", () => {
  let root: Root, container: HTMLDivElement, styles: HTMLStyleElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    styles = document.createElement("style");
    styles.textContent = readFileSync("app/globals.css", "utf8").split("\n").filter((line) => line.startsWith(".lesson-rich-text [data-generated-emphasis=") || line.startsWith(".lesson-rich-text[data-flip-card-text]")).join("\n");
    document.head.append(styles);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); styles.remove(); });

  it.each([false, true])("formats both faces safely in Standard and Presentation views (presentation: %s)", async (presentation) => {
    await act(async () => root.render(<InteractiveFlipCard blockId="block" cards={cards} presentation={presentation} />));
    const front = container.querySelector('[data-flip-card-text][data-block-text-role="title"]')!;
    const back = container.querySelector('[data-flip-card-text][data-block-text-role="body"]')!;
    expect(front.textContent).toBe("Explain HTML and elements.\nKeep this line.");
    expect(front.querySelector("strong")?.textContent).toBe("Explain");
    const keyword = front.querySelector('[data-generated-emphasis="true"]')!;
    expect(keyword.textContent).toBe("HTML");
    expect(getComputedStyle(keyword).padding).toBe("0.06em 0.2em");
    expect(getComputedStyle(keyword).color).toBe("rgb(15, 23, 42)");
    const highlight = Array.from(front.querySelectorAll("span")).find((span) => span.textContent === "elements")!;
    expect(highlight.hasAttribute("data-generated-emphasis")).toBe(false);
    expect(parseFloat(getComputedStyle(highlight).padding || "0")).toBe(0);
    expect(getComputedStyle(highlight).backgroundColor).toBe("rgb(254, 240, 138)");
    expect(back.querySelector("strong")?.textContent).toBe("Answer");
    expect(back.querySelector("img")).toBeNull();
    expect(back.textContent).toContain('<img src=x onerror="alert(1)">');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-flip-card-id="card"]')!.click());
    expect(container.querySelector('[aria-label="Show the front of card 1"]')).not.toBeNull();
    expect(back.querySelector('[data-generated-emphasis="true"]')?.textContent).toBe("keyword");
  });

  it("includes the same safe formatted text in static learner markup", () => {
    const markup = renderToStaticMarkup(<InteractiveFlipCard blockId="block" cards={cards} />);
    expect(markup).toContain("<strong>Explain</strong>");
    expect(markup).toContain('data-generated-emphasis="true"');
    expect(markup).toContain('<span style="background-color: #fef08a">elements</span>');
    expect(markup).not.toContain("***HTML***");
    expect(markup).not.toContain("<img");
  });
});
