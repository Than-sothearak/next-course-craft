/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveProcessSteps } from "@/app/courses/[courseId]/preview/interactive-blocks";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("process step ordering activity", () => {
  let root: Root;
  let container: HTMLDivElement;
  const steps = [
    { id: "prepare", title: "Prepare the soil", body: "Make a seedbed." },
    { id: "plant", title: "Plant the seeds", body: "Place seeds at the right depth." },
  ];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("requires a correct order before reporting completion", async () => {
    const onActivityComplete = vi.fn();
    await act(async () => root.render(<InteractiveProcessSteps blockId="crop-order" steps={steps} activityMode="ordering" onActivityComplete={onActivityComplete} />));

    const list = container.querySelector<HTMLOListElement>('ol[aria-label="Steps to arrange"]')!;
    const initiallyOrderedIds = [...list.querySelectorAll<HTMLLIElement>("li")].map((item) => item.dataset.orderingStepId);
    expect(initiallyOrderedIds).not.toEqual(steps.map((step) => step.id));
    expect(onActivityComplete).not.toHaveBeenCalled();

    const check = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Check order"))!;
    await act(async () => check.click());
    expect(onActivityComplete).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Not quite yet");

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label^="Move "][aria-label$=" down"]')!.click());
    await act(async () => check.click());

    expect([...list.querySelectorAll<HTMLLIElement>("li")].map((item) => item.dataset.orderingStepId)).toEqual(steps.map((step) => step.id));
    expect(onActivityComplete).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Correct order");
    expect(check.disabled).toBe(true);
  });
});
