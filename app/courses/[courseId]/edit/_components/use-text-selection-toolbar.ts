"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";

export function useTextSelectionToolbar() {
  const [isTextSelected, setIsTextSelected] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const onSelectionUpdate = useCallback(({ editor }: { editor: Editor }) => {
    setIsTextSelected(!editor.state.selection.empty);
  }, []);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target)) return;
      setIsTextSelected(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return { isTextSelected, onSelectionUpdate, rootRef };
}
