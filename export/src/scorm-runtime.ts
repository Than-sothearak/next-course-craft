import type {
  LearnerProgressAdapter,
  LearnerProgressSnapshot,
} from "../../lib/export/progress";
import {
  getFlipCardProgressId,
  getInteractiveBlockProgressIds,
} from "../../lib/export/progress";
import type { ContentBlock } from "../../lib/schemas/block";

type Scorm12Api = {
  LMSInitialize(parameter: ""): string | boolean;
  LMSFinish(parameter: ""): string | boolean;
  LMSGetValue(element: string): string;
  LMSSetValue(element: string, value: string): string | boolean;
  LMSCommit(parameter: ""): string | boolean;
};

type Scorm2004Api = {
  Initialize(parameter: ""): string | boolean;
  Terminate(parameter: ""): string | boolean;
  GetValue(element: string): string;
  SetValue(element: string, value: string): string | boolean;
  Commit(parameter: ""): string | boolean;
};

type ScormBridge = {
  initialize(): string | boolean;
  finish(): string | boolean;
  get(element: string): string;
  set(element: string, value: string): string | boolean;
  commit(): string | boolean;
  completionField: string;
  locationField: string;
  sessionTimeField: string;
  exitField: string;
  completedValue: string;
  incompleteValue: string;
  sessionTime(seconds: number): string;
  exit(completed: boolean): string;
};

type ScormRuntimeCourse = {
  courseId: string;
  revision?: number;
  sections: Array<{ id: string; order: number }>;
  lessons: Array<{
    id: string;
    sectionId: string;
    order: number;
    lessonType?: "content" | "quiz";
    passingScore?: number;
    quizQuestions?: Array<{ id: string }>;
    blocks: Array<{ id: string; type: string; data?: unknown }>;
  }>;
};

type PackedState = {
  k: string;
  v: string;
  p?: string;
  r: string;
  d?: string;
  a?: string;
  f?: string;
  i?: string;
  q?: string;
  l: number;
  m?: 1;
};

const SUSPEND_DATA_LIMIT = 4000;

function getApi(candidate: Window): Scorm12Api | null {
  try {
    const api = (candidate as Window & { API?: Scorm12Api }).API;
    return api && typeof api.LMSInitialize === "function" ? api : null;
  } catch {
    return null;
  }
}

function getScorm2004Api(candidate: Window): Scorm2004Api | null {
  try {
    const api = (candidate as Window & { API_1484_11?: Scorm2004Api })
      .API_1484_11;
    return api && typeof api.Initialize === "function" ? api : null;
  } catch {
    return null;
  }
}

export function findScorm12Api(host: Window): Scorm12Api | null {
  return findApi(host, getApi);
}

export function findScorm2004Api(host: Window): Scorm2004Api | null {
  return findApi(host, getScorm2004Api);
}

function findApi<T>(
  host: Window,
  getCandidateApi: (candidate: Window) => T | null,
): T | null {
  const pending = [host];
  const visited = new Set<Window>();
  for (let depth = 0; pending.length && depth < 500; depth += 1) {
    const current = pending.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const api = getCandidateApi(current);
    if (api) return api;

    try {
      const parent = current.parent;
      if (parent && parent !== current && !visited.has(parent)) {
        pending.push(parent);
      }
    } catch {
      // A cross-origin frame may prevent walking this branch.
    }

    try {
      const opener = current.opener;
      if (opener && opener !== current && !visited.has(opener)) {
        pending.push(opener);
      }
    } catch {
      // A cross-origin opener may prevent walking this branch.
    }
  }
  return null;
}

function scormCallSucceeded(result: string | boolean) {
  return (
    result === true ||
    (typeof result === "string" && result.trim().toLowerCase() === "true")
  );
}

function scorm12Bridge(api: Scorm12Api): ScormBridge {
  return {
    initialize: () => api.LMSInitialize(""),
    finish: () => api.LMSFinish(""),
    get: (element) => api.LMSGetValue(element),
    set: (element, value) => api.LMSSetValue(element, value),
    commit: () => api.LMSCommit(""),
    completionField: "cmi.core.lesson_status",
    locationField: "cmi.core.lesson_location",
    sessionTimeField: "cmi.core.session_time",
    exitField: "cmi.core.exit",
    completedValue: "completed",
    incompleteValue: "incomplete",
    sessionTime(seconds) {
      const hours = Math.floor(seconds / 3600)
        .toString()
        .padStart(4, "0");
      const minutes = Math.floor((seconds % 3600) / 60)
        .toString()
        .padStart(2, "0");
      const remainder = (seconds % 60).toString().padStart(2, "0");
      return `${hours}:${minutes}:${remainder}.00`;
    },
    exit: (completed) => (completed ? "" : "suspend"),
  };
}

function scorm2004Bridge(api: Scorm2004Api): ScormBridge {
  return {
    initialize: () => api.Initialize(""),
    finish: () => api.Terminate(""),
    get: (element) => api.GetValue(element),
    set: (element, value) => api.SetValue(element, value),
    commit: () => api.Commit(""),
    completionField: "cmi.completion_status",
    locationField: "cmi.location",
    sessionTimeField: "cmi.session_time",
    exitField: "cmi.exit",
    completedValue: "completed",
    incompleteValue: "incomplete",
    sessionTime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainder = seconds % 60;
      return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${remainder || (!hours && !minutes) ? `${remainder}S` : ""}`;
    },
    exit: (completed) => (completed ? "normal" : "suspend"),
  };
}

function toBase64(host: Window, bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return host.btoa(binary);
}

function fromBase64(host: Window, value: string, expectedLength: number) {
  const bytes = new Uint8Array(expectedLength);
  if (!value || !expectedLength) return bytes;
  try {
    const binary = host.atob(value);
    for (
      let index = 0;
      index < Math.min(binary.length, bytes.length);
      index += 1
    ) {
      bytes[index] = binary.charCodeAt(index);
    }
  } catch {
    return new Uint8Array(expectedLength);
  }
  return bytes;
}

function encodeBits(
  host: Window,
  count: number,
  selected: ReadonlySet<number>,
) {
  const bytes = new Uint8Array(Math.ceil(count / 8));
  for (const index of selected) {
    if (index >= 0 && index < count) bytes[index >> 3] |= 1 << (index & 7);
  }
  return toBase64(host, bytes);
}

function decodeBits(host: Window, value: string, count: number) {
  const bytes = fromBase64(host, value, Math.ceil(count / 8));
  const selected: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (bytes[index >> 3] & (1 << (index & 7))) selected.push(index);
  }
  return selected;
}

function orderedLessons(course: ScormRuntimeCourse) {
  const sections = [...course.sections].sort((a, b) => a.order - b.order);
  return sections.flatMap((section) =>
    course.lessons
      .filter((lesson) => lesson.sectionId === section.id)
      .sort((a, b) => a.order - b.order),
  );
}

function emptyProgress(): LearnerProgressSnapshot {
  return {
    visitedLessonIds: [],
    lessonScrollProgress: {},
    revealedDividerIds: [],
    completedDividerIds: [],
    selectedLessonId: null,
    quizScores: {},
    passedQuizIds: [],
  };
}

export function createScormProgressAdapter(
  course: ScormRuntimeCourse,
  host: Window = window,
): LearnerProgressAdapter | null {
  const api = findScorm12Api(host);
  if (!api) return null;
  return createProgressAdapter(course, host, scorm12Bridge(api));
}

export function createScorm2004ProgressAdapter(
  course: ScormRuntimeCourse,
  host: Window = window,
): LearnerProgressAdapter | null {
  const api = findScorm2004Api(host);
  if (!api) return null;
  return createProgressAdapter(course, host, scorm2004Bridge(api));
}

function createProgressAdapter(
  course: ScormRuntimeCourse,
  host: Window,
  runtimeApi: ScormBridge,
): LearnerProgressAdapter | null {
  try {
    if (!scormCallSucceeded(runtimeApi.initialize())) return null;
  } catch {
    return null;
  }

  const lessons = orderedLessons(course);
  const lessonIds = lessons.map((lesson) => lesson.id);
  const lessonIndex = new Map(lessonIds.map((id, index) => [id, index]));
  const quizLessons = lessons.filter((lesson) => lesson.lessonType === "quiz");
  const quizIndex = new Map(quizLessons.map((lesson, index) => [lesson.id, index]));
  const dividers = lessons.flatMap((lesson, index) =>
    lesson.blocks
      .filter((block) => block.type === "divider")
      .map((block) => ({ id: block.id, lessonIndex: index })),
  );
  const dividerIndex = new Map(
    dividers.map((divider, index) => [divider.id, index]),
  );
  const flipCards = lessons.flatMap((lesson, lessonIndex) =>
    lesson.blocks
      .filter((block) => block.type === "flipCard")
      .flatMap((block) =>
        ((block.data as { cards?: Array<{ id: string }> } | undefined)?.cards ?? []).map((card) => ({
          id: getFlipCardProgressId(block.id, card.id),
          lessonIndex,
        })),
      ),
  );
  const flipCardIds = flipCards.map((card) => card.id);
  const flipCardIndex = new Map(
    flipCardIds.map((id, index) => [id, index]),
  );
  const interactions = lessons.flatMap((lesson, lessonIndex) =>
    lesson.blocks.flatMap((block) =>
      getInteractiveBlockProgressIds(block as unknown as ContentBlock).map(
        (id) => ({ id, lessonIndex }),
      ),
    ),
  );
  const interactionIds = interactions.map((interaction) => interaction.id);
  const interactionIndex = new Map(
    interactionIds.map((id, index) => [id, index]),
  );
  const versionKey = `${course.courseId}:${course.revision ?? 0}`;
  const startedAt = Date.now();
  let completed = ["completed", "passed"].includes(
    safeGet(runtimeApi.completionField),
  );
  let finished = false;
  let commitTimer: number | null = null;

  function safeGet(element: string) {
    try {
      return runtimeApi.get(element) || "";
    } catch {
      return "";
    }
  }

  function safeSet(element: string, value: string) {
    try {
      return scormCallSucceeded(runtimeApi.set(element, value));
    } catch {
      return false;
    }
  }

  function commit() {
    try {
      runtimeApi.commit();
    } catch {
      // LMS runtime errors must not stop the learner from using the content.
    }
  }

  function scheduleCommit() {
    if (commitTimer !== null) host.clearTimeout(commitTimer);
    commitTimer = host.setTimeout(() => {
      commitTimer = null;
      if (!finished) commit();
    }, 350);
  }

  function pack(snapshot: LearnerProgressSnapshot): string {
    const hasGenericInteractionIds = snapshot.interactedContentIds !== undefined;
    const visitedIndexes = new Set(
      snapshot.visitedLessonIds
        .map((id) => lessonIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const revealedIndexes = new Set(
      snapshot.revealedDividerIds
        .map((id) => dividerIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const completedIndexes = new Set(
      snapshot.completedDividerIds
        .map((id) => dividerIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const selectedIndex = snapshot.selectedLessonId
      ? (lessonIndex.get(snapshot.selectedLessonId) ?? -1)
      : -1;
    const progressBytes = new Uint8Array(lessons.length);
    lessons.forEach((lesson, index) => {
      progressBytes[index] = Math.max(
        0,
        Math.min(
          100,
          Math.round(snapshot.lessonScrollProgress[lesson.id] ?? 0),
        ),
      );
    });
    const passedQuizIndexes = new Set(
      (snapshot.passedQuizIds ?? [])
        .map((id) => quizIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const interactedFlipCardIndexes = new Set(
      (snapshot.interactedFlipCardIds ?? snapshot.interactedContentIds ?? [])
        .map((id) => flipCardIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const interactedContentIds =
      snapshot.interactedContentIds ?? snapshot.interactedFlipCardIds ?? [];
    const interactedContentIndexes = new Set(
      interactedContentIds
        .map((id) => interactionIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const quizScoreBytes = new Uint8Array(quizLessons.length).fill(255);
    quizLessons.forEach((lesson, index) => {
      const score = snapshot.quizScores?.[lesson.id];
      if (typeof score === "number" && Number.isFinite(score)) {
        quizScoreBytes[index] = Math.max(0, Math.min(100, Math.round(score)));
      }
    });

    const fullState: PackedState = {
      k: versionKey,
      v: encodeBits(host, lessons.length, visitedIndexes),
      p: toBase64(host, progressBytes),
      r: encodeBits(host, dividers.length, revealedIndexes),
      d: encodeBits(host, dividers.length, completedIndexes),
      a: encodeBits(host, quizLessons.length, passedQuizIndexes),
      f: encodeBits(host, flipCards.length, interactedFlipCardIndexes),
      ...(interactions.length && hasGenericInteractionIds
        ? { i: encodeBits(host, interactions.length, interactedContentIndexes) }
        : {}),
      q: toBase64(host, quizScoreBytes),
      l: selectedIndex,
    };
    let serialized = JSON.stringify(fullState);
    if (serialized.length <= SUSPEND_DATA_LIMIT) return serialized;

    const currentDividers = dividers.filter(
      (divider) => divider.lessonIndex === selectedIndex,
    );
    const currentIndex = new Map(
      currentDividers.map((divider, index) => [divider.id, index]),
    );
    const currentRevealed = new Set(
      snapshot.revealedDividerIds
        .map((id) => currentIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const currentCompleted = new Set(
      snapshot.completedDividerIds
        .map((id) => currentIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const currentFlipCards = flipCards.filter(
      (card) => card.lessonIndex === selectedIndex,
    );
    const currentFlipCardIndex = new Map(
      currentFlipCards.map((card, index) => [card.id, index]),
    );
    const currentInteractedFlipCards = new Set(
      (snapshot.interactedFlipCardIds ?? snapshot.interactedContentIds ?? [])
        .map((id) => currentFlipCardIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const currentInteractions = interactions.filter(
      (interaction) => interaction.lessonIndex === selectedIndex,
    );
    const currentInteractionIndex = new Map(
      currentInteractions.map((interaction, index) => [interaction.id, index]),
    );
    const currentInteractedContentIds =
      snapshot.interactedContentIds ?? snapshot.interactedFlipCardIds ?? [];
    const currentInteractedContent = new Set(
      currentInteractedContentIds
        .map((id) => currentInteractionIndex.get(id))
        .filter((index): index is number => index !== undefined),
    );
    const compactState: PackedState = {
      ...fullState,
      r: encodeBits(host, currentDividers.length, currentRevealed),
      d: encodeBits(host, currentDividers.length, currentCompleted),
      f: encodeBits(host, currentFlipCards.length, currentInteractedFlipCards),
      ...(interactions.length && hasGenericInteractionIds
        ? { i: encodeBits(host, currentInteractions.length, currentInteractedContent) }
        : {}),
      m: 1,
    };
    serialized = JSON.stringify(compactState);
    if (serialized.length <= SUSPEND_DATA_LIMIT) return serialized;

    delete compactState.p;
    delete compactState.d;
    return JSON.stringify(compactState);
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (commitTimer !== null) host.clearTimeout(commitTimer);
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    safeSet(
      runtimeApi.sessionTimeField,
      runtimeApi.sessionTime(elapsedSeconds),
    );
    safeSet(runtimeApi.exitField, runtimeApi.exit(completed));
    commit();
    try {
      runtimeApi.finish();
    } catch {
      // The SCO is already leaving; do not interrupt the browser navigation.
    }
  }

  if (!safeGet(runtimeApi.completionField)) {
    safeSet(runtimeApi.completionField, runtimeApi.incompleteValue);
  }
  host.addEventListener("pagehide", finish, { once: true });
  host.addEventListener("beforeunload", finish, { once: true });

  return {
    load(courseId) {
      if (courseId !== course.courseId) return null;
      const serialized = safeGet("cmi.suspend_data");
      if (serialized) {
        try {
          const state = JSON.parse(serialized) as PackedState;
          if (state.k === versionKey) {
            const visitedLessonIds = decodeBits(host, state.v, lessons.length)
              .map((index) => lessonIds[index])
              .filter((id): id is string => Boolean(id));
            const selectedIndex = Number.isInteger(state.l) ? state.l : -1;
            const lessonScrollProgress: Record<string, number> = {};
            if (state.p) {
              const progressBytes = fromBase64(host, state.p, lessons.length);
              lessons.forEach((lesson, index) => {
                if (progressBytes[index] > 0) {
                  lessonScrollProgress[lesson.id] = progressBytes[index];
                }
              });
            }
            const quizScores: Record<string, number> = {};
            if (state.q) {
              const scoreBytes = fromBase64(host, state.q, quizLessons.length);
              quizLessons.forEach((lesson, index) => {
                if (scoreBytes[index] !== 255) quizScores[lesson.id] = scoreBytes[index];
              });
            }
            const passedQuizIds = state.a
              ? decodeBits(host, state.a, quizLessons.length)
                  .map((index) => quizLessons[index]?.id)
                  .filter((id): id is string => Boolean(id))
              : visitedLessonIds.filter((id) => quizIndex.has(id));
            const availableDividers =
              state.m === 1
                ? dividers.filter(
                    (divider) => divider.lessonIndex === selectedIndex,
                  )
                : dividers;
            const availableFlipCards =
              state.m === 1
                ? flipCards.filter(
                    (card) => card.lessonIndex === selectedIndex,
                  )
                : flipCards;
            const availableInteractions =
              state.m === 1
                ? interactions.filter(
                    (interaction) => interaction.lessonIndex === selectedIndex,
                  )
                : interactions;
            const interactedFlipCardIds = state.f
              ? decodeBits(host, state.f, availableFlipCards.length)
                  .map((index) => availableFlipCards[index]?.id)
                  .filter((id): id is string => Boolean(id))
              : completed
                ? flipCardIds
                : [];
            const interactedContentIds = state.i !== undefined
              ? decodeBits(host, state.i, availableInteractions.length)
                  .map((index) => availableInteractions[index]?.id)
                  .filter((id): id is string => Boolean(id))
              : completed
                ? interactionIds
                : interactedFlipCardIds;
            return {
              visitedLessonIds,
              lessonScrollProgress,
              revealedDividerIds: decodeBits(
                host,
                state.r,
                availableDividers.length,
              )
                .map((index) => availableDividers[index]?.id)
                .filter((id): id is string => Boolean(id)),
              completedDividerIds: decodeBits(
                host,
                state.d ?? "",
                availableDividers.length,
              )
                .map((index) => availableDividers[index]?.id)
                .filter((id): id is string => Boolean(id)),
              selectedLessonId: lessonIds[selectedIndex] ?? null,
              ...(flipCards.length ? { interactedFlipCardIds } : {}),
              ...(state.i !== undefined ? { interactedContentIds } : {}),
              ...(quizLessons.length ? { quizScores, passedQuizIds } : {}),
            };
          }
          completed = false;
          safeSet(runtimeApi.completionField, runtimeApi.incompleteValue);
          safeSet(runtimeApi.locationField, "0");
          safeSet("cmi.suspend_data", "");
        } catch {
          // Ignore malformed or old-version suspend data and start fresh.
          completed = false;
          safeSet(runtimeApi.completionField, runtimeApi.incompleteValue);
          safeSet("cmi.suspend_data", "");
        }
      }

      if (completed) {
        const lessonScrollProgress = Object.fromEntries(
          lessonIds.map((id) => [id, 100]),
        );
        const dividerIds = dividers.map(({ id }) => id);
        return {
          visitedLessonIds: [...lessonIds],
          lessonScrollProgress,
          revealedDividerIds: dividerIds,
          completedDividerIds: dividerIds,
          selectedLessonId: lessonIds[0] ?? null,
          quizScores: {},
          passedQuizIds: quizLessons.map((lesson) => lesson.id),
          ...(flipCards.length ? { interactedFlipCardIds: flipCardIds } : {}),
          ...(interactions.length ? { interactedContentIds: interactionIds } : {}),
        };
      }
      const location = Number.parseInt(safeGet(runtimeApi.locationField), 10);
      return {
        ...emptyProgress(),
        selectedLessonId: Number.isInteger(location)
          ? (lessonIds[location] ?? null)
          : null,
      };
    },
    save(courseId, snapshot, isComplete) {
      if (courseId !== course.courseId || finished) return;
      completed = completed || isComplete;
      const selectedIndex = snapshot.selectedLessonId
        ? (lessonIndex.get(snapshot.selectedLessonId) ?? -1)
        : -1;
      safeSet(runtimeApi.locationField, String(Math.max(0, selectedIndex)));
      safeSet("cmi.suspend_data", pack(snapshot));
      const status = safeGet(runtimeApi.completionField);
      const assessmentScoreValues = quizLessons
        .map((lesson) => snapshot.quizScores?.[lesson.id])
        .filter((score): score is number => typeof score === "number");
      if (assessmentScoreValues.length) {
        const score = Math.round(assessmentScoreValues.reduce((sum, value) => sum + value, 0) / assessmentScoreValues.length);
        const scoreField = runtimeApi.completionField === "cmi.core.lesson_status" ? "cmi.core.score.raw" : "cmi.score.raw";
        safeSet(scoreField, String(score));
        if (runtimeApi.completionField === "cmi.core.lesson_status") {
          safeSet("cmi.core.score.min", "0");
          safeSet("cmi.core.score.max", "100");
        } else {
          safeSet("cmi.score.scaled", (score / 100).toFixed(4));
          safeSet("cmi.score.min", "0");
          safeSet("cmi.score.max", "100");
        }
      }
      if (completed) {
        if (runtimeApi.completionField === "cmi.core.lesson_status") {
          const passedAllQuizzes = quizLessons.every((lesson) => snapshot.passedQuizIds?.includes(lesson.id));
          safeSet(runtimeApi.completionField, quizLessons.length ? (passedAllQuizzes ? "passed" : "failed") : runtimeApi.completedValue);
        } else {
          safeSet(runtimeApi.completionField, runtimeApi.completedValue);
        }
        if (runtimeApi.completionField === "cmi.completion_status") {
          const passedAllQuizzes = quizLessons.every((lesson) => snapshot.passedQuizIds?.includes(lesson.id));
          safeSet("cmi.success_status", quizLessons.length ? (passedAllQuizzes ? "passed" : "failed") : "unknown");
          safeSet("cmi.progress_measure", "1.0");
        }
      } else if (status !== runtimeApi.completedValue && status !== "passed") {
        safeSet(runtimeApi.completionField, runtimeApi.incompleteValue);
        if (runtimeApi.completionField === "cmi.completion_status") {
          const visited = new Set(snapshot.visitedLessonIds);
          const progress = lessonIds.reduce((total, id) => {
            const lessonProgress = Math.max(
              snapshot.lessonScrollProgress[id] ?? (visited.has(id) ? 100 : 0),
              0,
            );
            return total + Math.min(100, lessonProgress);
          }, 0);
          safeSet(
            "cmi.progress_measure",
            (progress / lessons.length / 100).toFixed(4),
          );
        }
      }
      if (isComplete) {
        if (commitTimer !== null) host.clearTimeout(commitTimer);
        commitTimer = null;
        commit();
      } else {
        scheduleCommit();
      }
    },
  };
}
