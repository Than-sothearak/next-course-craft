export type RevisionedDraft = { id: string; revision: number };
export type DraftFailure = { id: string; message: string; conflict: boolean; validation: boolean };
export type DraftSnapshot<T> = { items: T[]; dirtyIds: string[]; saving: boolean; failure: DraftFailure | null; historyVersion: number };
type Entry<T> = { value: T; saved: string; past: T[]; future: T[]; group: string | null; editedAt: number };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function fingerprint<T extends RevisionedDraft>(value: T) {
  return canonical(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "revision")));
}

/** Serializes revisioned writes while preserving edits made during a request. */
export class SlideDraftStore<T extends RevisionedDraft> {
  private entries = new Map<string, Entry<T>>();
  private dirty = new Set<string>();
  private listeners = new Set<() => void>();
  private running: Promise<boolean> | null = null;
  private snapshot: DraftSnapshot<T>;
  constructor(items: T[], private readonly persist: (value: T) => Promise<T>) {
    for (const value of items) this.entries.set(value.id, this.entry(value));
    this.snapshot = { items: [...this.entries.values()].map((entry) => entry.value), dirtyIds: [], saving: false, failure: null, historyVersion: 0 };
  }
  private entry(value: T): Entry<T> { return { value: structuredClone(value), saved: fingerprint(value), past: [], future: [], group: null, editedAt: 0 }; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<DraftSnapshot<T>> = {}) {
    this.snapshot = {
      ...this.snapshot, ...patch,
      items: [...this.entries.values()].map((entry) => entry.value),
      dirtyIds: [...this.dirty],
      historyVersion: this.snapshot.historyVersion + 1,
    };
    for (const listener of this.listeners) listener();
  }
  private trackDirty(id: string) {
    const entry = this.entries.get(id);
    if (entry && fingerprint(entry.value) !== entry.saved) this.dirty.add(id);
    else this.dirty.delete(id);
  }
  private changed(id: string) {
    this.trackDirty(id);
    this.emit(this.snapshot.failure?.id === id && this.snapshot.failure.validation ? { failure: null } : {});
  }
  update(id: string, updater: (value: T) => T, group?: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    const next = updater(structuredClone(entry.value));
    if (fingerprint(next) === fingerprint(entry.value)) return;
    if (!group || entry.group !== group || Date.now() - entry.editedAt > 900) {
      entry.past.push(structuredClone(entry.value));
      if (entry.past.length > 50) entry.past.shift();
    }
    entry.value = { ...next, id, revision: entry.value.revision };
    entry.future = [];
    entry.group = group ?? null;
    entry.editedAt = Date.now();
    this.changed(id);
  }
  canUndo(id: string) { return Boolean(this.entries.get(id)?.past.length); }
  canRedo(id: string) { return Boolean(this.entries.get(id)?.future.length); }
  undo(id: string) {
    const entry = this.entries.get(id), previous = entry?.past.pop();
    if (!entry || !previous) return;
    entry.future.push(structuredClone(entry.value));
    entry.value = { ...previous, revision: entry.value.revision };
    entry.group = null;
    this.changed(id);
  }
  redo(id: string) {
    const entry = this.entries.get(id), next = entry?.future.pop();
    if (!entry || !next) return;
    entry.past.push(structuredClone(entry.value));
    entry.value = { ...next, revision: entry.value.revision };
    entry.group = null;
    this.changed(id);
  }
  /** Call after structural operations have saved pending content. */
  sync(items: T[]) {
    const current = this.entries;
    this.entries = new Map(items.map((value) => {
      const previous = current.get(value.id);
      return [value.id, previous ? { ...previous, value: structuredClone(value), saved: fingerprint(value), group: null } : this.entry(value)];
    }));
    this.dirty.clear();
    this.emit({ failure: null });
  }
  flush = (retry = false): Promise<boolean> => {
    if (this.running) return this.running;
    if (!this.snapshot.dirtyIds.length) return Promise.resolve(true);
    if (this.snapshot.failure && !retry) return Promise.resolve(false);
    this.emit({ saving: true, failure: null });
    this.running = this.drain().finally(() => {
      this.running = null;
      this.emit({ saving: false });
    });
    return this.running;
  };
  private async drain(): Promise<boolean> {
    while (this.snapshot.dirtyIds.length) {
      const id = this.snapshot.dirtyIds[0];
      const entry = this.entries.get(id)!;
      const sent = structuredClone(entry.value);
      try {
        const saved = await this.persist(sent);
        const latest = this.entries.get(id);
        if (!latest) continue;
        latest.saved = fingerprint(saved);
        latest.value = fingerprint(latest.value) === fingerprint(sent) ? saved : { ...latest.value, revision: saved.revision };
        this.trackDirty(id);
        this.emit();
      } catch (cause) {
        const status = cause && typeof cause === "object" && "status" in cause ? cause.status : null;
        this.emit({ failure: { id, message: cause instanceof Error ? cause.message : "Could not save changes.", conflict: status === 409, validation: status === 400 || status === 422 } });
        return false;
      }
    }
    return true;
  }
}
