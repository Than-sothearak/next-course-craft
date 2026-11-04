"use client";

import { createContext, useContext } from "react";

export const SlidePlaybackContext = createContext(false);
export function useSlidePlaybackActive() { return useContext(SlidePlaybackContext); }

// Wait for browser/LMS completion restoration before deciding to autoplay a video.
export const SlideProgressReadyContext = createContext(true);
export function useSlideProgressReady() { return useContext(SlideProgressReadyContext); }
