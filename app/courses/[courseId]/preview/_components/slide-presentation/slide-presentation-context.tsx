"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";
import type { SlideNavigationGuide } from "@/lib/editor/slide-design";

export type SlidePresentationContextValue = {
  slides: readonly SlideItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRestart: () => void;
  getLockMessage: (id: string) => string | null;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  menu: ReactNode;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  courseId: string;
  standalone: boolean;
  playInstructionAudio: (src: string) => void;
  pauseInstructionAudio: () => void;
  instructionAudioPlaying: boolean;
  instructionAudioSource: string;
  instructionAudioControl: ReactNode;
  navigationGuide?: SlideNavigationGuide;
  guideStep: number | null;
  onGuideStep: (step: number | null) => void;
};

export const SlidePresentationContext = createContext<SlidePresentationContextValue | null>(null);
export function useSlidePresentationContext() { return useContext(SlidePresentationContext); }
