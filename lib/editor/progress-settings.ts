import type { ContentBlock } from "@/lib/schemas/block";
import type { CourseNavigationMode } from "./navigation";

/** Include empty activities so configuring them later keeps the chosen rule. */
export function isProgressCapableBlock(block: ContentBlock): boolean {
  switch (block.type) {
    case "flipCard": case "accordion": case "labeledGraphic": case "processSteps":
    case "balloonArcher": case "peelToReveal": case "hangingRopeCards":
    case "knowledgeCheck": case "survey": case "interactionButton":
    case "audio": case "video": case "audioInstruction":
      return true;
    case "divider": return block.data.style === "continue";
    default: return false;
  }
}

export function isProgressButton(block: ContentBlock): boolean {
  return block.type === "interactionButton" || (block.type === "divider" && block.data.style === "continue");
}

function mapBlockRequirements(blocks: readonly ContentBlock[], required: (block: ContentBlock) => boolean | undefined): ContentBlock[] {
  return blocks.map((block) => {
    const value = required(block);
    const next = isProgressCapableBlock(block) && value !== undefined ? { ...block, requiredForProgress: value } : block;
    return next.type === "interactionButton"
      ? { ...next, data: { ...next.data, popup: { ...next.data.popup, blocks: mapBlockRequirements(next.data.popup.blocks, required) } } }
      : next;
  });
}

export function setBlocksRequiredForProgress(blocks: readonly ContentBlock[], required: boolean): ContentBlock[] {
  return mapBlockRequirements(blocks, () => required);
}

/** New buttons are required in every mode; authored overrides stay editable. */
export function initializeBlockProgress(blocks: readonly ContentBlock[], navigationMode: CourseNavigationMode): ContentBlock[] {
  return mapBlockRequirements(blocks, (block) => isProgressButton(block) || navigationMode === "restricted");
}

export function changeCourseNavigationMode<T extends { navigationMode: CourseNavigationMode; lessons: { blocks: ContentBlock[] }[] }>(course: T, navigationMode: CourseNavigationMode): T {
  if (course.navigationMode === navigationMode) return course;
  if (course.navigationMode !== "restricted" && navigationMode !== "restricted") return { ...course, navigationMode };
  return {
    ...course,
    navigationMode,
    lessons: course.lessons.map((lesson) => ({ ...lesson, blocks: mapBlockRequirements(lesson.blocks, (block) => isProgressButton(block) ? undefined : navigationMode === "restricted") })),
  };
}
