"use client";

import { useEffect, useState } from "react";
import { AlignLeft, BarChart3, CheckCircle2, Code2, FilePlus2, Image as ImageIcon, Images, List, Minus, Quote, RotateCcw, Type, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blockCategories, blockTemplates, type BlockCategory, type BlockTemplate } from "./(block_template_picker_components)/block-template-data";
import { TemplatePreview } from "./(block_template_picker_components)/template-preview";

const categoryIcons = {
  Text: Type,
  Statement: AlignLeft,
  Quote,
  List,
  Image: ImageIcon,
  Gallery: Images,
  Multimedia: Video,
  Interactive: RotateCcw,
  "Knowledge check": CheckCircle2,
  Survey: CheckCircle2,
  Chart: BarChart3,
  Divider: Minus,
  Blank: FilePlus2,
  Code: Code2,
};

export function BlockTemplatePicker({
  open,
  onClose,
  onSelect,
  initialCategory = "Text",
  mode = "add",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (template: BlockTemplate) => void;
  initialCategory?: BlockCategory;
  mode?: "add" | "replace";
}) {
  const [category, setCategory] = useState<BlockCategory>(initialCategory);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const visibleTemplates = blockTemplates.filter(
    (template) => template.category === category,
  );

  return (
    <div
      className="dialog-backdrop-in fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-picker-title"
        className="dialog-panel-in flex h-[min(820px,calc(100dvh-24px))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:h-[min(820px,calc(100dvh-48px))]"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="block-picker-title"
              className="text-lg font-semibold text-slate-900"
            >
              {mode === "replace" ? "Change block template" : "Add a block"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {mode === "replace" ? "Preview a layout to replace this block." : "Choose a block and a ready-made layout."}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close block picker"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </header>
        <div className="grid min-h-0 flex-1 sm:grid-cols-[190px_minmax(0,1fr)]">
          <nav
            aria-label="Block categories"
            className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-3"
          >
            {blockCategories.map((item) => {
              const Icon = categoryIcons[item];
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors sm:w-full ${category === item ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <Icon size={16} />
                  {item}
                </button>
              );
            })}
          </nav>
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              {category} templates
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelect(template)}
                  className="group overflow-hidden rounded-xl border border-slate-200 text-left transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div className="m-2 grid min-h-36 place-items-center rounded-lg bg-slate-50 p-4">
                    <div className="w-full max-w-52">
                      <TemplatePreview template={template} />
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700">
                      {template.title}
                    </p>
                    <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">
                      {template.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
