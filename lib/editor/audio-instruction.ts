import { createClientId } from "@/lib/client-id";
import { audioInstructionBlockSchema, type ContentBlock } from "@/lib/schemas/block";
import { defaultSlideFrame, type SlideCover } from "./slide-design";

/** Move legacy cover audio into an editable object without writing during reads. */
export function migrateCoverAudio<T extends { slideCover?: SlideCover; blocks: ContentBlock[] }>(lesson: T): T {
  const instructions = lesson.slideCover?.instructions;
  if (!instructions?.audioSrc) return lesson;
  const existing = lesson.blocks.some((block) => block.type === "audioInstruction" && block.data.src === instructions.audioSrc);
  const block = audioInstructionBlockSchema.parse({
    id: createClientId(), version: 1, type: "audioInstruction",
    slideFrame: defaultSlideFrame(lesson.blocks.length, "audioInstruction"),
    data: { src: instructions.audioSrc, fileName: instructions.audioName, autoPlay: instructions.audioTrigger !== "manual" },
  });
  return { ...lesson, slideCover: { ...lesson.slideCover!, instructions: { ...instructions, audioSrc: "", audioName: "", audioTrigger: "manual" } }, blocks: existing ? lesson.blocks : [...lesson.blocks, block] };
}
