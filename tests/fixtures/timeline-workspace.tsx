import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { FixedStageViewport, type StageResolution } from "../../components/slides/fixed-stage-viewport";
import { PageTimeline } from "../../app/courses/[courseId]/slides/edit/_components/page-timeline";
import { createLearningBlock, learningBlockSchema, type LearningPage } from "../../lib/slides/blocks";
import { LearningPageSurface } from "../../components/slides/learning-page-surface";
import { materializeObjectCanvas } from "../../lib/slides/object-canvas";
import { defaultSlideTheme } from "../../lib/slides/themes";
import { defaultAudioMonitor } from "../../lib/slides/timeline";
import { usePageClock } from "../../components/slides/use-page-clock";

function Workspace() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(280), [long, setLong] = useState(false), [resolution, setResolution] = useState<StageResolution>("hd");
  const [objects, setObjects] = useState(false), [selected, setSelected] = useState<string | null>(null), [interact, setInteract] = useState(false);
  const [monitor, setMonitor] = useState(defaultAudioMonitor), [loop, setLoop] = useState(false);
  const [draft, setDraft] = useState<ReturnType<typeof createLearningBlock> | null>(null);
  const [page, setPage] = useState<LearningPage>({ duration: 30, layers: [
    learningBlockSchema.parse({ ...createLearningBlock("audio"), name: "Narration", src: "https://example.invalid/a.mp3", start: 2, end: 22, trimStart: 0, trimEnd: 20, sourceDuration: 20 }),
    learningBlockSchema.parse({ ...createLearningBlock("video"), name: "Video lesson", start: 0, end: 12, trimStart: 0, trimEnd: 12, sourceDuration: 12 }),
  ] });
  const clock = usePageClock(page.duration, loop);
  const previewPage = useMemo(() => draft ? { ...page, layers: page.layers.map((block) => block.id === draft.id ? draft : block) } : page, [page, draft]);
  return <div ref={workspaceRef} className="flex h-screen min-h-0 flex-col p-4">
    <div className="flex shrink-0 gap-3 pb-3"><Select aria-label="Frame resolution" value={resolution} onChange={(event) => { setResolution(event.target.value as StageResolution); setPage((current) => ({ ...current, resolution: event.target.value as StageResolution })); }}><option value="hd">HD</option><option value="fullHd">Full HD</option></Select><Button onClick={() => { setObjects(false); setPage({ duration: 120, layers: Array.from({ length: 100 }, (_, index) => learningBlockSchema.parse({ ...createLearningBlock(index % 5 === 0 ? "audio" : "text"), name: `Track ${index + 1}`, start: index, end: index + 10 })) }); }}>Load 100 tracks</Button><Button onClick={() => setLong((value) => !value)}>Toggle long content</Button><Button onClick={() => { setObjects(true); setPage(materializeObjectCanvas({ duration: 30, layers: [
      { ...createLearningBlock("text"), name: "Free heading", placement: { x: 80, y: 120, width: 480, height: 200, zIndex: 1, rotation: 0 } },
      { ...createLearningBlock("tabs"), name: "Free tabs", placement: { x: 700, y: 120, width: 480, height: 440, zIndex: 2, rotation: 0 } },
    ] })); }}>Use object canvas</Button>{objects && <><Button onClick={() => setInteract((value) => !value)}>Preview objects</Button><Button onClick={() => setPage((current) => ({ ...current, layers: current.layers.map((block, index) => index === 0 ? { ...block, visible: false } : block) }))}>Hide first object</Button></>}</div>
    <div className="min-h-0 flex-1 pb-3"><FixedStageViewport resolution={resolution}>{objects ? <LearningPageSurface page={page} theme={defaultSlideTheme} selectedId={selected} onSelect={interact ? undefined : setSelected} onPlacement={(id, placement) => setPage((current) => ({ ...current, layers: current.layers.map((block) => block.id === id ? { ...block, placement } : block) }))} /> : <div className="p-8"><h1 className="text-3xl">Fixed preview stage</h1><p>{"Learning content. ".repeat(long ? 3000 : 10)}</p></div>}</FixedStageViewport></div>
    <PageTimeline page={previewPage} monitor={monitor} onMonitor={setMonitor} loop={loop} onLoop={() => setLoop((value) => !value)} onLayerPreview={setDraft} selectedId={selected ?? page.layers[0].id} time={clock.time} playing={clock.playing} height={height} onHeight={setHeight} workspaceRef={workspaceRef} disabled={false} onSelect={setSelected} onPlay={clock.toggle} onRestart={() => { clock.pause(); clock.seek(0); }} onSeek={(time) => { clock.pause(); clock.seek(time); }} onTrim={clock.pause} onAddMedia={(kind) => setPage((current) => ({ ...current, layers: [...current.layers, createLearningBlock(kind)] }))} onDuration={(duration) => setPage((current) => ({ ...current, duration }))} onLayer={(id, update) => setPage((current) => ({ ...current, layers: current.layers.map((block) => block.id === id ? update(block) : block) }))} />
    <output data-layer-state hidden>{JSON.stringify(page)}</output>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Workspace />);
