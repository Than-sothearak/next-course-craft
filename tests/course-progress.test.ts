import { describe, expect, it } from "vitest";
import { canCompleteLesson, getCourseProgress, getFlipCardProgressId, getInitiallyViewedInteractionIds, getInteractiveBlockProgressIds, getInteractiveItemProgressId, getLessonReadingProgress, getPendingFlipCardIds, getPendingInteractiveProgressIds, hasReachedContentEnd, subscribeToScroll } from "../lib/export/progress";
import type { ContentBlock } from "../lib/schemas/block";

describe("standalone learner progress", () => {
  it("counts only visited lessons in the current course", () => {
    expect(getCourseProgress(new Set(), ["lesson-a", "lesson-b"])).toBe(0);
    expect(getCourseProgress(new Set(["lesson-a", "old-lesson"]), ["lesson-a", "lesson-b"])).toBe(50);
    expect(getCourseProgress(new Set(["lesson-a", "lesson-b"]), ["lesson-a", "lesson-b"])).toBe(100);
  });

  it("returns zero for a course without lessons", () => {
    expect(getCourseProgress(new Set(["old-lesson"]), [])).toBe(0);
  });

  it("updates scroll progress when the lesson is scrolled and stops after cleanup", () => {
    const target = new EventTarget();
    let updates = 0;
    const stop = subscribeToScroll(target, () => { updates += 1; });

    target.dispatchEvent(new Event("scroll"));
    expect(updates).toBe(1);

    stop();
    target.dispatchEvent(new Event("scroll"));
    expect(updates).toBe(1);
  });

  it("requires the lesson end to be reached and all Continue gates to be cleared", () => {
    const atEnd = { scrollHeight: 1200, clientHeight: 600, scrollTop: 600 };
    expect(hasReachedContentEnd(atEnd)).toBe(true);
    expect(canCompleteLesson({ ...atEnd, hasPendingContinue: false })).toBe(true);
    expect(canCompleteLesson({ ...atEnd, hasPendingContinue: true })).toBe(false);
    expect(canCompleteLesson({ scrollHeight: 1200, clientHeight: 600, scrollTop: 300, hasPendingContinue: false })).toBe(false);
  });

  it("keeps each flip card pending until that card has been opened", () => {
    const blocks: ContentBlock[] = [
      {
        id: "flip-block",
        version: 1,
        type: "flipCard",
        width: "small",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: {
          cards: [
            { id: "one", frontLabel: "Question", front: { type: "text", text: "A" }, backLabel: "Answer", back: { type: "text", text: "A" } },
            { id: "two", frontLabel: "Question", front: { type: "text", text: "B" }, backLabel: "Answer", back: { type: "text", text: "B" } },
          ],
        },
      },
      {
        id: "continue",
        version: 1,
        type: "divider",
        width: "small",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: { style: "continue", label: "Continue", completionType: "none" },
      },
    ];
    const firstCard = getFlipCardProgressId("flip-block", "one");
    const secondCard = getFlipCardProgressId("flip-block", "two");

    expect(getPendingFlipCardIds(blocks, new Set(), 1)).toEqual([firstCard, secondCard]);
    expect(getPendingFlipCardIds(blocks, new Set([firstCard]), 1)).toEqual([secondCard]);
    expect(getPendingFlipCardIds(blocks, new Set([firstCard, secondCard]))).toEqual([]);
  });

  it("tracks every interactive block item before a required Continue gate", () => {
    const blocks: ContentBlock[] = [
      {
        id: "accordion",
        version: 1,
        type: "accordion",
        width: "medium",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: { layout: "tabs", items: [{ id: "one", title: "One", body: "First" }, { id: "two", title: "Two", body: "Second" }] },
      },
      {
        id: "graphic",
        version: 1,
        type: "labeledGraphic",
        width: "full",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: { src: "/diagram.png", alt: "Diagram", markers: [{ id: "input", label: "Input", description: "Input", x: 20, y: 20 }, { id: "output", label: "Output", description: "Output", x: 80, y: 80 }] },
      },
      {
        id: "steps",
        version: 1,
        type: "processSteps",
        width: "medium",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: { steps: [{ id: "first", title: "First", body: "Do this" }, { id: "second", title: "Second", body: "Then this" }] },
      },
      {
        id: "check",
        version: 1,
        type: "knowledgeCheck",
        width: "small",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: { question: "Question?", options: ["A", "B"], correctOptionIndex: 0, correctFeedback: "Correct", incorrectFeedback: "Try again" },
      },
      {
        id: "reflection",
        version: 1,
        type: "survey",
        width: "small",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: { question: "How was it?", minLabel: "Low", maxLabel: "High" },
      },
      {
        id: "video",
        version: 1,
        type: "video",
        width: "small",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: { src: "https://example.com/lesson.mp4", captions: "" },
      },
    ];
    const allIds = blocks.flatMap((block) => getInteractiveBlockProgressIds(block));
    const visibleAtStart = getInitiallyViewedInteractionIds(blocks);
    const pending = getPendingInteractiveProgressIds(blocks, new Set(visibleAtStart));

    expect(allIds).toContain(getInteractiveItemProgressId("accordion", "section", "two"));
    expect(allIds).toContain(getInteractiveItemProgressId("graphic", "marker", "output"));
    expect(visibleAtStart).not.toContain(getInteractiveItemProgressId("graphic", "marker", "input"));
    expect(allIds).toContain(getInteractiveItemProgressId("steps", "step", "second"));
    expect(allIds).toContain("check:answer");
    expect(allIds).toContain("reflection:submitted");
    expect(allIds).toContain("video:watched");
    expect(pending).toHaveLength(allIds.length - visibleAtStart.length);
    expect(getPendingInteractiveProgressIds(blocks, new Set(allIds))).toEqual([]);
  });

  it("keeps the lesson ring below complete at Continue gates and reaches 100 after the final section", () => {
    expect(getLessonReadingProgress({ scrollHeight: 1200, clientHeight: 600, scrollTop: 600, revealedContinueCount: 0, totalContinueCount: 1 })).toBe(50);
    expect(getLessonReadingProgress({ scrollHeight: 1200, clientHeight: 600, scrollTop: 300, revealedContinueCount: 1, totalContinueCount: 1 })).toBe(75);
    expect(getLessonReadingProgress({ scrollHeight: 1200, clientHeight: 600, scrollTop: 600, revealedContinueCount: 1, totalContinueCount: 1 })).toBe(100);
  });
});
