"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type PublishFormat = "html" | "pdf" | "scorm12" | "scorm2004";

const formats: Array<{ id: PublishFormat; label: string; endpoint: string; extension: string }> = [
  { id: "html", label: "HTML", endpoint: "", extension: "html" },
  { id: "pdf", label: "PDF handout", endpoint: "/pdf", extension: "pdf" },
  { id: "scorm12", label: "SCORM 1.2", endpoint: "/scorm12", extension: "zip" },
  { id: "scorm2004", label: "SCORM 2004", endpoint: "/scorm2004", extension: "zip" },
];

function safeFilename(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
}

export function PublishMenu({
  courseId,
  title,
  disabled = false,
  disabledReason,
  className,
  openUpward = false,
  onPublished,
}: {
  courseId: string;
  title: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  openUpward?: boolean;
  onPublished?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState<PublishFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function publish(format: PublishFormat) {
    const selected = formats.find((item) => item.id === format)!;
    setPublishing(format);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/publish${selected.endpoint}`, { method: "POST" });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || `Could not create the ${selected.label} course.`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFilename(title)}.${selected.extension}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setOpen(false);
      onPublished?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not create the ${selected.label} course.`);
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || publishing !== null}
        title={disabled ? disabledReason : "Publish course"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setError(null); setOpen((current) => !current); }}
        className={className}
      >
        {publishing ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
        {publishing ? `Preparing ${formats.find((item) => item.id === publishing)?.label}…` : "Publish"}
        {!publishing && <ChevronDown size={14} />}
      </Button>
      {open && (
        <div role="menu" aria-label="Publish format" className={`absolute right-0 z-[70] w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ${openUpward ? "bottom-full mb-2" : "top-full mt-2"}`}>
          {formats.map((format) => (
            <Button
              key={format.id}
              type="button"
              variant="ghost"
              size="sm"
              role="menuitem"
              disabled={publishing !== null}
              onClick={() => void publish(format.id)}
              className="h-10 w-full justify-start rounded-lg px-3 text-left text-sm font-medium text-slate-700"
            >
              {format.label}
            </Button>
          ))}
          {error && <p role="alert" className="mx-2 my-1 border-t border-slate-100 pt-2 text-xs leading-5 text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
