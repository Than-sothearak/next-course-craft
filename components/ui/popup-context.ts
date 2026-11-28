"use client";

import { createContext } from "react";

/** React portals retain this ancestry so nested dialogs belong to their popup. */
export const PopupAncestorsContext = createContext<readonly string[]>([]);

export function isPopupBranch(target: EventTarget | null, id: string): boolean {
  return target instanceof Element && Boolean(target.closest("[data-popup-ancestors]")?.getAttribute("data-popup-ancestors")?.split(" ").includes(id));
}
