"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { guidanceStorageKey, guidanceWasSeen, rememberGuidance } from "@/lib/editor/slide-guidance";
import { SlideCoverSurface } from "../../../_components/slide-presentation/slide-cover-surface";
import { useSlidePresentationContext } from "./slide-presentation-context";

export function SlideCoverRuntime({ visible, lessonId, ...props }: ComponentProps<typeof SlideCoverSurface> & { visible: boolean; lessonId: string }) {
  const presentation = useSlidePresentationContext();
  const instructions = props.cover.instructions;
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const entered = useRef(false);
  const key = guidanceStorageKey(presentation?.courseId ?? "course", `cover-${lessonId}`, presentation?.standalone ?? false);
  const play = presentation?.playInstructionAudio;
  const audioPlaying = presentation?.instructionAudioPlaying && presentation.instructionAudioSource === instructions?.audioSrc;
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!visible) { entered.current = false; setNoticeOpen(false); setPendingStart(false); return; }
      if (entered.current || !instructions) return;
      entered.current = true;
      if (instructions.audioTrigger === "cover" && instructions.audioSrc) play?.(instructions.audioSrc);
      if (instructions.noticeEnabled && instructions.noticeTrigger === "cover" && (!instructions.firstVisitOnly || !guidanceWasSeen(key))) setNoticeOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visible, instructions, key, play]);
  function continueStart() {
    if (instructions?.audioSrc && instructions.audioTrigger === "start") play?.(instructions.audioSrc);
    props.onStart?.();
  }
  function start() {
    if (instructions?.noticeEnabled && instructions.noticeTrigger === "start" && (!instructions.firstVisitOnly || !guidanceWasSeen(key))) { setPendingStart(true); setNoticeOpen(true); }
    else continueStart();
  }
  function dismiss() {
    setNoticeOpen(false);
    if (instructions?.firstVisitOnly) rememberGuidance(key);
    if (pendingStart) { setPendingStart(false); continueStart(); }
  }
  return <>
    <SlideCoverSurface {...props} onStart={props.onStart ? start : undefined} instructionsControl={instructions?.audioSrc ? <Button variant="ghost" size="sm" className="min-h-8 bg-black/20 text-xs text-white hover:bg-black/30 hover:text-white" onClick={() => audioPlaying ? presentation?.pauseInstructionAudio() : play?.(instructions.audioSrc)}><Volume2 size={14} aria-hidden="true" />{audioPlaying ? "Pause instructions" : "Listen to instructions"}</Button> : undefined} />
    {instructions?.noticeEnabled && <Dialog open={visible && noticeOpen} onClose={dismiss} title={instructions.noticeTitle} footer={<>{instructions.audioSrc && <Button variant="outline" onClick={() => audioPlaying ? presentation?.pauseInstructionAudio() : play?.(instructions.audioSrc)}>{audioPlaying ? "Pause instructions" : "Play instructions"}</Button>}<Button onClick={dismiss}>{pendingStart ? "Start course" : "Got it"}</Button></>}><p className="whitespace-pre-wrap text-sm leading-6">{instructions.noticeText}</p></Dialog>}
  </>;
}
