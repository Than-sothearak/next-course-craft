"use client";

import { createContext, useContext } from "react";

export const SlidePlaybackContext = createContext(false);
export function useSlidePlaybackActive() { return useContext(SlidePlaybackContext); }
