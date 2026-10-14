"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CirclePlay,
  ClipboardList,
  FileText,
  Lightbulb,
  LockKeyhole,
  Menu,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
  Tablet,
  UnlockKeyhole,
  X,
} from "lucide-react";
import { PreviewImage } from "./preview-image";
import { InteractiveAccordion, InteractiveFlipCard, InteractiveKnowledgeCheck, InteractiveLabeledGraphic, InteractiveProcessSteps, InteractiveSurvey } from "./interactive-blocks";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import {
  defaultBlockPadding,
  defaultBlockWidth,
  type ContentBlock,
} from "@/lib/schemas/block";
import { getCourseProgress } from "@/lib/editor/preview";
import {
  canCompleteLesson,
  getFlipCardProgressId,
  getInitiallyViewedInteractionIds,
  getInteractiveItemProgressId,
  getPendingInteractiveProgressIds,
  getLessonReadingProgress,
  hasReachedContentEnd,
  type LearnerProgressAdapter,
  type LearnerProgressSnapshot,
} from "@/lib/export/progress";
import { Button } from "@/components/ui/button";
import { PublishMenu } from "@/components/publish-menu";
import { ImageBlockLayout } from "../edit/_components/image-block-layout";
import { StatementBlockPreview } from "../edit/_components/statement-block-preview";
import { StatementTextPreview } from "../edit/_components/statement-text-preview";
import { ChartBlockPreview } from "./chart-block";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import { courseThemeFontFamilies, normalizeCourseTheme } from "@/lib/editor/theme";
import {
  evaluateQuizAttempt,
  isQuizAnswerCorrect,
  type QuizAnswers,
  type QuizAttemptResult,
} from "@/lib/interactive/quiz-assessment";

export type PreviewData = { courseId: string; theme?: EditorSnapshotInput["theme"] } & Omit<EditorSnapshotInput, "revision" | "theme">;
type PreviewMode = "course" | "learn";
type PreviewDevice = "desktop" | "tablet" | "mobile";

const lessonIcons = {
  file: FileText,
  book: BookOpen,
  video: CirclePlay,
  quiz: ClipboardList,
  idea: Lightbulb,
} as const;

function authorInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CA"
  );
}

function LessonProgressIndicator({
  progress,
  complete,
}: {
  progress: number;
  complete: boolean;
}) {
  if (complete) {
    return <Check aria-label="Lesson complete" size={15} className="mt-0.5 shrink-0" style={{ color: "var(--course-primary, #2f5f9f)" }} />;
  }
  const circumference = 2 * Math.PI * 7;
  return (
    <svg
      role="img"
      aria-label={`Lesson ${progress}% read`}
      viewBox="0 0 18 18"
      width="16"
      height="16"
      className="mt-0.5 shrink-0 -rotate-90"
    >
      <circle cx="9" cy="9" r="7" fill="none" stroke="#cbd5e1" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke="var(--course-primary, #2f5f9f)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress / 100)}
        className="transition-[stroke-dashoffset] duration-150"
      />
    </svg>
  );
}

function contrastTextColor(hex: string) {
  const channels = hex
    .match(/[\da-f]{2}/gi)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length < 3) return "#111827";
  const luminance = channels
    .slice(0, 3)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
  return luminance > 0.42 ? "#111827" : "#ffffff";
}

function safeImageSource(value: string) {
  const source = value.trim();
  return /^https?:\/\//i.test(source) ||
    /^data:image\/[\w.+-]+;base64,/i.test(source) ||
    (source.startsWith("./") && !source.slice(2).split("/").some((part) => part === ".." || part === "")) ||
    (source.startsWith("/") && !source.startsWith("//"))
    ? source
    : "";
}

function blockWidthClass(block: ContentBlock) {
  const contentWidth = block.widthCustom ? block.width : defaultBlockWidth(block.type);
  return contentWidth === "small"
    ? "max-w-[520px]"
    : contentWidth === "medium"
      ? "max-w-[720px]"
      : "max-w-[920px]";
}

function blockSurfaceStyle(block: ContentBlock): CSSProperties {
  const blockPadding = block.blockPadding ?? defaultBlockPadding(block.type);
  return {
    backgroundColor: block.backgroundColor,
    color: contrastTextColor(block.backgroundColor),
    paddingTop: `${blockPadding}px`,
    paddingBottom: `${blockPadding}px`,
  };
}

function QuizQuestionPreview({
  question,
  index,
  selectedChoiceIds,
  answerState,
  onSelectionChange,
  onCheck,
}: {
  question: QuizQuestion;
  index: number;
  selectedChoiceIds: string[];
  answerState: boolean | null;
  onSelectionChange: (choiceIds: string[]) => void;
  onCheck: () => void;
}) {
  const hasAnswerKey = question.correctChoiceIds.length > 0;

  function toggleChoice(choiceId: string, selected: boolean) {
    onSelectionChange(
      question.selectionMode === "single"
        ? selected
          ? [choiceId]
          : []
        : selected
          ? [...selectedChoiceIds, choiceId]
          : selectedChoiceIds.filter((id) => id !== choiceId),
    );
  }

  const questionImage = safeImageSource(question.imageSrc);

  return (
    <section
      aria-labelledby={`quiz-question-${question.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--course-primary, #2f5f9f)" }}>
        Question {index + 1}
      </p>
      <h2
        id={`quiz-question-${question.id}`}
        className="mt-2 text-xl font-semibold leading-snug text-slate-900"
      >
        {question.prompt || "Question prompt"}
      </h2>
      {questionImage && (
        <PreviewImage
          src={questionImage}
          alt={question.imageAlt}
          className="mt-4 max-h-[420px] w-auto rounded-xl object-contain"
        />
      )}
      <fieldset className="mt-5 space-y-3">
        <legend className="sr-only">
          {question.selectionMode === "single"
            ? "Choose one answer"
            : "Choose all answers that apply"}
        </legend>
        {question.choices.map((choice, choiceIndex) => {
          const choiceImage = safeImageSource(choice.imageSrc);
          return (
            <div
              key={choice.id}
              className="rounded-xl border transition-colors"
              style={selectedChoiceIds.includes(choice.id) ? { borderColor: "var(--course-primary, #2f5f9f)", backgroundColor: "color-mix(in srgb, var(--course-primary, #2f5f9f) 9%, white)" } : undefined}
            >
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm">
                <input
                  type={
                    question.selectionMode === "single" ? "radio" : "checkbox"
                  }
                  name={`answer-${question.id}`}
                  value={choice.id}
                  checked={selectedChoiceIds.includes(choice.id)}
                  onChange={(event) =>
                    toggleChoice(choice.id, event.target.checked)
                  }
                  className="mt-0.5 size-4 shrink-0"
                  style={{ accentColor: "var(--course-primary, #2f5f9f)" }}
                />
                <span className="min-w-0 flex-1">
                  {choice.text || (
                    <span className="text-slate-400">
                      Answer {choiceIndex + 1}
                    </span>
                  )}
                </span>
              </label>
              {choiceImage && (
                <div className="pb-3 pl-11 pr-4">
                  <PreviewImage
                    src={choiceImage}
                    alt={choice.imageAlt}
                    className="max-h-56 w-auto rounded-lg object-contain"
                  />
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
      <Button
        type="button"
        onClick={onCheck}
        disabled={!selectedChoiceIds.length || !hasAnswerKey}
        className="mt-5"
        style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}
      >
        Check answer
      </Button>
      {!hasAnswerKey && (
        <p role="status" className="mt-3 text-sm text-amber-700">
          The answer key has not been set for this question.
        </p>
      )}
      {answerState !== null && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${answerState ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
        >
          {answerState
            ? question.correctFeedback || "Correct!"
            : question.incorrectFeedback ||
              "That answer is not correct. Try again."}
        </p>
      )}
    </section>
  );
}

export function QuizAssessmentPreview({
  questions,
  passingScore,
  savedScore,
  wasPassed,
  onResult,
}: {
  questions: QuizQuestion[];
  passingScore: number;
  savedScore?: number;
  wasPassed: boolean;
  onResult: (result: QuizAttemptResult) => void;
}) {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [gradedAnswers, setGradedAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const activeQuestion = questions[activeQuestionIndex];

  function updateAnswer(questionId: string, choiceIds: string[]) {
    setAnswers((previous) => ({ ...previous, [questionId]: choiceIds }));
    setGradedAnswers((previous) => {
      const next = { ...previous };
      delete next[questionId];
      return next;
    });
    setResult(null);
  }

  function checkQuestion(question: QuizQuestion) {
    const answerState = isQuizAnswerCorrect(question, answers[question.id] ?? []);
    const nextGrades = { ...gradedAnswers, [question.id]: answerState };
    setGradedAnswers(nextGrades);
    if (questions.every((item) => Object.hasOwn(nextGrades, item.id))) {
      const attempt = evaluateQuizAttempt(questions, answers, passingScore);
      if (attempt) {
        setResult(attempt);
        onResult(attempt);
      }
    }
  }

  function retry() {
    setActiveQuestionIndex(0);
    setAnswers({});
    setGradedAnswers({});
    setResult(null);
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-[720px] space-y-6 px-4">
      {wasPassed && result === null && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Quiz passed{savedScore === undefined ? "." : ` · Best score ${savedScore}%.`}
        </p>
      )}
      {!wasPassed && savedScore !== undefined && result === null && (
        <p className="text-sm text-slate-500">Best score: {savedScore}%</p>
      )}
      <div className="flex items-center justify-between gap-4 text-xs font-medium text-slate-500">
        <span>Question {activeQuestionIndex + 1} of {questions.length}</span>
        <div
          role="progressbar"
          aria-label="Quiz question progress"
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-valuenow={activeQuestionIndex + 1}
          className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200"
        >
          <div className="h-full rounded-full transition-[width]" style={{ width: `${((activeQuestionIndex + 1) / questions.length) * 100}%`, backgroundColor: "var(--course-primary, #2f5f9f)" }} />
        </div>
      </div>
      {activeQuestion && (
        <QuizQuestionPreview
          key={activeQuestion.id}
          question={activeQuestion}
          index={activeQuestionIndex}
          selectedChoiceIds={answers[activeQuestion.id] ?? []}
          answerState={gradedAnswers[activeQuestion.id] ?? null}
          onSelectionChange={(choiceIds) => updateAnswer(activeQuestion.id, choiceIds)}
          onCheck={() => checkQuestion(activeQuestion)}
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={activeQuestionIndex === 0}
          onClick={() => setActiveQuestionIndex((index) => Math.max(0, index - 1))}
        >
          Previous question
        </Button>
        {activeQuestionIndex < questions.length - 1 && (
          <Button
            type="button"
            onClick={() => setActiveQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}
            disabled={!activeQuestion || gradedAnswers[activeQuestion.id] === undefined}
          style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}
          >
            Next question
          </Button>
        )}
      </div>
      {result && activeQuestionIndex === questions.length - 1 && (
        <section
          aria-live="polite"
          className={`rounded-2xl border p-5 sm:p-7 ${result.passed ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
        >
          <p className={`text-xl font-semibold ${result.passed ? "text-emerald-900" : "text-rose-900"}`}>
            {result.passed ? "Assessment passed" : "Keep trying"}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Score: {result.score}% ({result.correctCount} of {result.questionCount} correct). Passing score: {result.passingScore}%.
          </p>
          <Button type="button" onClick={retry} className="mt-4">
            {result.passed ? "Retake quiz" : "Try again"}
          </Button>
        </section>
      )}
    </div>
  );
}

function PreviewBlock({
  block,
  device,
  animateListItems = false,
  interactedContentIds,
  onInteractiveProgress,
}: {
  block: ContentBlock;
  device: PreviewDevice;
  animateListItems?: boolean;
  interactedContentIds?: ReadonlySet<string>;
  onInteractiveProgress?: (progressId: string) => void;
}) {
  const widthClass = blockWidthClass(block);
  const style = blockSurfaceStyle(block);

  if (block.type === "divider") {
    return (
      <div className="w-full" style={style}>
        <div className={`mx-auto w-full ${widthClass} px-4`}>
          {block.data.style === "line" ? (
            <hr className="border-0 border-t border-slate-300" />
          ) : (
            <div aria-hidden="true" className="h-8" />
          )}
        </div>
      </div>
    );
  }

  let content: React.ReactNode;
  if (block.type === "heading") {
    content = (
      <StatementTextPreview
        tag="h3"
        text={block.data.text}
        html={block.data.html}
        className="text-3xl font-semibold tracking-tight [&_h1]:my-0 [&_h1]:text-4xl [&_h2]:my-0 [&_h2]:text-3xl [&_h3]:my-0 [&_h3]:text-2xl [&_p]:my-0 [&_p]:text-3xl [&_p]:font-semibold"
      />
    );
  } else if (block.type === "richText") {
    content = (
      <StatementTextPreview
        tag="p"
        text=""
        html={block.data.html}
        className={`prose max-w-none leading-7 [&_p]:my-3 [&_h1]:my-5 [&_h2]:my-4 [&_h3]:my-3 ${animateListItems ? "lesson-list-enter" : ""}`}
      />
    );
  } else if (block.type === "statement") {
    content = (
      <StatementBlockPreview
        style={block.data.style}
        title={block.data.title}
        body={block.data.body}
        titleHtml={block.data.titleHtml}
        bodyHtml={block.data.bodyHtml}
      />
    );
  } else if (block.type === "chart") {
    content = <ChartBlockPreview data={block.data} />;
  } else if (block.type === "image") {
    const imageLayout = block.data.layout ?? "full";
    const imageClassName = imageLayout === "full"
      ? "max-h-[640px] w-full rounded-lg object-contain"
      : "h-full w-full object-cover";
    content = (
      <ImageBlockLayout
        layout={imageLayout}
        title={block.data.title}
        body={block.data.body}
        caption={block.data.caption}
        image={<PreviewImage src={block.data.src} alt={block.data.alt} className={imageClassName} caption={block.data.caption} />}
      />
    );
  } else if (block.type === "gallery") {
    const columns =
      block.data.images.length === 1
        ? "grid-cols-1"
        : device === "mobile"
          ? "grid-cols-1"
          : block.data.images.length === 2
            ? "grid-cols-2"
            : "grid-cols-2 lg:grid-cols-3";
    content = (
      <div className={`grid ${columns} gap-3`}>
        {block.data.images.map((image, index) => (
          <PreviewImage
            key={`${block.id}-${index}`}
            src={image.src}
            alt={image.alt}
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
        ))}
      </div>
    );
  } else if (block.type === "video") {
    const isVideoFile =
      Boolean(block.data.mimeType) ||
      /\.(mp4|webm|ogg)(?:$|[?#])/i.test(block.data.src);
    content = isVideoFile ? (
      <video
        controls
        className="aspect-video w-full rounded-xl bg-black"
        src={block.data.src}
        onEnded={() => onInteractiveProgress?.(`${block.id}:watched`)}
      >
        {block.data.captions && (
          <track
            kind="captions"
            src={block.data.captions}
            srcLang="en"
            label="Captions"
          />
        )}
      </video>
    ) : (
      <a
        href={block.data.src}
        target="_blank"
        rel="noreferrer"
        onClick={() => onInteractiveProgress?.(`${block.id}:watched`)}
        className="flex aspect-video w-full items-center justify-center gap-3 rounded-xl bg-slate-950 text-white hover:bg-slate-900"
      >
        <span className="grid size-14 place-items-center rounded-full bg-white/15">
          <CirclePlay size={27} />
        </span>
        <span className="text-sm font-medium">Open video</span>
      </a>
    );
  } else if (block.type === "flipCard") {
    content = (
      <InteractiveFlipCard
        blockId={block.id}
        cards={block.data.cards}
        interactedCardIds={interactedContentIds}
        onCardReveal={onInteractiveProgress}
      />
    );
  } else if (block.type === "accordion") {
    content = (
      <InteractiveAccordion
        blockId={block.id}
        layout={block.data.layout}
        items={block.data.items}
        onItemInteract={(itemId) =>
          onInteractiveProgress?.(
            getInteractiveItemProgressId(block.id, "section", itemId),
          )
        }
      />
    );
  } else if (block.type === "labeledGraphic") {
    content = (
      <InteractiveLabeledGraphic
        blockId={block.id}
        src={block.data.src}
        alt={block.data.alt}
        markers={block.data.markers}
        onMarkerInteract={(markerId) =>
          onInteractiveProgress?.(
            getInteractiveItemProgressId(block.id, "marker", markerId),
          )
        }
      />
    );
  } else if (block.type === "processSteps") {
    content = (
      <InteractiveProcessSteps
        blockId={block.id}
        steps={block.data.steps}
        onStepInteract={(stepId) =>
          onInteractiveProgress?.(
            getInteractiveItemProgressId(block.id, "step", stepId),
          )
        }
      />
    );
  } else if (block.type === "knowledgeCheck") {
    content = (
      <InteractiveKnowledgeCheck
        blockId={block.id}
        question={block.data.question}
        options={block.data.options}
        correctOptionIndex={block.data.correctOptionIndex ?? 0}
        correctFeedback={block.data.correctFeedback ?? "Correct!"}
        incorrectFeedback={block.data.incorrectFeedback ?? "Not quite. Try again."}
        onAnswerChecked={() => onInteractiveProgress?.(`${block.id}:answer`)}
      />
    );
  } else {
    content = (
      <InteractiveSurvey
        blockId={block.id}
        question={block.data.question}
        minLabel={block.data.minLabel}
        maxLabel={block.data.maxLabel}
        onSubmit={() => onInteractiveProgress?.(`${block.id}:submitted`)}
      />
    );
  }

  return (
    <div className="w-full" style={style}>
      <div className={`mx-auto w-full ${widthClass} px-4`}>{content}</div>
    </div>
  );
}

function LessonBlocksPreview({
  blocks,
  device,
  animate,
  revealedDividerIds,
  completedDividerIds,
  unlockingDividerIds,
  interactedContentIds,
  onReveal,
  onUnlockAnimationEnd,
  onInteractiveProgress,
}: {
  blocks: ContentBlock[];
  device: PreviewDevice;
  animate: boolean;
  revealedDividerIds: Set<string>;
  completedDividerIds: Set<string>;
  unlockingDividerIds: Set<string>;
  interactedContentIds: Set<string>;
  onReveal: (dividerId: string, nextBlockId?: string) => void;
  onUnlockAnimationEnd: (dividerId: string) => void;
  onInteractiveProgress: (progressId: string) => void;
}) {
  const firstHiddenDividerIndex = blocks.findIndex(
    (block) =>
      block.type === "divider" &&
      block.data.style === "continue" &&
      !revealedDividerIds.has(block.id),
  );
  const visibleBlocks =
    firstHiddenDividerIndex < 0
      ? blocks
      : blocks.slice(0, firstHiddenDividerIndex + 1);
  const mostRecentRevealedDividerIndex = visibleBlocks.reduce(
    (lastIndex, block, index) =>
      block.type === "divider" &&
      block.data.style === "continue" &&
      revealedDividerIds.has(block.id)
        ? index
        : lastIndex,
    -1,
  );

  return (
    <div className="mt-10">
      {visibleBlocks.map((block, index) => {
        const blockDelay = Math.min(
          2100,
          Math.max(0, index - mostRecentRevealedDividerIndex - 1) * 240,
        );
        const animationStyle = animate
          ? ({
              animationDelay: `${blockDelay}ms`,
              "--lesson-block-delay": `${blockDelay}ms`,
            } as CSSProperties)
          : undefined;
        if (block.type === "divider" && block.data.style === "continue") {
          if (revealedDividerIds.has(block.id)) return null;
          const requiresCompletion =
            block.data.completionType === "completeAbove";
          const hasPendingInteractiveContent = requiresCompletion && getPendingInteractiveProgressIds(
            blocks,
            interactedContentIds,
            index,
          ).length > 0;
          const isDisabled = requiresCompletion && (
            hasPendingInteractiveContent || !completedDividerIds.has(block.id)
          );
          const widthClass = blockWidthClass(block);
          return (
            <div
              key={block.id}
              data-lesson-block-id={block.id}
              className={animate ? "lesson-block-enter" : undefined}
              style={animationStyle}
            >
              <div className="w-full" style={blockSurfaceStyle(block)}>
                <div className={`mx-auto w-full ${widthClass} px-4`}>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Button
                      type="button"
                      disabled={isDisabled}
                      aria-describedby={
                        isDisabled ? `continue-hint-${block.id}` : undefined
                      }
                      onClick={() => onReveal(block.id, blocks[index + 1]?.id)}
                      className="min-w-36 rounded-full px-6"
                      style={{ backgroundColor: "var(--course-primary)" }}
                    >
                      {requiresCompletion && (
                        <ContinueLockIndicator
                          locked={isDisabled}
                          unlocking={unlockingDividerIds.has(block.id)}
                          onUnlockAnimationEnd={() => onUnlockAnimationEnd(block.id)}
                        />
                      )}
                      {block.data.label.trim() || "Continue"}
                    </Button>
                    {isDisabled && (
                      <p
                        id={`continue-hint-${block.id}`}
                        className="text-xs text-slate-500"
                      >
                        {hasPendingInteractiveContent
                          ? "Complete each interactive activity above to continue."
                          : "Scroll to the end of the content above to continue."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div
            key={block.id}
            data-lesson-block-id={block.id}
            className={animate ? "lesson-block-enter" : undefined}
            style={animationStyle}
          >
            <PreviewBlock
              block={block}
              device={device}
              animateListItems={animate}
              interactedContentIds={interactedContentIds}
              onInteractiveProgress={onInteractiveProgress}
            />
          </div>
        );
      })}
    </div>
  );
}

function ContinueLockIndicator({
  locked,
  unlocking,
  onUnlockAnimationEnd,
}: {
  locked: boolean;
  unlocking: boolean;
  onUnlockAnimationEnd: () => void;
}) {
  if (!locked && !unlocking) return null;

  return (
    <span
      className="relative inline-grid size-4 shrink-0 place-items-center"
      aria-hidden="true"
    >
      {unlocking && (
        <UnlockKeyhole className="lesson-lock-open absolute inset-0 size-4" />
      )}
      <LockKeyhole
        className={`absolute inset-0 size-4 ${unlocking ? "lesson-lock-release" : ""}`}
        onAnimationEnd={onUnlockAnimationEnd}
      />
    </span>
  );
}

export function CoursePreview({
  initialData,
  authorName,
  standalone = false,
  onEdit,
  progressAdapter,
  persistLocalProgress = true,
}: {
  initialData: PreviewData;
  authorName: string;
  standalone?: boolean;
  onEdit?: () => void;
  progressAdapter?: LearnerProgressAdapter;
  persistLocalProgress?: boolean;
}) {
  const [mode, setMode] = useState<PreviewMode>("course");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [visitedLessonIds, setVisitedLessonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lessonScrollProgress, setLessonScrollProgress] = useState<
    Record<string, number>
  >({});
  const [quizScores, setQuizScores] = useState<Record<string, number>>({});
  const [passedQuizIds, setPassedQuizIds] = useState<Set<string>>(new Set());
  const [progressLoadedCourseId, setProgressLoadedCourseId] = useState<
    string | null
  >(null);
  const [revealedDividerIds, setRevealedDividerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [completedDividerIds, setCompletedDividerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [unlockingDividerIds, setUnlockingDividerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [interactedContentIds, setInteractedContentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingContinueScroll, setPendingContinueScroll] = useState<{
    lessonId: string;
    blockId: string;
  } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const courseTheme = normalizeCourseTheme(initialData.theme);
  const themeStyle = {
    "--course-primary": courseTheme.primaryColor,
    "--course-accent": courseTheme.accentColor,
  } as CSSProperties;
  const lessonContentScrollRef = useRef<HTMLDivElement>(null);
  const lessonArticleRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lessonBodyScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sections = useMemo(
    () => [...initialData.sections].sort((a, b) => a.order - b.order),
    [initialData.sections],
  );
  const lessons = useMemo(
    () =>
      sections.flatMap((section) =>
        initialData.lessons
          .filter((lesson) => lesson.sectionId === section.id)
          .sort((a, b) => a.order - b.order),
      ),
    [initialData.lessons, sections],
  );
  const flipCardProgressIds = useMemo(
    () =>
      new Set(
        lessons.flatMap((lesson) =>
          lesson.blocks.flatMap((block) =>
            block.type === "flipCard"
              ? block.data.cards.map((card) =>
                  getFlipCardProgressId(block.id, card.id),
                )
              : [],
          ),
        ),
      ),
    [lessons],
  );
  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const lessonIndex = selectedLesson
    ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id)
    : -1;
  const progress = getCourseProgress(
    visitedLessonIds,
    lessons.map((lesson) => lesson.id),
  );
  const visitedLessonCount = lessons.filter((lesson) =>
    visitedLessonIds.has(lesson.id),
  ).length;
  const pendingInteractiveIdsByLesson = useMemo(
    () =>
      new Map(
        lessons.map((lesson) => [
          lesson.id,
          getPendingInteractiveProgressIds(
            lesson.blocks,
            interactedContentIds,
          ),
        ]),
      ),
    [interactedContentIds, lessons],
  );
  const initials = authorInitials(authorName);
  const useMobileMenu = device === "mobile" || isMobileViewport;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobileViewport(media.matches);
    const frame = window.requestAnimationFrame(update);
    media.addEventListener("change", update);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        let snapshot: LearnerProgressSnapshot | null = progressAdapter?.load(initialData.courseId) ?? null;
        if (!progressAdapter && persistLocalProgress) {
          const stored = window.localStorage.getItem(
            `coursecraft-progress-v2-${initialData.courseId}`,
          );
          const parsed = stored ? JSON.parse(stored) as LearnerProgressSnapshot | string[] : null;
          snapshot = Array.isArray(parsed)
            ? { visitedLessonIds: parsed, lessonScrollProgress: {}, revealedDividerIds: [], completedDividerIds: [], selectedLessonId: null }
            : parsed;
        }
        setVisitedLessonIds(new Set(snapshot?.visitedLessonIds ?? []));
        setLessonScrollProgress(snapshot?.lessonScrollProgress ?? {});
        setQuizScores(snapshot?.quizScores ?? {});
        const restoredPassedQuizIds = snapshot?.passedQuizIds ?? lessons
          .filter((lesson) => lesson.lessonType === "quiz" && snapshot?.visitedLessonIds?.includes(lesson.id))
          .map((lesson) => lesson.id);
        setPassedQuizIds(new Set(restoredPassedQuizIds));
        setRevealedDividerIds(new Set(snapshot?.revealedDividerIds ?? []));
        setCompletedDividerIds(new Set(snapshot?.completedDividerIds ?? []));
        const resumedLesson = lessons.find(
          (lesson) => lesson.id === snapshot?.selectedLessonId,
        );
        setInteractedContentIds(
          new Set([
            ...(snapshot?.interactedContentIds ?? []),
            ...(snapshot?.interactedFlipCardIds ?? []),
            ...(resumedLesson && resumedLesson.lessonType !== "quiz"
              ? getInitiallyViewedInteractionIds(resumedLesson.blocks)
              : []),
          ]),
        );
        setSelectedLessonId(snapshot?.selectedLessonId ?? null);
      } catch {
        setVisitedLessonIds(new Set());
        setLessonScrollProgress({});
        setQuizScores({});
        setPassedQuizIds(new Set());
        setRevealedDividerIds(new Set());
        setCompletedDividerIds(new Set());
        setInteractedContentIds(new Set());
        setSelectedLessonId(null);
      } finally {
        setProgressLoadedCourseId(initialData.courseId);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialData.courseId, lessons, persistLocalProgress, progressAdapter]);

  useEffect(() => {
    if (progressLoadedCourseId !== initialData.courseId) return;
    if (progressAdapter) {
      progressAdapter.save(
        initialData.courseId,
        {
          visitedLessonIds: [...visitedLessonIds],
          lessonScrollProgress,
          revealedDividerIds: [...revealedDividerIds],
          completedDividerIds: [...completedDividerIds],
          interactedFlipCardIds: [...interactedContentIds].filter((id) =>
            flipCardProgressIds.has(id),
          ),
          interactedContentIds: [...interactedContentIds],
          selectedLessonId,
          quizScores,
          passedQuizIds: [...passedQuizIds],
        },
        progress === 100,
      );
      return;
    }
    if (!persistLocalProgress) return;
    try {
      window.localStorage.setItem(
        `coursecraft-progress-v2-${initialData.courseId}`,
        JSON.stringify({
          visitedLessonIds: [...visitedLessonIds],
          lessonScrollProgress,
          revealedDividerIds: [...revealedDividerIds],
          completedDividerIds: [...completedDividerIds],
          interactedFlipCardIds: [...interactedContentIds].filter((id) =>
            flipCardProgressIds.has(id),
          ),
          interactedContentIds: [...interactedContentIds],
          selectedLessonId,
          quizScores,
          passedQuizIds: [...passedQuizIds],
        }),
      );
    } catch {
      // Standalone file URLs may not allow local storage.
    }
  }, [
    initialData.courseId,
    progress,
    persistLocalProgress,
    progressAdapter,
    progressLoadedCourseId,
    visitedLessonIds,
    lessonScrollProgress,
    quizScores,
    passedQuizIds,
    revealedDividerIds,
    completedDividerIds,
    interactedContentIds,
    flipCardProgressIds,
    selectedLessonId,
  ]);

  const markContentAboveComplete = useCallback(
    (lesson: (typeof lessons)[number], element: HTMLDivElement) => {
      if (lesson.lessonType === "quiz") {
        if (passedQuizIds.has(lesson.id)) {
          setLessonScrollProgress((previous) => previous[lesson.id] === 100 ? previous : { ...previous, [lesson.id]: 100 });
          setVisitedLessonIds((previous) => previous.has(lesson.id) ? previous : new Set(previous).add(lesson.id));
        }
        return;
      }
      const divider = lesson.blocks.find(
        (block) =>
          block.type === "divider" &&
          block.data.style === "continue" &&
          !revealedDividerIds.has(block.id),
      );
      const continueDividers = lesson.blocks.filter(
        (block) => block.type === "divider" && block.data.style === "continue",
      );
      const revealedContinueCount = continueDividers.filter((block) =>
        revealedDividerIds.has(block.id),
      ).length;
      const reachedEnd = hasReachedContentEnd(element);
      const hasPendingInteractiveContent = getPendingInteractiveProgressIds(
        lesson.blocks,
        interactedContentIds,
      ).length > 0;
      const readingProgress = getLessonReadingProgress({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
        revealedContinueCount,
        totalContinueCount: continueDividers.length,
      });
      const trackedProgress = hasPendingInteractiveContent
        ? Math.min(readingProgress, 99)
        : readingProgress;
      setLessonScrollProgress((previous) =>
        previous[lesson.id] === trackedProgress
          ? previous
          : { ...previous, [lesson.id]: trackedProgress },
      );
      if (!reachedEnd) return;
      if (divider?.type === "divider") {
        const dividerIndex = lesson.blocks.findIndex(
          (block) => block.id === divider.id,
        );
        const hasPendingInteractiveContentAboveDivider = getPendingInteractiveProgressIds(
          lesson.blocks,
          interactedContentIds,
          dividerIndex,
        ).length > 0;
        if (
          divider.data.completionType === "completeAbove" &&
          !hasPendingInteractiveContentAboveDivider &&
          !completedDividerIds.has(divider.id)
        ) {
          setCompletedDividerIds((previous) =>
            new Set(previous).add(divider.id),
          );
          setUnlockingDividerIds((previous) =>
            new Set(previous).add(divider.id),
          );
        }
        return;
      }
      if (
        canCompleteLesson({
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          scrollTop: element.scrollTop,
          hasPendingContinue: hasPendingInteractiveContent,
        })
      ) {
        setVisitedLessonIds((previous) =>
          previous.has(lesson.id) ? previous : new Set(previous).add(lesson.id),
        );
      }
    },
    [completedDividerIds, interactedContentIds, passedQuizIds, revealedDividerIds],
  );

  useEffect(() => {
    const lesson = lessons.find((item) => item.id === selectedLessonId);
    const element = lesson
      ? lessonBodyScrollRefs.current.get(lesson.id)
      : undefined;
    if (lesson && element) markContentAboveComplete(lesson, element);
  }, [selectedLessonId, revealedDividerIds, interactedContentIds, lessons, markContentAboveComplete]);

  useEffect(() => {
    if (!pendingContinueScroll) return;
    const frame = window.requestAnimationFrame(() => {
      if (pendingContinueScroll.lessonId === selectedLessonId) {
        const container = lessonBodyScrollRefs.current.get(
          pendingContinueScroll.lessonId,
        );
        const target =
          container &&
          Array.from(
            container.querySelectorAll<HTMLElement>("[data-lesson-block-id]"),
          ).find(
            (element) =>
              element.dataset.lessonBlockId === pendingContinueScroll.blockId,
          );
        if (container && target) {
          const top =
            target.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop -
            16;
          container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        }
      }
      setPendingContinueScroll(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingContinueScroll, revealedDividerIds, selectedLessonId]);

  useEffect(() => {
    if (mode !== "learn" || !selectedLessonId) return;
    const scrollContainer = lessonContentScrollRef.current;
    const article = lessonArticleRefs.current.get(selectedLessonId);
    if (!scrollContainer || !article) return;
    const top =
      article.getBoundingClientRect().top -
      scrollContainer.getBoundingClientRect().top +
      scrollContainer.scrollTop;
    scrollContainer.scrollTo({ top, behavior: "smooth" });
  }, [mode, selectedLessonId]);

  function selectLesson(lessonId: string) {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (lesson && lesson.lessonType !== "quiz") {
      const initiallyViewedIds = getInitiallyViewedInteractionIds(lesson.blocks);
      if (initiallyViewedIds.length) {
        setInteractedContentIds((previous) => {
          const next = new Set(previous);
          initiallyViewedIds.forEach((id) => next.add(id));
          return next;
        });
      }
    }
    setSelectedLessonId(lessonId);
    setMode("learn");
    setMobileMenuOpen(false);
  }

  function startLearning() {
    setMode("learn");
    if (!selectedLesson && lessons[0]) selectLesson(lessons[0].id);
  }

  function renderLessonMenu(mobile = false) {
    if (!mobile && sidebarCollapsed) return null;
    const menuWidth = mobile
      ? "w-[min(84%,320px)] shrink-0 shadow-2xl"
      : `${device === "tablet" ? "w-[220px]" : "w-[270px]"} shrink-0 border-r border-slate-200`;
    return (
      <aside
        className={`flex min-h-0 flex-col bg-white ${mobile ? "relative z-10 h-full overflow-hidden" : "overflow-y-auto"} ${menuWidth}`}
      >
        <div className="shrink-0 px-4 py-5 text-white sm:px-5" style={{ backgroundColor: "var(--course-primary)" }}>
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-3 text-lg font-semibold leading-tight">
              {initialData.title}
            </p>
            {mobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close course menu"
                onClick={() => setMobileMenuOpen(false)}
                className="-mr-2 -mt-2 size-8 text-white hover:bg-white/15 hover:text-white"
              >
                <X size={17} />
              </Button>
            )}
          </div>
          <div className="mt-5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em]">
            <span>{progress}% complete</span>
            <span>
              {visitedLessonCount}/{lessons.length}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25"
            role="progressbar"
            aria-label="Course completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-white transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {sections.map((section) => {
            const sectionLessons = lessons.filter(
              (lesson) => lesson.sectionId === section.id,
            );
            if (!sectionLessons.length) return null;
            return (
              <section key={section.id}>
                <h2 className="flex items-center justify-between bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  <span>{section.title}</span>
                  <ChevronDown size={13} />
                </h2>
                <ul className="divide-y divide-slate-100">
                  {sectionLessons.map((lesson) => {
                    const Icon = lessonIcons[lesson.icon ?? "file"];
                    const active = selectedLesson?.id === lesson.id;
                    const visited = visitedLessonIds.has(lesson.id);
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => selectLesson(lesson.id)}
                          aria-current={active ? "page" : undefined}
                          className={`flex min-h-20 w-full items-start gap-2.5 px-4 py-4 text-left ${active ? "" : "hover:bg-slate-50"}`}
                          style={active ? { backgroundColor: "color-mix(in srgb, var(--course-primary) 10%, white)" } : undefined}
                        >
                          <Icon
                            size={14}
                            className="mt-0.5 shrink-0 text-slate-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block break-words text-sm leading-5 [overflow-wrap:anywhere] ${active ? "font-semibold" : "font-medium text-slate-800"}`}
                              style={active ? { color: "var(--course-primary)" } : undefined}
                            >
                              {lesson.title}
                            </span>
                            <span className="mt-1 block text-[11px] text-slate-500">
                              {lesson.lessonType === "quiz" ? "Quiz" : "Lesson"}
                            </span>
                          </span>
                          <LessonProgressIndicator
                            progress={lessonScrollProgress[lesson.id] ?? 0}
                            complete={visited}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </aside>
    );
  }

  const viewportClass =
    device === "desktop"
      ? "w-full"
      : device === "tablet"
        ? "w-full max-w-[900px] border-x border-slate-200 shadow-xl"
        : "w-full max-w-[390px] border-x border-slate-300 shadow-2xl";

  return (
    <main style={themeStyle} className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-900">
      {!standalone && (
      <header className="relative z-50 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Back to course editor"
            title="Back to editor"
            onClick={onEdit}
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Course Preview</span>
            <span className="hidden text-xs text-slate-500 sm:inline">
              Current version
            </span>
          </div>
        </div>
        <div
          className="flex items-center rounded-lg bg-slate-100 p-0.5"
          role="group"
          aria-label="Preview mode"
        >
          <Button
            type="button"
            variant={mode === "course" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={mode === "course"}
            onClick={() => setMode("course")}
            className="h-8 px-2.5 text-xs sm:px-3"
          >
            Preview course
          </Button>
          <Button
            type="button"
            variant={mode === "learn" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={mode === "learn"}
            onClick={startLearning}
            className="h-8 px-2.5 text-xs sm:px-3"
          >
            Learn
          </Button>
        </div>
        <div
          className="ml-auto flex items-center gap-1"
          role="group"
          aria-label="Preview device size"
        >
          {(
            [
              { id: "desktop", label: "Desktop", Icon: Monitor },
              { id: "tablet", label: "Tablet", Icon: Tablet },
              { id: "mobile", label: "Mobile", Icon: Smartphone },
            ] as const
          ).map(({ id, label, Icon }) => (
            <Button
              key={id}
              type="button"
              variant={device === id ? "secondary" : "ghost"}
              size="icon"
              aria-label={`Preview on ${label.toLowerCase()}`}
              aria-pressed={device === id}
              title={label}
              onClick={() => {
                setDevice(id);
                setMobileMenuOpen(false);
              }}
              className="size-8"
            >
              <Icon size={16} />
            </Button>
          ))}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onEdit}
            className="ml-1 h-8 px-3 text-xs"
          >
            Edit
          </Button>
          <PublishMenu courseId={initialData.courseId} title={initialData.title} className="h-8 px-2.5 text-xs sm:px-3" />
        </div>
      </header>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          style={{ fontFamily: courseThemeFontFamilies[courseTheme.fontFamily] }}
          className={`mx-auto h-full overflow-hidden bg-white transition-[max-width] duration-200 ${viewportClass}`}
        >
          {mode === "course" ? (
            <div className="h-full overflow-y-auto">
              <section
                className={`px-5 text-center text-white sm:px-10 ${device === "mobile" ? "py-12" : "py-16 sm:py-24"}`}
                style={{ backgroundImage: "linear-gradient(135deg, color-mix(in srgb, var(--course-primary) 72%, #0f172a), color-mix(in srgb, var(--course-primary) 18%, #020617))" }}
              >
                <div className="mx-auto max-w-5xl">
                  {initialData.authorVisible && (
                    <div className="mb-6 inline-flex items-center gap-2.5 text-sm font-medium text-white/90">
                      <span className="grid size-9 place-items-center rounded-full text-xs font-semibold" style={{ backgroundColor: "var(--course-accent)" }}>
                        {initials}
                      </span>
                      <span>{authorName}</span>
                    </div>
                  )}
                  <StatementTextPreview
                    tag="h3"
                    text={initialData.title}
                    className={`mx-auto font-bold tracking-tight text-white ${device === "mobile" ? "text-3xl" : device === "tablet" ? "text-4xl" : "text-4xl sm:text-6xl"} [&_h1]:my-0 [&_h1]:text-inherit [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:my-0 [&_h2]:text-inherit [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:my-0 [&_h3]:text-inherit [&_h3]:font-bold [&_p]:my-0 [&_p]:text-inherit [&_p]:font-bold`}
                  />
                  {lessons.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startLearning}
                      className="mt-8 min-w-36 rounded-full border-white bg-white text-slate-950 hover:bg-slate-100"
                    >
                      Start learning
                    </Button>
                  )}
                </div>
              </section>
              <div
                className={`mx-auto max-w-5xl px-5 ${device === "mobile" ? "py-8" : "py-12 sm:px-10 sm:py-16"}`}
              >
                {initialData.description.trim() && (
                  <section
                    aria-label="Course description"
                    className="mx-auto mb-14 max-w-3xl text-slate-700"
                  >
                    <StatementTextPreview
                      tag="p"
                      text={initialData.description}
                      html={initialData.descriptionHtml}
                      className="text-base leading-8 [&_h1]:my-4 [&_h2]:my-3 [&_h3]:my-2 [&_p]:my-3"
                    />
                  </section>
                )}
                <section
                  aria-labelledby="preview-course-content"
                  className="mx-auto max-w-4xl"
                >
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--course-primary)" }}>
                        Course outline
                      </p>
                      <h2
                        id="preview-course-content"
                        className="mt-1 text-2xl font-bold tracking-tight"
                      >
                        What you’ll learn
                      </h2>
                    </div>
                    <span className="text-sm text-slate-500">
                      {lessons.length} content{" "}
                      {lessons.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  {lessons.length ? (
                    <div className="space-y-8">
                      {sections.map((section) => {
                        const sectionLessons = lessons.filter(
                          (lesson) => lesson.sectionId === section.id,
                        );
                        if (!sectionLessons.length) return null;
                        return (
                          <section key={section.id}>
                            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                              {section.title}
                            </h3>
                            <div className="divide-y divide-slate-200 border-y border-slate-200">
                              {sectionLessons.map((lesson) => {
                                const Icon = lessonIcons[lesson.icon ?? "file"];
                                return (
                                  <button
                                    key={lesson.id}
                                    type="button"
                                    onClick={() => selectLesson(lesson.id)}
                                    className="flex min-h-16 w-full items-center gap-3 px-2 py-3 text-left hover:bg-slate-50"
                                  >
                                    <Icon
                                      size={17}
                                      className="shrink-0 text-slate-500"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold text-slate-900">
                                        {lesson.title}
                                      </span>
                                      <span className="mt-1 block text-xs text-slate-500">
                                        {lesson.lessonType === "quiz"
                                          ? "Quiz"
                                          : "Lesson"}
                                      </span>
                                    </span>
                                    <ArrowRight
                                      size={16}
                                      className="shrink-0 text-slate-400"
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
                      Course content will appear here when it is added.
                    </p>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="course-learn-enter relative flex h-full min-h-0">
              {!useMobileMenu && renderLessonMenu()}
              {useMobileMenu && mobileMenuOpen && (
                <div className="absolute inset-x-0 bottom-0 top-12 z-40 flex">
                  <button
                    type="button"
                    aria-label="Close course menu"
                    onClick={() => setMobileMenuOpen(false)}
                    className="absolute inset-0 bg-slate-950/40"
                  />
                  {renderLessonMenu(true)}
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="relative z-50 flex min-h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
                  {useMobileMenu ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Open course menu"
                      aria-expanded={mobileMenuOpen}
                      onClick={() => setMobileMenuOpen(true)}
                      className="size-8"
                    >
                      <Menu size={18} />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={
                        sidebarCollapsed
                          ? "Expand course menu"
                          : "Collapse course menu"
                      }
                      aria-expanded={!sidebarCollapsed}
                      onClick={() =>
                        setSidebarCollapsed((collapsed) => !collapsed)
                      }
                      className="size-8"
                    >
                      <PanelLeftOpen
                        size={17}
                        className={sidebarCollapsed ? "" : "hidden"}
                      />
                      <PanelLeftClose
                        size={17}
                        className={sidebarCollapsed ? "hidden" : ""}
                      />
                    </Button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">
                    {initialData.title}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {selectedLesson
                      ? `${lessonIndex + 1} / ${lessons.length}`
                      : "Course content"}
                  </span>
                </div>
                <div
                  ref={lessonContentScrollRef}
                  className="min-h-0 flex-1 overflow-hidden overscroll-none scroll-smooth"
                >
                  {lessons.length ? (
                    lessons.map((lesson, index) => (
                      <article
                        key={lesson.id}
                        id={`preview-content-${lesson.id}`}
                        ref={(node) => {
                          if (node)
                            lessonArticleRefs.current.set(lesson.id, node);
                          else lessonArticleRefs.current.delete(lesson.id);
                        }}
                        className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden"
                      >
                        <div
                          ref={(node) => {
                            if (node)
                              lessonBodyScrollRefs.current.set(lesson.id, node);
                            else lessonBodyScrollRefs.current.delete(lesson.id);
                          }}
                          onScroll={(event) =>
                            markContentAboveComplete(
                              lesson,
                              event.currentTarget,
                            )
                          }
                          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain"
                        >
                          <nav
                            aria-label={`Previous section from content ${index + 1}`}
                            className="w-full"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={index <= 0}
                              onClick={() =>
                                lessons[index - 1] &&
                                selectLesson(lessons[index - 1].id)
                              }
                              className="relative h-auto min-h-20 w-full justify-center rounded-none border-0 bg-slate-100 px-14 py-4 text-center text-slate-700 hover:bg-slate-200"
                            >
                              <span className="flex min-w-0 flex-col items-center whitespace-normal leading-tight">
                                <span className="text-[11px] font-medium tracking-wide text-slate-500">
                                  {Math.max(index, 1)}/{lessons.length}
                                </span>
                                <span className="mt-1 inline-flex max-w-full items-center justify-center gap-2 text-base font-semibold sm:text-lg">
                                  <ArrowLeft
                                    size={18}
                                    aria-hidden="true"
                                    className="shrink-0"
                                  />
                                  {lessons[index - 1]?.title || "Start of course"}
                                </span>
                              </span>
                            </Button>
                          </nav>
                          <div className="mx-auto w-full max-w-[720px] px-4 py-8">
                            <StatementTextPreview
                              tag="h3"
                              text={lesson.title}
                              html={lesson.titleHtml}
                              className={`font-bold tracking-tight  text-slate-900 ${device === "mobile" ? "text-3xl" : "text-4xl"} [&_h1]:my-0 [&_h1]:text-inherit [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:my-0 [&_h2]:text-inherit [&_h2]:font-bold [&_h3]:my-0 [&_h3]:text-inherit [&_h3]:font-bold [&_p]:my-0 [&_p]:text-inherit [&_p]:font-bold`}
                            />
                            {initialData.authorVisible && (
                              <div className="mt-4 flex items-center gap-2.5 text-xs font-medium text-slate-500">
                                <span className="grid size-8 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: "var(--course-accent)" }}>
                                  {initials}
                                </span>
                                <span>{authorName}</span>
                                <span className="ml-2 border-l border-slate-200 pl-3 uppercase tracking-wide">
                                  Content {index + 1} / {lessons.length}
                                </span>
                              </div>
                            )}
                          </div>
                          {lesson.lessonType === "quiz" ? (
                            lesson.quizQuestions.length ? (
                              <QuizAssessmentPreview
                                questions={lesson.quizQuestions}
                                passingScore={lesson.passingScore ?? 70}
                                savedScore={quizScores[lesson.id]}
                                wasPassed={passedQuizIds.has(lesson.id)}
                                onResult={(result) => {
                                  setQuizScores((previous) => ({
                                    ...previous,
                                    [lesson.id]: Math.max(previous[lesson.id] ?? 0, result.score),
                                  }));
                                  if (result.passed) {
                                    setPassedQuizIds((previous) => new Set(previous).add(lesson.id));
                                    setLessonScrollProgress((previous) => ({ ...previous, [lesson.id]: 100 }));
                                    setVisitedLessonIds((previous) => new Set(previous).add(lesson.id));
                                  }
                                }}
                              />
                            ) : (
                              <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
                                This quiz has no questions yet.
                              </div>
                            )
                          ) : lesson.blocks.length ? (
                            <LessonBlocksPreview
                              blocks={lesson.blocks}
                              device={device}
                              animate={lesson.id === selectedLessonId}
                              revealedDividerIds={revealedDividerIds}
                              completedDividerIds={completedDividerIds}
                              unlockingDividerIds={unlockingDividerIds}
                              interactedContentIds={interactedContentIds}
                              onReveal={(dividerId, nextBlockId) => {
                                setRevealedDividerIds((previous) =>
                                  new Set(previous).add(dividerId),
                                );
                                if (nextBlockId)
                                  setPendingContinueScroll({
                                    lessonId: lesson.id,
                                    blockId: nextBlockId,
                                  });
                              }}
                              onUnlockAnimationEnd={(dividerId) => {
                                setUnlockingDividerIds((previous) => {
                                  if (!previous.has(dividerId)) return previous;
                                  const next = new Set(previous);
                                  next.delete(dividerId);
                                  return next;
                                });
                              }}
                              onInteractiveProgress={(progressId) => {
                                setInteractedContentIds((previous) => {
                                  if (previous.has(progressId)) return previous;
                                  return new Set(previous).add(progressId);
                                });
                              }}
                            />
                          ) : (
                            <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
                              This content has no lesson material yet.
                            </div>
                          )}
                          <nav
                            aria-label={`Next section from content ${index + 1}`}
                            className="mt-auto w-full shrink-0"
                          >
                            {((lesson.lessonType === "quiz"
                              ? passedQuizIds.has(lesson.id)
                              : lesson.blocks.every(
                                (block) =>
                                  block.type !== "divider" ||
                                  block.data.style !== "continue" ||
                                  revealedDividerIds.has(block.id),
                              ))) && (
                              <>
                                <Button
                                  type="button"
                                  variant="default"
                                  disabled={index >= lessons.length - 1 || (pendingInteractiveIdsByLesson.get(lesson.id)?.length ?? 0) > 0}
                                  aria-describedby={(pendingInteractiveIdsByLesson.get(lesson.id)?.length ?? 0) > 0 ? `interactive-hint-${lesson.id}` : undefined}
                                  onClick={() =>
                                    lessons[index + 1] &&
                                    selectLesson(lessons[index + 1].id)
                                  }
                                  className="relative h-auto min-h-20 w-full justify-center rounded-none border-0 px-14 py-4 text-center text-white"
                                  style={{ backgroundColor: "var(--course-primary)" }}
                                >
                                  <span className="flex min-w-0 flex-col items-center whitespace-normal leading-tight">
                                    <span className="text-[11px] font-medium tracking-wide text-white/75">
                                      {Math.min(index + 2, lessons.length)}/{lessons.length}
                                    </span>
                                    <span className="mt-1 inline-flex max-w-full items-center justify-center gap-2 text-base font-semibold sm:text-lg">
                                      {lessons[index + 1]?.title || "End of course"}
                                      <ArrowRight
                                        size={18}
                                        aria-hidden="true"
                                        className="shrink-0"
                                      />
                                    </span>
                                  </span>
                                </Button>
                                {(pendingInteractiveIdsByLesson.get(lesson.id)?.length ?? 0) > 0 && (
                                  <p id={`interactive-hint-${lesson.id}`} className="px-4 py-2 text-center text-xs text-slate-500">
                                    Complete each interactive activity in this lesson before continuing.
                                  </p>
                                )}
                              </>
                            )}
                          </nav>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="grid min-h-full place-items-center px-6 py-12 text-center">
                      <div className="max-w-sm">
                        <BookOpen
                          size={34}
                          className="mx-auto"
                          style={{ color: "var(--course-primary)" }}
                        />
                        <h2 className="mt-4 text-xl font-semibold">
                          Your course is ready to explore
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Choose a content item from the course menu to preview
                          it.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
