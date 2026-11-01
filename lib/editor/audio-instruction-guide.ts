import { z } from "zod";
import { colorValueSchema } from "@/lib/color";
import { defaultSlideAnimation, slideAnimationSchema } from "./slide-animation";

const pointSchema = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });
export const audioGuideAnimationSchema = slideAnimationSchema.extend({ delay: z.number().int().min(0).max(30000).default(0) });
export const audioGuidePopupSchema = z.object({
  x: z.number().min(0).max(84), y: z.number().min(0).max(84),
  width: z.number().min(16).max(100), height: z.number().min(16).max(100),
}).refine((box) => box.x + box.width <= 100 && box.y + box.height <= 100, "Keep the audio guide popup inside the canvas.");
export const audioInstructionGuideSchema = z.object({
  enabled: z.boolean().default(false),
  timing: z.enum(["before", "with", "after"]).default("with"),
  animation: audioGuideAnimationSchema.default(() => ({ ...defaultSlideAnimation })),
  title: z.string().max(120).default("Audio guide"),
  text: z.string().max(3000).default("Listen to the instruction for this part of the slide."),
  point: pointSchema.default({ x: 45, y: 50 }),
  popup: audioGuidePopupSchema.default({ x: 55, y: 28, width: 36, height: 34 }),
  pointColor: colorValueSchema.default("#4f46e5"),
  backgroundColor: colorValueSchema.default("#ffffff"),
  textColor: colorValueSchema.default("#0f172a"),
});
export type AudioInstructionGuide = z.infer<typeof audioInstructionGuideSchema>;
export const defaultAudioInstructionGuide = audioInstructionGuideSchema.parse({});
export type AudioGuideLayout = Pick<AudioInstructionGuide, "point" | "popup">;

export function fitAudioGuidePoint(point: AudioInstructionGuide["point"]): AudioInstructionGuide["point"] {
  return { x: Math.max(0, Math.min(100, point.x)), y: Math.max(0, Math.min(100, point.y)) };
}

export function fitAudioGuidePopup(box: AudioInstructionGuide["popup"], update: Partial<AudioInstructionGuide["popup"]>): AudioInstructionGuide["popup"] {
  let width = Math.max(16, Math.min(100, update.width ?? box.width));
  let height = Math.max(16, Math.min(100, update.height ?? box.height));
  if (update.width !== undefined && update.x === undefined) width = Math.min(width, 100 - box.x);
  if (update.height !== undefined && update.y === undefined) height = Math.min(height, 100 - box.y);
  return { x: Math.max(0, Math.min(100 - width, update.x ?? box.x)), y: Math.max(0, Math.min(100 - height, update.y ?? box.y)), width, height };
}

export function audioGuideConnector({ point, popup }: AudioGuideLayout) {
  return { x: Math.max(popup.x, Math.min(popup.x + popup.width, point.x)), y: Math.max(popup.y, Math.min(popup.y + popup.height, point.y)) };
}
