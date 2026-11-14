import { ImageIcon, RotateCcw } from "lucide-react";
import type { BlockTemplate } from "../block-template-data";
import { courseThemeFlipCardGradient } from "@/lib/color";

export function FlipCardTemplatePreview({ cards }: { cards: NonNullable<BlockTemplate["flipCard"]>["cards"] }) {
  const previewCards = cards.slice(0, 2);
  if (previewCards.length === 1) {
    previewCards.push({ ...previewCards[0], id: `${previewCards[0].id}-preview-2` });
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {previewCards.map((card, index) => (
        <div
          key={card.id}
          data-template-preview-card={card.id}
          className="relative isolate flex min-h-24 min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-white/30 p-1.5 text-center shadow-lg shadow-slate-900/20 ring-1 ring-inset ring-white/30 sm:p-2"
          style={{ backgroundImage: courseThemeFlipCardGradient, color: "var(--course-theme-contrast, var(--course-primary-contrast, #ffffff))" }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-br from-white/35 via-white/5 to-white/20" />
          <RotateCcw size={10} className="absolute right-1 top-1 z-10 text-current opacity-75" aria-hidden="true" />
          <span className="relative z-10 mb-1 max-w-full break-words text-[7px] font-semibold uppercase tracking-wide sm:text-[8px]">
            {card.frontLabel || `Card ${index + 1}`}
          </span>
          {card.front.type === "image" ? (
            <ImageIcon size={16} className="relative z-10 text-current opacity-80" aria-hidden="true" />
          ) : (
            <span className="relative z-10 line-clamp-3 max-w-full break-words text-[8px] font-semibold leading-3 sm:text-[9px]">
              {card.front.text || "Add a prompt"}
            </span>
          )}
          <span className="relative z-10 mt-1.5 text-[7px] opacity-80 sm:text-[8px]">
            {card.backLabel || "Flip to reveal"}
          </span>
        </div>
      ))}
    </div>
  );
}

