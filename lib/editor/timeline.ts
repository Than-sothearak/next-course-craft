import type { ContentBlock } from "@/lib/schemas/block";

export type TimelineBlock = Extract<ContentBlock, { type: "timeline" }>;
export type TimelineItem = TimelineBlock["data"]["items"][number];
export const timelinePresets = [
  { style: "vertical", title: "Timeline: Vertical", description: "Alternate events around a centered vertical line." },
  { style: "horizontal", title: "Timeline: Horizontal", description: "Follow labeled events along a horizontal line." },
  { style: "stacked", title: "Timeline: Stacked cards", description: "Stack text cards along a central connecting line." },
] as const;
export const timelineSample: TimelineItem[] = [
  { id: "event-1", label: "Start", title: "Introduce the beginning", body: "Describe the first event and why it matters." },
  { id: "event-2", label: "Next", title: "Follow the development", body: "Explain what changed and how it connects to the previous event." },
  { id: "event-3", label: "Today", title: "Reflect on the outcome", body: "Summarize the result and what learners should remember." },
];

export function applyTimelinePreset(original: TimelineBlock["data"], preset: TimelineBlock["data"]): TimelineBlock["data"] {
  return { ...original, style: preset.style, items: original.items };
}
