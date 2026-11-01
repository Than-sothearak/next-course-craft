import { z } from "zod";
import { colorValueSchema } from "@/lib/color";

export const archerBalloonSchema = z.object({
  id: z.string().min(1).max(64),
  word: z.string().max(40),
  content: z.string().max(3000),
  x: z.number().min(8).max(92),
  y: z.number().min(12).max(64),
  color: colorValueSchema.optional(),
});
export const balloonArcherDataSchema = z.object({
  title: z.string().max(160).default("Balloon Archer"),
  instructions: z.string().max(500).default("Grab the arrow, pull down, aim left or right, and release. Pop each balloon to discover what is inside."),
  backgroundColor: colorValueSchema.default("#ffffff"),
  balloonColor: colorValueSchema.default("#000000"),
  textColor: colorValueSchema.default("#ffffff"),
  bowColor: colorValueSchema.default("#000000"),
  balloons: z.array(archerBalloonSchema).min(1).max(12).default(() => [
    { id: "explore", word: "Explore", content: "Start with a question. What would you like to discover?", x: 25, y: 30 },
    { id: "practice", word: "Practice", content: "Build understanding by trying the idea for yourself.", x: 50, y: 22 },
    { id: "remember", word: "Remember", content: "Connect what you learned to something you already know.", x: 75, y: 38 },
  ]).refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Balloon IDs must be unique."),
});
export type ArcherBalloon = z.infer<typeof archerBalloonSchema>;
export type BalloonArcherData = z.infer<typeof balloonArcherDataSchema>;
