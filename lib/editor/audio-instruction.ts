import { createClientId } from "@/lib/client-id";
import { audioInstructionBlockSchema, type ContentBlock } from "@/lib/schemas/block";
import { defaultCanvasSlideFrame, defaultSlideFrame, type SlideCover, type SlideMaster } from "./slide-design";

/** Move legacy cover audio into an editable object without writing during reads. */
export function migrateCoverAudio<T extends { slideCover?: SlideCover; blocks: ContentBlock[] }>(lesson: T, master?: SlideMaster): T {
  const instructions = lesson.slideCover?.instructions;
  if (!instructions?.audioSrc) return lesson;
  const existing = lesson.blocks.some((block) => block.type === "audioInstruction" && block.data.src === instructions.audioSrc);
  const block = audioInstructionBlockSchema.parse({
    id: createClientId(), version: 1, type: "audioInstruction",
    slideFrame: master?.objectLayout === "canvas" ? defaultCanvasSlideFrame(lesson.blocks.length, "audioInstruction", master, true) : defaultSlideFrame(lesson.blocks.length, "audioInstruction"),
    data: { src: instructions.audioSrc, fileName: instructions.audioName, autoPlay: instructions.audioTrigger !== "manual" },
  });
  return { ...lesson, slideCover: { ...lesson.slideCover!, instructions: { ...instructions, audioSrc: "", audioName: "", audioTrigger: "manual" } }, blocks: existing ? lesson.blocks : [...lesson.blocks, block] };
}
