/** Logical canvas sizes shared by authoring, thumbnails and standalone learners. */
export const slideAudioSizes = {
  small: { label: "Small", width: 24, height: 32, button: 28, icon: 16, gap: 8 },
  medium: { label: "Medium", width: 32, height: 54, button: 36, icon: 22, gap: 12 },
  large: { label: "Large", width: 48, height: 68, button: 44, icon: 26, gap: 12 },
} as const;
export type SlideAudioSize = keyof typeof slideAudioSizes;
export const defaultSlideAudioSize: SlideAudioSize = "small";
