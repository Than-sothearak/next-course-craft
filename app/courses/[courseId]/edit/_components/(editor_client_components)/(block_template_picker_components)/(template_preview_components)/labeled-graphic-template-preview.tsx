import type { BlockTemplate } from "../block-template-data";
import { MiniLandscape } from "./mini-landscape";

export function LabeledGraphicTemplatePreview({ data }: { data: NonNullable<BlockTemplate["labeledGraphic"]> }) {
  return (
    <div className="relative overflow-hidden rounded-lg">
      <MiniLandscape className="aspect-video" />
      {data.markers.map((marker, index) => (
        <span
          key={marker.id}
          className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-indigo-600 text-[8px] font-bold text-white shadow"
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        >
          {index + 1}
        </span>
      ))}
      <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 py-0.5 text-[7px] font-medium text-slate-600">
        Select a marker to explore
      </span>
    </div>
  );
}

