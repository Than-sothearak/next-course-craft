"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { validMediaProgress, type MediaProgress, type MediaPlaybackProgress } from "@/lib/export/media-playback";

const MediaProgressContext = createContext<{
  mediaProgress: MediaProgress;
  restoreMediaProgress: (value: unknown) => void;
  reportMediaProgress: (id: string, progress: MediaPlaybackProgress) => void;
}>({
  mediaProgress: {} as MediaProgress,
  restoreMediaProgress: () => {},
  reportMediaProgress: () => {},
});

export function MediaProgressProvider({ children }: { children: ReactNode }) {
  const [mediaProgress, setMediaProgress] = useState<MediaProgress>({});
  const restoreMediaProgress = useCallback((value: unknown) => setMediaProgress((current) => ({ ...validMediaProgress(value), ...current })), []);
  const reportMediaProgress = useCallback((id: string, progress: MediaPlaybackProgress) => {
    setMediaProgress((current) => {
      const previous = current[id];
      if (previous?.source === progress.source && previous.seconds >= progress.seconds && previous.duration === progress.duration) return current;
      return { ...current, [id]: progress };
    });
  }, []);
  return <MediaProgressContext value={{ mediaProgress, restoreMediaProgress, reportMediaProgress }}>{children}</MediaProgressContext>;
}

export const useMediaProgress = () => useContext(MediaProgressContext);
