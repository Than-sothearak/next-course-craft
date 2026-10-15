import { ImageIcon, RotateCcw } from "lucide-react";
import type { BlockTemplate } from "../block-template-data";

export function FlipCardTemplatePreview({ cards }: { cards: NonNullable<BlockTemplate["flipCard"]>["cards"] }) {
  const columns = cards.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid ${columns} gap-1.5`}>
      {cards.map((card, index) => (
        <div
          key={card.id}
          data-template-preview-card={card.id}
          className="relative flex min-h-24 min-w-0 flex-col items-center justify-center rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-1.5 text-center shadow-sm sm:p-2"
        >
          <RotateCcw size={10} className="absolute right-1 top-1 text-indigo-500" aria-hidden="true" />
          <span className="mb-1 max-w-full break-words text-[7px] font-semibold uppercase tracking-wide text-indigo-600 sm:text-[8px]">
            {card.frontLabel || `Card ${index + 1}`}
          </span>
          {card.front.type === "image" ? (
            <ImageIcon size={16} className="text-indigo-400" aria-hidden="true" />
          ) : (
            <span className="line-clamp-3 max-w-full break-words text-[8px] font-semibold leading-3 text-slate-800 sm:text-[9px]">
              {card.front.text || "Add a prompt"}
            </span>
          )}
          <span className="mt-1.5 text-[7px] text-slate-400 sm:text-[8px]">
            {card.backLabel || "Flip to reveal"}
          </span>
        </div>
      ))}
    </div>
  );
}

