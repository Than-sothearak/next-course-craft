import type { ContentBlock, ProcessStepsStyle } from "../schemas/block";

export const processStepsPresets = [
  { style: "cards", title: "Classic cards", description: "A focused card with a progress bar.", accentColor: undefined },
  { style: "numbered", title: "Numbered steps", description: "Numbered navigation with a bold step marker.", accentColor: "#7c3aed" },
  { style: "timeline", title: "Step timeline", description: "A connected sequence beside the current instructions.", accentColor: "#0f766e" },
  { style: "spotlight", title: "Spotlight steps", description: "A tinted panel that highlights each action.", accentColor: "#ea580c" },
  { style: "minimal", title: "Minimal steps", description: "A simple, open layout with fewer borders.", accentColor: "#334155" },
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
