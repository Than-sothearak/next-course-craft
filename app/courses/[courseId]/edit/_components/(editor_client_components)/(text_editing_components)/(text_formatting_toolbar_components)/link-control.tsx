"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Editor } from "@tiptap/core";
import { Link2, Unlink2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeLinkHref } from "@/lib/editor/link-utils";
import { ToolbarButton } from "./toolbar-button";

type SavedSelection = { from: number; to: number; hadLink: boolean };

export function LinkControl({ editor, active }: { editor: Editor; active: boolean }) {
  const inputId = `text-link-url-${useId().replaceAll(":", "")}`;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [canRemoveLink, setCanRemoveLink] = useState(false);
  const selectionRef = useRef<SavedSelection | null>(null);

  function openEditor() {
    const { from, to } = editor.state.selection;
    const hadLink = editor.isActive("link");
    selectionRef.current = { from, to, hadLink };
    setCanRemoveLink(hadLink);
    setUrl(String(editor.getAttributes("link").href ?? ""));
    setError("");
    setOpen((current) => !current);
  }

  function restoreSelection() {
    const saved = selectionRef.current;
    const chain = editor.chain().focus();
    if (saved && saved.from !== saved.to) chain.setTextSelection({ from: saved.from, to: saved.to });
    else if (saved?.hadLink) chain.extendMarkRange("link");
    return chain;
  }

  function applyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const href = normalizeLinkHref(url);
    if (!href) {
      setError("Enter a valid web, email, phone, or relative link.");
      return;
    }

    const saved = selectionRef.current;
    if (!saved || (saved.from === saved.to && !saved.hadLink)) {
      setError("Select text in the editor before adding a link.");
      return;
    }

    restoreSelection().setLink({ href }).run();
    setOpen(false);
  }

  function removeLink() {
    const saved = selectionRef.current;
    if (!saved) return;
    restoreSelection().unsetLink().run();
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape") return;
    setOpen(false);
    editor.chain().focus().run();
  }

  return (
    <div className="relative">
      <ToolbarButton
        label={active ? "Edit link" : "Add link to selected text"}
        active={active}
        onClick={openEditor}
      >
        <Link2 size={16} />
      </ToolbarButton>
      {open && (
        <form
          onSubmit={applyLink}
          onKeyDown={handleKeyDown}
          className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl"
        >
          <label className="block text-xs font-medium text-slate-600" htmlFor={inputId}>
            Link URL
          </label>
          <Input
            id={inputId}
            type="text"
            autoFocus
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError("");
            }}
            placeholder="https://example.com"
            className="mt-1 h-9"
          />
          {error && <p role="alert" className="mt-1.5 text-xs text-rose-600">{error}</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="cursor-pointer h-8">Apply link</Button>
              {canRemoveLink && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={removeLink}
                  className="cursor-pointer h-8 px-2"
                  aria-label="Remove link"
                  title="Remove link"
                >
                  <Unlink2 size={15} />
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOpen(false);
                editor.chain().focus().run();
              }}
              className="cursor-pointer h-8 px-2"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
