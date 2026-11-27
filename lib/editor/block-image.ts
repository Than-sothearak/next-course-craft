import { imageBlockSchema, processStepMediaSchema, type ContentBlock } from "@/lib/schemas/block";
import { getHandoutBlockText } from "@/lib/pdf/content";

export type BlockImageMedia = NonNullable<Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number]["media"]>;

/** Use authored learner content, including formatted text and structured examples. */
export function blockImageInstructions(block: ContentBlock) {
  if (block.type === "audio" || block.type === "audioInstruction" || block.type === "attachment") return "";
  if (block.type === "video") return (block.data.captions ?? "").trim().slice(0, 5000);
  return getHandoutBlockText(block).join("\n").trim().slice(0, 5000);
}

export function insertBlockImage(blocks: readonly ContentBlock[], sourceId: string, media: BlockImageMedia, id: string): ContentBlock[] {
  const index = blocks.findIndex((block) => block.id === sourceId);
  if (index < 0) throw new Error("The source block was removed. Choose another block to generate an image.");
  if (blocks.length >= 500) throw new Error("A lesson can contain up to 500 blocks. Remove a block before adding this image.");
  const image = processStepMediaSchema.parse(media);
  if (!image.mimeType.startsWith("image/")) throw new Error("Choose a generated image to add to this lesson.");
  const caption = blockImageInstructions(blocks[index]).split("\n").find((line) => line.trim())?.slice(0, 500) || "Generated visual guide";
  const block = imageBlockSchema.parse({
    id, version: 1, type: "image", width: "medium", widthCustom: true,
    data: { src: image.src, alt: caption, caption, layout: "full", imageFit: "contain", imageAspectRatio: "16/9" },
  });
  return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
}
