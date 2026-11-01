import { Check, CircleAlert, CloudUpload, LoaderCircle } from "lucide-react";

export function EditorSaveStatus({ saveState, hasUnsavedChanges, validationMessage, saveMessage }: {
  saveState: "saved" | "saving" | "error" | "conflict";
  hasUnsavedChanges: boolean;
  validationMessage?: string;
  saveMessage?: string;
}) {
  const state = validationMessage ? "invalid" : saveState !== "saved" ? saveState : hasUnsavedChanges ? "pending" : "saved";
  const label = validationMessage ?? {
    saved: "All changes saved", saving: "Saving changes", pending: "Unsaved changes", error: "Save failed", conflict: "Save conflict", invalid: "Check the title",
  }[state];
  const Icon = state === "saving" ? LoaderCircle : state === "saved" ? Check : state === "pending" ? CloudUpload : CircleAlert;
  const color = state === "saved" ? "text-emerald-600" : state === "saving" ? "text-indigo-600" : state === "pending" ? "text-amber-600" : "text-rose-600";
  const detail = (state === "error" || state === "conflict") && saveMessage ? `${label}: ${saveMessage}` : label;
  return <span data-editor-save-status={state} role="status" aria-label="Course save status" aria-live="polite" aria-atomic="true" aria-busy={state === "saving"} title={detail} className={`grid size-8 shrink-0 place-items-center rounded-md ${color}`}>
    <Icon size={17} strokeWidth={1.75} aria-hidden="true" className={state === "saving" ? "animate-spin motion-reduce:animate-none" : undefined} />
    <span className="sr-only">{label}</span>
  </span>;
}
