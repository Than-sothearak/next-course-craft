// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveAccordion, InteractiveFlipCard, InteractiveKnowledgeCheck, InteractiveLabeledGraphic, InteractiveProcessSteps, InteractiveSurvey } from "../app/courses/[courseId]/preview/interactive-blocks";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("interactive knowledge check", () => {
  it("checks a selected answer and shows author feedback, then resets feedback for another choice", () => {
    const onAnswerChecked = vi.fn();
    act(() => root.render(createElement(InteractiveKnowledgeCheck, {
      blockId: "check-1",
      question: "Which answer is correct?",
      options: ["First answer", "Second answer"],
      correctOptionIndex: 1,
      correctFeedback: "That is right.",
      incorrectFeedback: "Try the other answer.",
      onAnswerChecked,
    })));

    const checkButton = container.querySelector<HTMLButtonElement>('button[type="button"]')!;
    expect(checkButton.disabled).toBe(true);

    const firstAnswer = container.querySelector<HTMLInputElement>('input[value="0"]')!;
    act(() => firstAnswer.click());
    expect(checkButton.disabled).toBe(false);
    act(() => checkButton.click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Try the other answer.");

    const secondAnswer = container.querySelector<HTMLInputElement>('input[value="1"]')!;
    act(() => secondAnswer.click());
    expect(container.querySelector('[role="status"]')).toBeNull();
    act(() => checkButton.click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("That is right.");
    expect(onAnswerChecked).toHaveBeenCalledTimes(2);
  });
});

describe("graphic hotspot mini-game", () => {
  it("gives retry feedback, scores a correct hotspot, and lets learners replay", () => {
    const markers = [
      { id: "nearby", label: "Nearby point", description: "This point follows the trend.", x: 48, y: 61, isTarget: false, missFeedback: "That point follows the trend. Try another hotspot." },
      { id: "outlier", label: "Outlier", description: "This point sits outside the main cluster.", x: 78, y: 45, isTarget: true },
      { id: "cluster", label: "Cluster point", description: "This point sits near the main cluster.", x: 63, y: 58, isTarget: false },
    ];
    act(() => root.render(createElement(InteractiveLabeledGraphic, {
      blockId: "data-detective",
      src: "",
      alt: "Analytics dashboard with one isolated point in a scatter plot.",
      markers,
      interactionMode: "spotTarget",
      sceneTheme: "data",
      challengePrompt: "Find the point that breaks the pattern.",
      successMessage: "Signal found! Check the source before explaining it.",
    })));

    expect(container.querySelector('[data-scene-theme="data"]')).not.toBeNull();
    expect(container.textContent).toContain("Find the point that breaks the pattern.");
    const hotspots = container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Inspect hotspot"]');
    expect(hotspots).toHaveLength(3);

    act(() => hotspots[0].click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("That point follows the trend. Try another hotspot.");
    expect(container.textContent).toContain("1 scan");

    act(() => hotspots[1].click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Signal found! Check the source before explaining it.");
    expect(container.textContent).toContain("85");
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Play again"]')).not.toBeNull();

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Play again"]')?.click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Tap a hotspot in the scene to investigate it.");
    expect(container.textContent).toContain("0 scans");
  });
});

describe("themed explore graphic", () => {
  it("renders a local network scene with a bounded canvas and accessible description", () => {
    act(() => root.render(createElement(InteractiveLabeledGraphic, {
      blockId: "network-explore",
      src: "",
      alt: "Network diagram with a client, router, access point, and service.",
      markers: [
        { id: "client", label: "Client", description: "The client starts a request.", x: 19, y: 53 },
        { id: "router", label: "Router", description: "The router forwards packets.", x: 39, y: 43 },
      ],
      interactionMode: "explore",
      sceneTheme: "network",
    })));

    const canvas = container.querySelector<HTMLElement>("[data-testid='labeled-graphic-canvas']");
    expect(container.querySelector('[data-scene-theme="network"]')).not.toBeNull();
    expect(canvas?.className).toContain("aspect-video");
    expect(container.textContent).toContain("Network diagram with a client, router, access point, and service.");
    expect(container.querySelectorAll(".labeled-graphic-radar")).toHaveLength(2);
  });
});

describe("interactive flip card", () => {
  it("tracks clicks per card, supports multiple cards, and can flip back", () => {
    const onCardReveal = vi.fn();
    act(() => root.render(createElement(InteractiveFlipCard, {
      blockId: "block-1",
      cards: [
        {
          id: "card-a",
          frontLabel: "Question",
          front: { type: "text", text: "What is active recall?" },
          backLabel: "Answer",
          back: { type: "text", text: "Retrieving information from memory." },
        },
        {
          id: "card-b",
          frontLabel: "Look",
          front: { type: "text", text: "What do you see?" },
          backLabel: "Image",
          back: { type: "image", src: "https://example.com/answer.png", alt: "A simple diagram" },
        },
      ],
      onCardReveal,
    })));

    const flipButtons = container.querySelectorAll<HTMLButtonElement>('button[aria-pressed="false"]');
    expect(flipButtons).toHaveLength(2);
    expect(container.firstElementChild?.className).toContain("@container/flip-cards");
    const grid = container.firstElementChild?.firstElementChild;
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("@min-[36rem]/flip-cards:grid-cols-2");
    expect(grid?.className).not.toContain("sm:grid-cols-2");
    expect(flipButtons[0].className).toContain("min-w-0");
    expect(container.querySelector('img[alt="A simple diagram"]')).not.toBeNull();
    expect(flipButtons[0].getAttribute("aria-label")).toBe("Flip card 1 to reveal the back");

    act(() => flipButtons[0].click());
    expect(container.querySelector('button[aria-pressed="true"]')?.getAttribute("aria-label")).toBe("Show the front of card 1");
    expect(onCardReveal).toHaveBeenCalledWith("block-1:card-a");

    act(() => container.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')!.click());
    expect(container.querySelectorAll('button[aria-pressed="false"]')).toHaveLength(2);
  });

  it("uses the card container for three-column layouts and lets long content grow on both faces", () => {
    const longLabel = "LongLabel".repeat(30);
    const longText = "A complete explanation.\n".repeat(40);
    const cards = Array.from({ length: 3 }, (_, index) => ({
      id: `card-${index}`,
      frontLabel: longLabel,
      front: { type: "text" as const, text: "A question" },
      backLabel: "Answer",
      back: { type: "text" as const, text: longText },
    }));
    act(() => root.render(createElement(InteractiveFlipCard, { blockId: "long-cards", cards })));
    const grid = container.firstElementChild?.firstElementChild;
    expect(grid?.className).toContain("@min-[56rem]/flip-cards:grid-cols-3");
    expect(grid?.className).not.toContain("xl:grid-cols-3");
    const faces = container.querySelectorAll('span[aria-hidden]');
    expect(faces).toHaveLength(6);
    for (const face of faces) {
      expect(face.className).toContain("min-w-0");
      expect(face.className).toContain("@min-[36rem]/flip-cards:p-6");
      expect(face.className).not.toContain("overflow-hidden");
    }
    expect(faces[0].firstElementChild?.className).toContain("[overflow-wrap:anywhere]");
    act(() => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(faces[1].getAttribute("aria-hidden")).toBe("false");
    expect(faces[1].textContent).toContain(longText);
  });

  it("applies the selected maximum columns, card style, and colors", () => {
    act(() => root.render(createElement(InteractiveFlipCard, {
      blockId: "styled-cards",
      cards: Array.from({ length: 5 }, (_, index) => ({
        id: `card-${index}`,
        frontLabel: "Question",
        front: { type: "text" as const, text: `Prompt ${index + 1}` },
        backLabel: "Answer",
        back: { type: "text" as const, text: `Answer ${index + 1}` },
      })),
      cardsPerRow: 5,
      cardStyle: "outlined",
      cardBackgroundColor: "#fef3c7",
      cardTextColor: "#1f2937",
    })));

    const grid = container.firstElementChild?.firstElementChild;
    expect(grid?.className).toContain("@min-[64rem]/flip-cards:grid-cols-5");
    const flipButton = container.querySelector<HTMLButtonElement>("button")!;
    expect(flipButton.className).toContain("rounded-xl");
    const face = container.querySelector<HTMLElement>('span[aria-hidden="false"]')!;
    expect(face.style.backgroundColor).toBe("rgb(254, 243, 199)");
    expect(face.style.color).toBe("rgb(31, 41, 55)");
    expect(face.style.borderWidth).toBe("2px");
  });

  it("also gives single image cards a responsive container", () => {
    act(() => root.render(createElement(InteractiveFlipCard, {
      blockId: "image-card",
      cards: [{ id: "image", frontLabel: "Image", front: { type: "image", src: "/wide.png", alt: "Wide diagram" }, backLabel: "Explanation", back: { type: "text", text: "An explanation" } }],
    })));
    expect(container.firstElementChild?.className).toContain("@container/flip-cards");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector("img")?.className).toContain("max-w-full");
    expect(container.querySelector("img")?.className).toContain("h-auto");
  });
});

describe("interactive reveal blocks", () => {
  it("reveals one accordion explanation at a time and switches tabs", () => {
    const onItemInteract = vi.fn();
    const items = [
      { id: "one", title: "First section", body: "First explanation" },
      { id: "two", title: "Second section", body: "Second explanation" },
    ];
    act(() => root.render(createElement(InteractiveAccordion, {
      blockId: "accordion-1",
      layout: "accordion",
      displayMode: "oneByOne",
      items,
      onItemInteract,
    })));
    expect(container.textContent).toContain("First explanation");
    expect(container.textContent).not.toContain("Second explanation");
    const secondSection = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Second section"));
    act(() => secondSection?.click());
    expect(onItemInteract).toHaveBeenCalledWith("two");
    expect(container.textContent).toContain("Second explanation");
    expect(container.textContent).not.toContain("First explanation");

    act(() => root.render(createElement(InteractiveAccordion, {
      key: "tabs-version",
      blockId: "tabs-1",
      layout: "tabs",
      displayMode: "oneByOne",
      items,
      onItemInteract,
    })));
    const secondTab = container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]');
    act(() => secondTab?.click());
    expect(onItemInteract).toHaveBeenCalledWith("two");
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Second section");
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toBe("Second explanation");
  });

  it("keeps previously opened accordion explanations visible in show-all mode", () => {
    act(() => root.render(createElement(InteractiveAccordion, {
      blockId: "accordion-all",
      layout: "accordion",
      displayMode: "all",
      items: [
        { id: "one", title: "First section", body: "First explanation" },
        { id: "two", title: "Second section", body: "Second explanation" },
      ],
    })));

    expect(container.textContent).toContain("First explanation");
    expect(container.textContent).not.toContain("Second explanation");

    const secondSection = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Second section"));
    act(() => secondSection?.click());

    expect(container.textContent).toContain("First explanation");
    expect(container.textContent).toContain("Second explanation");
    expect(container.querySelectorAll('button[aria-expanded="true"]')).toHaveLength(2);
  });

  it("reveals image explanations from labeled markers", () => {
    const onMarkerInteract = vi.fn();
    act(() => root.render(createElement(InteractiveLabeledGraphic, {
      blockId: "graphic-1",
      src: "/diagram.png",
      alt: "System diagram",
      markers: [
        { id: "marker-one", label: "Input", description: "Information enters here.", x: 20, y: 30, color: "#dc2626" },
        { id: "marker-two", label: "Output", description: "The result appears here.", x: 80, y: 70, color: "#2563eb" },
      ],
      markerColor: "#123456",
      textColor: "#fef3c7",
      radarColor: "#f97316",
      onMarkerInteract,
    })));
    expect(container.querySelector('img[alt="System diagram"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Information enters here.");
    expect(container.querySelector(".labeled-graphic-radar")).not.toBeNull();
    const markerButtons = [...container.querySelectorAll<HTMLButtonElement>(".labeled-graphic-radar")];
    expect(markerButtons).toHaveLength(2);
    expect(markerButtons.map((marker) => marker.style.backgroundColor)).toEqual([
      "rgb(18, 52, 86)",
      "rgb(18, 52, 86)",
    ]);
    expect(markerButtons[0].style.color).toBe("rgb(254, 243, 199)");
    expect(markerButtons[0].style.getPropertyValue("--radar-color")).toBe("#f97316");
    const canvas = container.querySelector<HTMLDivElement>("[data-testid='labeled-graphic-canvas']")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 320,
      bottom: 240,
      width: 320,
      height: 240,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("labeled-graphic-popover")) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 272,
          bottom: 100,
          width: 272,
          height: 100,
          toJSON: () => ({}),
        };
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      };
    });
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Output: show explanation"]')!.click());
    expect(onMarkerInteract).toHaveBeenCalledWith("marker-two");
    expect(container.textContent).toContain("The result appears here.");
    const popup = container.querySelector<HTMLElement>(".labeled-graphic-popover");
    expect(popup).not.toBeNull();
    expect(popup?.style.left).toBe("8px");
    expect(popup?.style.top).toBe("56px");
    expect(popup?.style.transform).toBe("");
    act(() => {
      container.querySelector('[role="group"]')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(container.querySelector(".labeled-graphic-popover")).toBeNull();
  });

  it("drags labeled graphic points directly on the image", () => {
    const onMarkerPositionChange = vi.fn();
    act(() => root.render(createElement(InteractiveLabeledGraphic, {
      blockId: "editable-graphic",
      src: "/diagram.png",
      alt: "Editable diagram",
      editable: true,
      markers: [
        { id: "point-a", label: "Point A", description: "First point", x: 20, y: 30 },
      ],
      onMarkerPositionChange,
    })));
    const canvas = container.querySelector<HTMLDivElement>("[data-testid='labeled-graphic-canvas']")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 200,
      left: 100,
      top: 200,
      right: 300,
      bottom: 300,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });
    const marker = container.querySelector<HTMLButtonElement>('[aria-label="Point A: show explanation"]')!;
    const pointerEvent = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        clientX: { value: clientX },
        clientY: { value: clientY },
      });
      return event;
    };
    act(() => marker.dispatchEvent(pointerEvent("pointerdown", 140, 230)));
    act(() => marker.dispatchEvent(pointerEvent("pointermove", 260, 280)));
    act(() => marker.dispatchEvent(pointerEvent("pointerup", 260, 280)));
    act(() => marker.click());

    expect(onMarkerPositionChange).toHaveBeenLastCalledWith("point-a", { x: 80, y: 80 });
    expect(container.querySelector(".labeled-graphic-popover")).toBeNull();
  });

  it("moves through process steps one at a time", () => {
    const onStepInteract = vi.fn();
    act(() => root.render(createElement(InteractiveProcessSteps, {
      blockId: "process-1",
      steps: [
        { id: "step-one", title: "Prepare", body: "Gather the materials." },
        { id: "step-two", title: "Complete the task", body: "Follow the instructions." },
      ],
      onStepInteract,
    })));
    expect(container.textContent).toContain("Gather the materials.");
    const next = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Next step"));
    act(() => next?.click());
    expect(onStepInteract).toHaveBeenCalledWith("step-two");
    expect(container.textContent).toContain("Follow the instructions.");
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("2");
    const previous = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Previous step"));
    act(() => previous?.click());
    expect(onStepInteract).toHaveBeenCalledWith("step-one");
    expect(container.textContent).toContain("Gather the materials.");
  });
});

describe("interactive survey", () => {
  it("requires a rating before finishing and acknowledges the reflection", () => {
    const onSubmit = vi.fn();
    act(() => root.render(createElement(InteractiveSurvey, {
      blockId: "survey-1",
      question: "How confident are you?",
      minLabel: "Not yet",
      maxLabel: "Very confident",
      onSubmit,
    })));

    const submitButton = container.querySelector<HTMLButtonElement>('button[type="button"]')!;
    expect(submitButton.disabled).toBe(true);

    const rating = container.querySelector<HTMLInputElement>('input[value="4"]')!;
    act(() => rating.click());
    expect(submitButton.disabled).toBe(false);
    act(() => submitButton.click());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Thanks for taking a moment to reflect.");

    const anotherRating = container.querySelector<HTMLInputElement>('input[value="5"]')!;
    act(() => anotherRating.click());
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
