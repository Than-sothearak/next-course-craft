/** @vitest-environment jsdom */

import type { ComponentProps } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatePresence } from "framer-motion";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { describe, expect, it } from "vitest";
import { SortableItem } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/sortable-item";

function renderSortableItem(animateLayout: boolean) {
  return renderToStaticMarkup(
    createElement(
      DndContext,
      null,
      createElement(
        SortableContext,
        { items: ["block-1"], strategy: verticalListSortingStrategy } as ComponentProps<typeof SortableContext>,
        createElement(
          AnimatePresence,
          { initial: false },
          createElement(
            SortableItem,
            { id: "block-1", animateLayout, overlayHandle: true, exit: true } as ComponentProps<typeof SortableItem>,
            createElement("p", null, "Lesson block"),
          ),
        ),
      ),
    ),
  );
}

describe("sortable item layout transitions", () => {
  it("enables position animation only for opted-in lesson blocks", () => {
    expect(renderSortableItem(true)).toContain("sortable-item-layout-transition");
    expect(renderSortableItem(false)).not.toContain("sortable-item-layout-transition");
  });
});
