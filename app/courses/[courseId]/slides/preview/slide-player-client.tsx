"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  masterSettingsForSlide,
  renderSlideMaster,
} from "@/lib/slides/master-schema";
import { FixedStageViewport } from "@/components/slides/fixed-stage-viewport";
import { SlideSurface } from "@/components/slides/slide-surface";
import type { CanvasOverrides } from "@/components/slides/canvas-surface";
import type { SlideAction, SlideRecord } from "@/lib/slides/schema";
import { defaultSlideTheme, type SlideTheme } from "@/lib/slides/themes";
import { LearningCoursePlayer } from "@/components/slides/learning-course-player";

type PlayerProps = {
  title: string;
  slides: SlideRecord[];
  theme?: SlideTheme;
  editorHref?: string;
  progressKey?: string;
};
export function SlidePlayerClient(props: PlayerProps) {
  return props.slides.some((slide) => slide.composition) ? (
    <LearningCoursePlayer {...props} theme={props.theme ?? defaultSlideTheme} />
  ) : (
    <LegacySlidePlayer {...props} />
  );
}
function LegacySlidePlayer({
  title,
  slides,
  theme = defaultSlideTheme,
  editorHref,
}: PlayerProps) {
  const [index, setIndex] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, CanvasOverrides>>(
    {},
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const previousRef = useRef<SlideRecord | null>(null);
  const slide = slides[index];
  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(slides.length - 1, next)));
      setFeedback(null);
    },
    [slides.length],
  );
  const runActions = useCallback(
    (actions: SlideAction[], sourceSlideId: string) => {
      for (const action of actions) {
        if (
          action.type === "showObject" ||
          action.type === "hideObject" ||
          action.type === "setState"
        ) {
          setOverrides((current) => ({
            ...current,
            [sourceSlideId]: {
              ...current[sourceSlideId],
              [action.targetObjectId]: {
                ...current[sourceSlideId]?.[action.targetObjectId],
                ...(action.type === "setState"
                  ? { stateId: action.stateId }
                  : { visible: action.type === "showObject" }),
              },
            },
          }));
        } else if (action.type === "nextSlide") goTo(index + 1);
        else if (action.type === "previousSlide") goTo(index - 1);
        else if (action.type === "goToSlide") {
          const destination = slides.findIndex(
            (candidate) => candidate.id === action.slideId,
          );
          if (destination >= 0) goTo(destination);
        } else if (action.type === "feedback") setFeedback(action.message);
        else if (action.type === "openUrl") {
          try {
            const url = new URL(action.url);
            if (url.protocol === "http:" || url.protocol === "https:")
              window.open(url.href, "_blank", "noopener,noreferrer");
          } catch {
            /* Shared validation rejects unsupported URLs. */
          }
        }
      }
    },
    [goTo, index, slides],
  );
  useEffect(() => {
    const current = slides[index] ?? null,
      previous = previousRef.current;
    if (previous?.id === current?.id) return;
    previousRef.current = current;
    if (previous)
      runActions(
        previous.interactions
          .filter((interaction) => interaction.event === "slideExit")
          .map((interaction) => interaction.action),
        previous.id,
      );
    if (current)
      runActions(
        current.interactions
          .filter((interaction) => interaction.event === "slideEnter")
          .map((interaction) => interaction.action),
        current.id,
      );
  }, [index, runActions, slides]);
  const fullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* Embedded browsers may restrict fullscreen. */
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {editorHref && (
            <a
              href={editorHref}
              aria-label="Back to slide editor"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-indigo-300"
            >
              <ArrowLeft size={17} />
            </a>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-indigo-300 uppercase">
              Interactive Slide Course
            </p>
            <h1 className="mt-1 truncate text-sm font-medium">{title}</h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => void fullscreen()}
          aria-label="Enter fullscreen"
        >
          <Maximize2 size={17} />
        </Button>
      </header>
      <div className="flex flex-1 items-center justify-center p-3 sm:p-8">
        <div className="relative w-full max-w-[1280px] overflow-hidden rounded-xl bg-white shadow-2xl">
          {slide ? (
            renderSlideMaster(
              theme.master,
              masterSettingsForSlide(slide).masterOverrides,
            )?.enabled ? (
              <FixedStageViewport fitHeight={false}>
                <SlideSurface
                  slide={slide}
                  theme={theme}
                  overrides={overrides[slide.id]}
                  onAction={(actions) => runActions(actions, slide.id)}
                />
              </FixedStageViewport>
            ) : (
              <SlideSurface
                slide={slide}
                theme={theme}
                overrides={overrides[slide.id]}
                onAction={(actions) => runActions(actions, slide.id)}
              />
            )
          ) : (
            <p className="p-12 text-center text-sm text-slate-500">
              This course does not have any slides yet.
            </p>
          )}
          {feedback && (
            <div
              role="status"
              className="absolute right-4 bottom-4 left-4 z-[600] flex items-start gap-4 rounded-xl border border-white/20 bg-slate-950/95 px-5 py-4 text-sm leading-6 text-white shadow-xl"
            >
              <p className="min-w-0 flex-1 whitespace-pre-wrap">{feedback}</p>
              <Button
                aria-label="Dismiss feedback"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-white hover:bg-white/10 hover:text-white"
                onClick={() => setFeedback(null)}
              >
                <X size={15} />
              </Button>
            </div>
          )}
        </div>
      </div>
      <footer className="border-t border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-slate-300">
            {slide ? `Slide ${index + 1} of ${slides.length}` : "No slides"}
          </span>
          <div
            role="progressbar"
            aria-label="Slide position"
            aria-valuemin={0}
            aria-valuemax={slides.length}
            aria-valuenow={slide ? index + 1 : 0}
            className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-white/15"
          >
            <div
              className="h-full rounded-full bg-indigo-400"
              style={{
                width: slides.length
                  ? `${((index + 1) / slides.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              disabled={index === 0}
              onClick={() => goTo(index - 1)}
            >
              <ArrowLeft size={14} /> Previous
            </Button>
            <Button
              size="sm"
              disabled={!slide || index >= slides.length - 1}
              onClick={() => goTo(index + 1)}
            >
              Next <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );
}
