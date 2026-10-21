import type { ContentBlock } from "@/lib/schemas/block";

export type FlipCard = Extract<ContentBlock, { type: "flipCard" }>['data']['cards'][number];

export type FlipCardSide = "front" | "back";

export type FlipCardFace = FlipCard[FlipCardSide];

export type MediaLibraryTarget =
  | "image"
  | "gallery"
  | "video"
  | "attachment"
  | "labeledGraphic"
  | { type: "flipCard"; cardId: string; side: FlipCardSide };
