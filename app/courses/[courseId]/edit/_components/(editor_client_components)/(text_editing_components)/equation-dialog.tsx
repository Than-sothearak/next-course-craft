"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { NodeSelection, type SelectionBookmark } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { equationDialogEvent } from "@/lib/editor/text-equation-extension";
import { equationTemplates, previewEquation } from "@/lib/editor/text-equation";

type Draft = { source: string; display: boolean; pos?: number; bookmark: SelectionBookmark; doc: ProseMirrorNode };

export function EquationDialog({ editor }: { editor: Editor | null }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveError, setSaveError] = useState("");
  const id = useId();
  const preview = useMemo(() => draft ? previewEquation(draft.source, draft.display) : { html: "", error: "" }, [draft]);
  // Titles/headings are single text blocks. A display equation belongs in a body
  // text object, where splitting the paragraph is supported.
  const allowDisplay = editor?.schema.topNodeType.spec.content !== "block";

  useEffect(() => {
    if (!editor) return;
    const open = (event: Event) => {
      if (!editor.isEditable || editor.isDestroyed) return;
      const requested = (event as CustomEvent<{ pos?: number }>).detail?.pos;
      const selection = editor.state.selection;
      const pos = requested ?? (selection instanceof NodeSelection && ["inlineMath", "blockMath"].includes(selection.node.type.name) ? selection.from : undefined);
      const node = pos === undefined ? undefined : editor.state.doc.nodeAt(pos);
      if (pos !== undefined && !["inlineMath", "blockMath"].includes(node?.type.name ?? "")) return;
      setSaveError("");
      setDraft({ source: node ? String(node.attrs.latex ?? "") : "", display: node?.type.name === "blockMath", pos, bookmark: selection.getBookmark(), doc: editor.state.doc });
    };
    editor.view.dom.addEventListener(equationDialogEvent, open);
    return () => editor.view.dom.removeEventListener(equationDialogEvent, open);
  }, [editor]);

  if (!editor || !draft) return null;
  const close = () => {
    setDraft(null);
    if (!editor.isDestroyed) editor.commands.focus();
  };
  const save = () => {
    if (preview.error || editor.isDestroyed || !editor.isEditable) return;
    if (!editor.state.doc.eq(draft.doc)) {
      setSaveError("The text changed. Close this dialog and select the equation again.");
      return;
    }
    const latex = draft.source.trim();
    const chain = editor.chain().focus().command(({ tr }) => { closeHistory(tr); return true; });
    let success = false;
    if (draft.pos !== undefined) {
      const node = editor.state.doc.nodeAt(draft.pos);
      if (node?.type.name === (draft.display ? "blockMath" : "inlineMath")) {
        success = draft.display
          ? chain.updateBlockMath({ pos: draft.pos, latex }).run()
          : chain.updateInlineMath({ pos: draft.pos, latex }).run();
      }
    } else {
      const selection = draft.bookmark.resolve(editor.state.doc);
      // insertContent replaces a text selection; the extension's inline insert
      // command inserts at its start without removing the selected text.
      success = chain.command(({ tr }) => { tr.setSelection(selection); return true; })
        .insertContent({ type: draft.display ? "blockMath" : "inlineMath", attrs: { latex } }).run();
    }
    if (success) close();
    else setSaveError("The text changed. Close this dialog and select the equation again.");
  };

  return createPortal(<Dialog open title={draft.pos === undefined ? "Insert equation" : "Edit equation"} onClose={close} footer={<>
    <Button variant="outline" onClick={close}>Cancel</Button>
    <Button onClick={save} disabled={Boolean(preview.error)}>{draft.pos === undefined ? "Insert equation" : "Save equation"}</Button>
  </>}>
    <div className="space-y-4">
      <label className="block text-sm font-medium" htmlFor={`${id}-mode`}>Placement</label>
      <Select id={`${id}-mode`} value={draft.display ? "display" : "inline"} disabled={draft.pos !== undefined} onChange={(event) => setDraft({ ...draft, display: event.target.value === "display" })}>
        <option value="inline">Inline — inside a sentence</option>
        <option value="display" disabled={!allowDisplay}>Display — on its own line</option>
      </Select>
      {!allowDisplay && <p className="text-xs text-slate-500">Use a body text object for a display equation.</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Equation templates">
        {equationTemplates.map((template) => <Button key={template.label} size="sm" variant="outline" onClick={() => setDraft({ ...draft, source: template.source })}>{template.label}</Button>)}
      </div>
      <label className="block text-sm font-medium" htmlFor={`${id}-source`}>LaTeX</label>
      <Textarea id={`${id}-source`} autoFocus value={draft.source} maxLength={5000} spellCheck={false} placeholder="e.g. \\frac{a}{b}" className="font-mono" aria-invalid={Boolean(preview.error && draft.source)} aria-describedby={`${id}-feedback`} onChange={(event) => setDraft({ ...draft, source: event.target.value })} />
      <p className="text-xs text-slate-500">Use mathematical LaTeX. Full documents and custom packages are not supported.</p>
      <div className="min-w-0 rounded-lg border border-slate-200 p-4">
        <p className="mb-3 text-xs font-medium text-slate-500">Preview</p>
        {preview.html && <div data-equation-preview className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: preview.html }} />}
        <p id={`${id}-feedback`} role={preview.error && draft.source ? "alert" : undefined} className="mt-2 break-words text-sm text-slate-600">{preview.error || "Ready to insert."}</p>
      </div>
      {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
    </div>
  </Dialog>, document.fullscreenElement ?? document.body);
}
