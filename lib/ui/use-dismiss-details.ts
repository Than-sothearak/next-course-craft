"use client";

import { useEffect } from "react";

export function useDismissDetailsOnOutsideClick() {
  useEffect(() => {
    function closeDetailsOutside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
        if (!details.contains(event.target as Node)) details.open = false;
      });
    }

    document.addEventListener("pointerdown", closeDetailsOutside);
    return () => document.removeEventListener("pointerdown", closeDetailsOutside);
  }, []);
}
