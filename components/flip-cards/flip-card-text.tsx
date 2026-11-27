import type { ComponentProps } from "react";
import { inlineFormattingHtml } from "@/lib/editor/inline-formatting";

type FlipCardTextProps = Omit<ComponentProps<"span">, "children" | "dangerouslySetInnerHTML"> & { text: string };

export function FlipCardText({ text, className = "", ...props }: FlipCardTextProps) {
  return <span {...props} data-flip-card-text className={`lesson-rich-text ${className}`} dangerouslySetInnerHTML={{ __html: inlineFormattingHtml(text) }} />;
}
