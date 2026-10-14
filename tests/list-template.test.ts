/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { applyListTemplateToHtml } from "../lib/editor/list-template";

describe("list template style changes", () => {
  it("changes bullet markers without replacing authored list text or inline formatting", () => {
    const html = applyListTemplateToHtml(
      '<p>Keep this introduction.</p><ul data-list-style="circle"><li><p><strong>Authored first item</strong></p></li><li><p>Authored second item</p></li></ul>',
      '<ul data-list-style="check"><li><p>Template placeholder</p></li></ul>',
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const list = document.querySelector("ul");

    expect(document.body.textContent).toContain("Keep this introduction.");
    expect(list?.getAttribute("data-list-style")).toBe("check");
    expect([...document.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "Authored first item",
      "Authored second item",
    ]);
    expect(list?.querySelector("strong")?.textContent).toBe("Authored first item");
    expect(document.body.textContent).not.toContain("Template placeholder");
  });

  it("can change bullet lists to numbered styles while keeping their items", () => {
    const html = applyListTemplateToHtml(
      '<ul data-list-style="dash"><li><p>Existing idea</p></li><li><p>Another idea</p></li></ul>',
      '<ol type="I"><li><p>Template step</p></li></ol>',
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const list = document.querySelector("ol");

    expect(list?.getAttribute("type")).toBe("I");
    expect([...document.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "Existing idea",
      "Another idea",
    ]);
    expect(document.querySelector("ul")).toBeNull();
  });
});
