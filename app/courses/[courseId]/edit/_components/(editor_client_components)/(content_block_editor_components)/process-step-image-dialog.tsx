"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { educationalImageLookOptions, educationalImageVisualTypeOptions, type EducationalImageLook, type EducationalImageVisualType } from "@/lib/ai/educational-image-options";
import { processStepMediaSchema, type ContentBlock } from "@/lib/schemas/block";

type Step = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number];

export function ProcessStepImageDialog({ step, index, courseId, onClose, onSelect }: {
  step: Step; index: number; courseId: string; onClose: () => void; onSelect: (media: NonNullable<Step["media"]>) => void;
}) {
  return <ContentImageDialog title={step.title} instructions={step.body} dialogTitle={`Generate image for step ${index + 1}`} fallbackLabel={`step ${index + 1}`} hasMedia={Boolean(step.media)} courseId={courseId} onClose={onClose} onSelect={onSelect} />;
}

export function ContentImageDialog({ title, instructions, dialogTitle, fallbackLabel = "block", source = "step", hasMedia = false, courseId, onClose, onSelect }: {
  title: string; instructions: string; dialogTitle: string; fallbackLabel?: string; source?: "step" | "block"; hasMedia?: boolean;
  courseId: string; onClose: () => void; onSelect: (media: NonNullable<Step["media"]>) => void;
}) {
  const promptId = useId();
  const visualTypeId = useId();
  const lookId = useId();
  const [visualType, setVisualType] = useState<EducationalImageVisualType>("auto");
  const [look, setLook] = useState<EducationalImageLook>("auto");
  const [customPrompt, setCustomPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<Step["media"]>();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const value = Math.min(90, Math.floor((Date.now() - startedAt) / 15_000 * 90));
      setProgress(value);
      if (value === 90) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function generate() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setProgress(0);
    setBusy(true);
    setError(null);
    setImage(undefined);
    try {
      const response = await fetch(`/api/courses/${courseId}/process-step-image`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, instructions, customPrompt, ...(source === "block" ? { source } : {}), ...(visualType !== "auto" ? { visualType } : {}), ...(look !== "auto" ? { look } : {}) }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "The image could not be generated. Please try again.");
      const parsed = processStepMediaSchema.safeParse(body?.media);
      if (!parsed.success || !parsed.data.mimeType.startsWith("image/")) throw new Error("The image service returned an invalid image. Please try again.");
      if (!controller.signal.aborted) setImage(parsed.data);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The image could not be generated. Please try again.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <Dialog open onClose={onClose} busy={busy} title={dialogTitle} overlay={busy && <div data-process-step-image-loading className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-white/95 p-6 text-center backdrop-blur-sm">
    <Loader2 aria-hidden="true" size={36} className="text-indigo-600 motion-safe:animate-spin" />
    <div role="status" className="space-y-2">
      <p className="text-lg font-semibold">Generating your image</p>
      <p className="text-sm text-slate-500">{progress < 90 ? `Creating a visual guide for this ${source}…` : "Still generating your image. Please wait…"}</p>
    </div>
    <div className="w-full max-w-xs space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500"><span>Estimated progress</span><span className="font-semibold tabular-nums text-slate-900">{progress}%</span></div>
      <Progress value={progress} aria-label="Image generation progress" aria-valuetext={`${progress}% estimated`} className="[&>div]:motion-reduce:transition-none" />
    </div>
  </div>} footer={<>
    <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
    <Button disabled={busy || (!instructions.trim() && !customPrompt.trim())} onClick={generate}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? "Generating…" : image ? "Generate again" : "Generate image"}</Button>
    {image && <Button disabled={busy} onClick={() => {
      try { onSelect(image); } catch (cause) { setError(cause instanceof Error ? cause.message : "The image could not be added. Please try again."); }
    }}>Use image</Button>}
  </>}>
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-medium text-slate-600">{source === "block" ? "Block content" : "Step instructions"}</p>
        {title && <p className="text-sm font-semibold">{title}</p>}
        <p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm text-slate-600">{instructions || `This ${source} has no ${source === "block" ? "text content" : "instructions"} yet. Write custom image instructions below.`}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={visualTypeId} className="text-sm font-medium">Visual type</label>
          <Select id={visualTypeId} value={visualType} disabled={busy} onChange={(event) => { setVisualType(event.target.value as EducationalImageVisualType); setImage(undefined); setError(null); }}>
            {educationalImageVisualTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <p className="text-xs text-slate-500">Auto chooses how to explain the content visually.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor={lookId} className="text-sm font-medium">Look</label>
          <Select id={lookId} value={look} disabled={busy} onChange={(event) => { setLook(event.target.value as EducationalImageLook); setImage(undefined); setError(null); }}>
            {educationalImageLookOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <p className="text-xs text-slate-500">{educationalImageLookOptions.find((option) => option.value === look)?.description}</p>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor={promptId} className="text-sm font-medium">Custom image instructions (optional)</label>
        <Textarea id={promptId} value={customPrompt} disabled={busy} maxLength={5000} placeholder={`Example: Show VS Code with the HTML and CSS, beside a browser displaying the matching styled page. Leave blank to use the ${source === "block" ? "block content" : "step instructions"}.`} onChange={(event) => { setCustomPrompt(event.target.value); setImage(undefined); }} />
        <p className="text-xs text-slate-500">Leave blank to use this {source === "block" ? "block’s content" : "step’s instructions"}. Custom instructions replace {source === "block" ? "it" : "them"} for image generation.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {image && <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={`Generated visual guide for ${title || fallbackLabel}`} className="max-h-72 w-full rounded-lg border border-slate-200 object-contain" />
        <p className="text-xs text-slate-500">Use image {source === "block" ? "to insert an image with caption directly below this block" : hasMedia ? "to replace this step’s current media" : "to add it to this step"}. The image is also saved in the course media library.</p>
      </div>}
    </div>
  </Dialog>;
}
