import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonEditSkeleton } from "@/app/courses/[courseId]/edit/_components/lesson-edit-skeleton";

describe("lesson editor loading fallback", () => {
  it("announces loading and renders the lesson editor placeholder layout", () => {
    const markup = renderToStaticMarkup(createElement(LessonEditSkeleton));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Loading lesson editor"');
    expect(markup).toContain('aria-label="Loading lesson content"');
    expect(markup.match(/motion-safe:animate-pulse/g)?.length).toBeGreaterThan(10);
  });
});
