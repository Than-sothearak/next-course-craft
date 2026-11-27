"use client";

import { useLayoutEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { selectionFontSize } from "@/lib/editor/selection-font-size";

export function useSelectionFontSize(editor: Editor) {
  const [size, setSize] = useState<number | null>(() => selectionFontSize(editor));
  useLayoutEffect(() => {
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      // Transactions notify before the editor DOM has finished updating.
      frame = requestAnimationFrame(() => setSize(selectionFontSize(editor)));
    };
    refresh();
    editor.on("transaction", refresh);
    window.addEventListener("resize", refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(editor.view.dom, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class"] });
    for (let parent = editor.view.dom.parentElement; parent; parent = parent.parentElement) {
      observer.observe(parent, { attributes: true, attributeFilter: ["style", "class", "data-course-typography"] });
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      editor.off("transaction", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [editor]);
  return size;
}
