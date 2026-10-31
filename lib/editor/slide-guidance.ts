export function guidanceWasSeen(key: string) {
  try { return window.localStorage.getItem(key) === "seen"; } catch { return false; }
}

export function rememberGuidance(key: string) {
  try { window.localStorage.setItem(key, "seen"); } catch { /* Guidance also works without browser storage. */ }
}

export function guidanceStorageKey(courseId: string, kind: string, standalone: boolean) {
  return `coursecraft-guidance-v1-${standalone ? "learner" : "preview"}-${courseId}-${kind}`;
}
