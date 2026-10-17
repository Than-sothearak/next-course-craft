"use client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { learningBlockKinds, type LearningBlockKind } from "@/lib/slides/blocks";

const descriptions: Record<LearningBlockKind, string> = {
  text: "Heading and reading content", accordion: "Expandable interactive text", tabs: "Explore related topics", flashcards: "Flip to reveal explanations",
  quiz: "Graded questions, feedback and retry", image: "Image with accessible description", audio: "Narration or audio with transcript", video: "Video lesson with transcript", shape: "Editable vector shape", button: "Prebuilt navigation button",
};
export function BlockGallery({ open, onClose, onChoose, onLayouts, disabled }: { open: boolean; onClose: () => void; onChoose: (kind: LearningBlockKind) => void; onLayouts: () => void; disabled?: boolean }) {
  return <Dialog open={open} onClose={onClose} title="Insert a prebuilt object"><p className="mb-5 text-sm text-slate-600">Place, resize and overlap independent objects on the fixed canvas. Each object has its own timeline layer.</p><div className="grid gap-3 sm:grid-cols-2">{learningBlockKinds.map((kind) => <Button key={kind} variant="outline" disabled={disabled} className="h-auto flex-col items-start whitespace-normal p-4 text-left" aria-label={`Add ${kind} object`} onClick={() => onChoose(kind)}><span className="font-semibold capitalize">{kind}</span><span className="text-xs font-normal text-slate-500">{descriptions[kind]}</span></Button>)}<Button variant="outline" disabled={disabled} className="h-auto flex-col items-start p-4" onClick={onLayouts}><span className="font-semibold">Prebuilt object layout</span><span className="text-xs font-normal text-slate-500">Editable text, images and cards</span></Button></div></Dialog>;
}
