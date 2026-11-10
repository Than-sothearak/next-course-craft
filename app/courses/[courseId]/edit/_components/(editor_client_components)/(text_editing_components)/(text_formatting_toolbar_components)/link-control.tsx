"use client";

import { useContext, useId, useRef, useState, type FormEvent } from "react";
import type { Editor } from "@tiptap/core";
import { Link2, Unlink2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeLinkHref } from "@/lib/editor/link-utils";
import { Popover } from "@/components/ui/popover";
import { TextFormattingPopupContext } from "../text-formatting-popup-context";

type SavedSelection = { from: number; to: number; hadLink: boolean };

export function LinkControl({ editor, active }: { editor: Editor; active: boolean }) {
  const inputId = `text-link-url-${useId().replaceAll(":", "")}`;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [canRemoveLink, setCanRemoveLink] = useState(false);
  const selectionRef = useRef<SavedSelection | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const ownerId = useContext(TextFormattingPopupContext);
  const [anchorElement, setAnchorElement] = useState<Element | null>(null);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) return;
    const { from, to } = editor.state.selection;
    const hadLink = editor.isActive("link");
    selectionRef.current = { from, to, hadLink };
    setCanRemoveLink(hadLink);
    setUrl(String(editor.getAttributes("link").href ?? ""));
    setError("");
    setAnchorElement(rootRef.current?.closest("[data-text-selection-popup]") ?? null);
  }

  function restoreSelection() {
    const saved = selectionRef.current;
    const chain = editor.chain().focus();
    if (saved) {
      chain.setTextSelection({ from: saved.from, to: saved.to });
      if (saved.from === saved.to && saved.hadLink) chain.extendMarkRange("link");
    }
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

  const portalTarget = editor.view.dom.closest("dialog[open]") ?? document.fullscreenElement ?? document.body;
  return (
    <div ref={rootRef}>
      <Popover open={open} onOpenChange={changeOpen} title="Link"
        triggerLabel={active ? "Edit link" : "Add link to selected text"} triggerActive={active} trigger={<Link2 size={16} />}
        portalTarget={portalTarget} ownerId={ownerId} layer={110} placement="side" anchorElement={anchorElement} initialFocusSelector="input">
        <form
          onSubmit={applyLink}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <label className="block text-xs font-medium text-slate-600" htmlFor={inputId}>
            Link URL
          </label>
          <Input
            id={inputId}
            type="text"
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
              onClick={() => setOpen(false)}
              className="cursor-pointer h-8 px-2"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Popover>
    </div>
  );
}
