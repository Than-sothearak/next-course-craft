import { describe, expect, it } from "vitest";
import { canCompleteLesson, getLessonReadingProgress, getPlayerProgress, hasReachedContentEnd, subscribeToScroll } from "../lib/player/progress";

describe("standalone learner progress", () => {
  it("counts only visited lessons in the current course", () => {
    expect(getPlayerProgress(new Set(), ["lesson-a", "lesson-b"])).toBe(0);
    expect(getPlayerProgress(new Set(["lesson-a", "old-lesson"]), ["lesson-a", "lesson-b"])).toBe(50);
    expect(getPlayerProgress(new Set(["lesson-a", "lesson-b"]), ["lesson-a", "lesson-b"])).toBe(100);
  });

  it("returns zero for a course without lessons", () => {
    expect(getPlayerProgress(new Set(["old-lesson"]), [])).toBe(0);
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

  it("keeps the lesson ring below complete at Continue gates and reaches 100 after the final section", () => {
    expect(getLessonReadingProgress({ scrollHeight: 1200, clientHeight: 600, scrollTop: 600, revealedContinueCount: 0, totalContinueCount: 1 })).toBe(50);
    expect(getLessonReadingProgress({ scrollHeight: 1200, clientHeight: 600, scrollTop: 300, revealedContinueCount: 1, totalContinueCount: 1 })).toBe(75);
    expect(getLessonReadingProgress({ scrollHeight: 1200, clientHeight: 600, scrollTop: 600, revealedContinueCount: 1, totalContinueCount: 1 })).toBe(100);
  });
});
