"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";

export type SlidePresentationContextValue = {
  slides: readonly SlideItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getLockMessage: (id: string) => string | null;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  menu: ReactNode;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
};

export const SlidePresentationContext = createContext<SlidePresentationContextValue | null>(null);
export function useSlidePresentationContext() { return useContext(SlidePresentationContext); }
