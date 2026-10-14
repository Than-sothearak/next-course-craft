import type {
  LearnerProgressAdapter,
  LearnerProgressSnapshot,
} from "../../lib/player/progress";

type Scorm12Api = {
  LMSInitialize(parameter: ""): string;
  LMSFinish(parameter: ""): string;
  LMSGetValue(element: string): string;
  LMSSetValue(element: string, value: string): string;
  LMSCommit(parameter: ""): string;
};

type ScormRuntimeCourse = {
  courseId: string;
  revision?: number;
  sections: Array<{ id: string; order: number }>;
  lessons: Array<{
    id: string;
    sectionId: string;
    order: number;
    blocks: Array<{ id: string; type: string }>;
  }>;
};

type PackedState = {
  k: string;
  v: string;
  p?: string;
  r: string;
  d?: string;
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

export function findScorm12Api(host: Window): Scorm12Api | null {
  let current: Window | null = host;
  for (let depth = 0; current && depth < 500; depth += 1) {
    const api = getApi(current);
    if (api) return api;

    let parent: Window;
    try {
      parent = current.parent;
    } catch {
      break;
    }
    if (parent === current) break;
    current = parent;
  }

  try {
    const opener = host.opener;
    return opener ? getApi(opener) : null;
  } catch {
    return null;
  }
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
    for (let index = 0; index < Math.min(binary.length, bytes.length); index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
  } catch {
    return new Uint8Array(expectedLength);
  }
  return bytes;
}

function encodeBits(host: Window, count: number, selected: ReadonlySet<number>) {
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
  };
}

export function createScormProgressAdapter(
  course: ScormRuntimeCourse,
  host: Window = window,
): LearnerProgressAdapter | null {
  const api = findScorm12Api(host);
  if (!api) return null;
  const runtimeApi = api;

  try {
    if (api.LMSInitialize("") !== "true") return null;
  } catch {
    return null;
  }

  const lessons = orderedLessons(course);
  const lessonIds = lessons.map((lesson) => lesson.id);
  const lessonIndex = new Map(lessonIds.map((id, index) => [id, index]));
  const dividers = lessons.flatMap((lesson, index) =>
    lesson.blocks
      .filter((block) => block.type === "divider")
      .map((block) => ({ id: block.id, lessonIndex: index })),
  );
  const dividerIndex = new Map(dividers.map((divider, index) => [divider.id, index]));
  const versionKey = `${course.courseId}:${course.revision ?? 0}`;
  const startedAt = Date.now();
  let completed = ["completed", "passed"].includes(
    safeGet("cmi.core.lesson_status"),
  );
  let finished = false;
  let commitTimer: number | null = null;

  function safeGet(element: string) {
    try {
      return runtimeApi.LMSGetValue(element) || "";
    } catch {
      return "";
    }
  }

  function safeSet(element: string, value: string) {
    try {
      return runtimeApi.LMSSetValue(element, value) === "true";
    } catch {
      return false;
    }
  }

  function commit() {
    try {
      runtimeApi.LMSCommit("");
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
        Math.min(100, Math.round(snapshot.lessonScrollProgress[lesson.id] ?? 0)),
      );
    });

    const fullState: PackedState = {
      k: versionKey,
      v: encodeBits(host, lessons.length, visitedIndexes),
      p: toBase64(host, progressBytes),
      r: encodeBits(host, dividers.length, revealedIndexes),
      d: encodeBits(host, dividers.length, completedIndexes),
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
    const compactState: PackedState = {
      ...fullState,
      r: encodeBits(host, currentDividers.length, currentRevealed),
      d: encodeBits(host, currentDividers.length, currentCompleted),
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
    const hours = Math.floor(elapsedSeconds / 3600).toString().padStart(4, "0");
    const minutes = Math.floor((elapsedSeconds % 3600) / 60).toString().padStart(2, "0");
    const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
    safeSet("cmi.core.session_time", `${hours}:${minutes}:${seconds}.00`);
    safeSet("cmi.core.exit", completed ? "" : "suspend");
    commit();
    try {
      runtimeApi.LMSFinish("");
    } catch {
      // The SCO is already leaving; do not interrupt the browser navigation.
    }
  }

  if (!safeGet("cmi.core.lesson_status")) {
    safeSet("cmi.core.lesson_status", "incomplete");
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
            const availableDividers = state.m === 1
              ? dividers.filter((divider) => divider.lessonIndex === selectedIndex)
              : dividers;
            return {
              visitedLessonIds,
              lessonScrollProgress,
              revealedDividerIds: decodeBits(host, state.r, availableDividers.length)
                .map((index) => availableDividers[index]?.id)
                .filter((id): id is string => Boolean(id)),
              completedDividerIds: decodeBits(host, state.d ?? "", availableDividers.length)
                .map((index) => availableDividers[index]?.id)
                .filter((id): id is string => Boolean(id)),
              selectedLessonId: lessonIds[selectedIndex] ?? null,
            };
          }
          completed = false;
          safeSet("cmi.core.lesson_status", "incomplete");
          safeSet("cmi.core.lesson_location", "0");
          safeSet("cmi.suspend_data", "");
        } catch {
          // Ignore malformed or old-version suspend data and start fresh.
          completed = false;
          safeSet("cmi.core.lesson_status", "incomplete");
          safeSet("cmi.suspend_data", "");
        }
      }

      if (completed) {
        const lessonScrollProgress = Object.fromEntries(lessonIds.map((id) => [id, 100]));
        const dividerIds = dividers.map(({ id }) => id);
        return {
          visitedLessonIds: [...lessonIds],
          lessonScrollProgress,
          revealedDividerIds: dividerIds,
          completedDividerIds: dividerIds,
          selectedLessonId: lessonIds[0] ?? null,
        };
      }
      const location = Number.parseInt(safeGet("cmi.core.lesson_location"), 10);
      return {
        ...emptyProgress(),
        selectedLessonId: Number.isInteger(location) ? lessonIds[location] ?? null : null,
      };
    },
    save(courseId, snapshot, isComplete) {
      if (courseId !== course.courseId || finished) return;
      completed = completed || isComplete;
      const selectedIndex = snapshot.selectedLessonId
        ? (lessonIndex.get(snapshot.selectedLessonId) ?? -1)
        : -1;
      safeSet("cmi.core.lesson_location", String(Math.max(0, selectedIndex)));
      safeSet("cmi.suspend_data", pack(snapshot));
      const status = safeGet("cmi.core.lesson_status");
      if (completed) {
        if (status !== "passed") safeSet("cmi.core.lesson_status", "completed");
      } else if (status !== "completed" && status !== "passed") {
        safeSet("cmi.core.lesson_status", "incomplete");
      }
      scheduleCommit();
    },
  };
}
