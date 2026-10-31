import type { BlockTemplate } from "../block-template-data";
import { InteractiveScene } from "@/components/interactive-scene";
import { MiniLandscape } from "./mini-landscape";
import { LessonMapArtwork } from "@/components/lesson-map-artwork";

export function LabeledGraphicTemplatePreview({ data }: { data: NonNullable<BlockTemplate["labeledGraphic"]> }) {
  if (data.interactionMode === "spotTarget" && data.sceneTheme)
    return (
      <div data-mini-game-preview="" className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-sm">
        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-cyan-300">Spot the clue</span>
          <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[8px] font-bold text-amber-200">+100 PTS</span>
        </div>
        <div className="relative aspect-video overflow-hidden border-y border-white/10">
          <InteractiveScene theme={data.sceneTheme} />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/10" />
          {data.markers.map((marker, index) => (
            <span
              key={marker.id}
              className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-cyan-50 bg-cyan-400/90 text-[8px] font-black text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.85)]"
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            >
              {index + 1}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-xs text-emerald-300">↗</span>
          <span className="truncate text-[9px] font-semibold text-slate-200">{data.challengePrompt}</span>
        </div>
      </div>
    );

  if (data.sceneTheme && !data.src)
    return (
      <div data-scene-hotspot-preview="" data-scene-theme={data.sceneTheme} className="relative aspect-video overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <InteractiveScene theme={data.sceneTheme} />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-slate-950/10" />
        {data.markers.map((marker, index) => (
          <span
            key={marker.id}
            className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-indigo-600 text-[8px] font-bold text-white shadow"
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

  return (
    <div className="relative overflow-hidden rounded-lg">
      {data.mapTemplate ? <LessonMapArtwork template={data.mapTemplate} className="aspect-[18/11] w-full" /> : <MiniLandscape className="aspect-video" />}
      {data.markers.map((marker, index) => (
        <span
          key={marker.id}
          className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-indigo-600 text-[8px] font-bold text-white shadow"
          style={{ left: `${marker.x}%`, top: `${marker.y}%`, backgroundColor: marker.color ?? data.markerColor }}
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

