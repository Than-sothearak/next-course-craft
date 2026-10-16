import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "@/app/loading";

describe("route loading fallback", () => {
  it("announces a visible loading message while a route loads", () => {
    const markup = renderToStaticMarkup(createElement(Loading));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain("Loading page…");
    expect(markup).not.toContain('class="sr-only"');
  });
});
