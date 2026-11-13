import type { ContentBlock, ProcessMediaLayout, ProcessStepsStyle } from "../schemas/block";

export const defaultProcessMediaLayout: ProcessMediaLayout = { width: 640, height: 360, fit: "contain", position: "center" };

type ProcessStep = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number];

/** Older steps stored downloads in the media slot. Keep them editable without losing files. */
export function resolveProcessStepAssets(step: Pick<ProcessStep, "media" | "attachment">) {
  const playable = step.media && /^(image|video|audio)\//.test(step.media.mimeType);
  return { media: playable ? step.media : undefined, attachment: step.attachment ?? (playable ? undefined : step.media) };
}

export function hasProcessStepMedia(block: ContentBlock) {
  return block.type === "processSteps" && (Boolean(block.data.mediaLayout) || block.data.steps.some((step) => Boolean(step.media)));
}

export const processStepsPresets = [
  { style: "cards", title: "Classic cards", description: "A focused card with a progress bar.", accentColor: undefined },
  { style: "numbered", title: "Numbered steps", description: "Numbered navigation with a bold step marker.", accentColor: undefined },
  { style: "timeline", title: "Step timeline", description: "A connected sequence beside the current instructions.", accentColor: undefined },
  { style: "spotlight", title: "Spotlight steps", description: "A tinted panel that highlights each action.", accentColor: undefined },
  { style: "minimal", title: "Minimal steps", description: "A simple, open layout with fewer borders.", accentColor: undefined },
  { style: "slider", title: "Step slider", description: "A simple image and text card with centered side arrows.", accentColor: undefined },
] as const satisfies readonly { style: ProcessStepsStyle; title: string; description: string; accentColor?: string }[];

export const processStepsSample = [
  { id: "step-1", title: "Prepare", body: "Gather what you need and identify the goal." },
  { id: "step-2", title: "Work through the task", body: "Follow the process and focus on one action at a time." },
  { id: "step-3", title: "Review", body: "Check your result and decide whether any step needs another pass." },
];

type ProcessData = Extract<ContentBlock, { type: "processSteps" }>["data"];

export function applyProcessStepsPreset(original: ProcessData, preset: ProcessData): ProcessData {
  return {
    ...original, ...preset,
    style: preset.style ?? "cards",
    accentColor: preset.accentColor,
    showNumbers: preset.showNumbers ?? true,
    steps: original.steps,
  };
}
