"use client";

import { Extension, Mark, type Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const InlineStyle = Mark.create({
  name: "inlineStyle",
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.fontSize || null,
      },
      color: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.color || null,
      },
      highlight: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.backgroundColor || null,
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[style]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const style: string[] = [];
    if (typeof HTMLAttributes.fontSize === "string" && /^\d{1,2}px$/.test(HTMLAttributes.fontSize)) style.push(`font-size: ${HTMLAttributes.fontSize}`);
    if (typeof HTMLAttributes.color === "string" && /^#[\da-f]{6}$/i.test(HTMLAttributes.color)) style.push(`color: ${HTMLAttributes.color}`);
    if (typeof HTMLAttributes.highlight === "string" && /^#[\da-f]{6}$/i.test(HTMLAttributes.highlight)) style.push(`background-color: ${HTMLAttributes.highlight}`);
    return ["span", { style: style.join("; ") || null }, 0];
  },
});

const ParagraphFormatting = Extension.create({
  name: "paragraphFormatting",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: (element) => (element as HTMLElement).style.textAlign || null,
          renderHTML: (attributes) => ["left", "center", "right", "justify"].includes(attributes.textAlign) ? { style: `text-align: ${attributes.textAlign}` } : {},
        },
        lineHeight: {
          default: null,
          parseHTML: (element) => (element as HTMLElement).style.lineHeight || null,
          renderHTML: (attributes) => ["1", "1.2", "1.4", "1.6", "1.8", "2"].includes(String(attributes.lineHeight)) ? { style: `line-height: ${attributes.lineHeight}` } : {},
        },
        indent: {
          default: 0,
          parseHTML: (element) => Number.parseInt((element as HTMLElement).style.marginLeft, 10) || 0,
          renderHTML: (attributes) => Number.isFinite(Number(attributes.indent)) && Number(attributes.indent) > 0 && Number(attributes.indent) <= 240 ? { style: `margin-left: ${attributes.indent}px` } : {},
        },
      },
    }];
  },
});

const SingleElementDocument = Document.extend({ content: "block" });

const SingleElementEditing = Extension.create({
  name: "singleElementEditing",
  priority: 1100,
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.isActive("listItem")
        ? this.editor.commands.splitListItem("listItem")
        : this.editor.commands.setHardBreak(),
    };
  },
});

export const textEditorExtensions = [
  StarterKit.configure({ document: false, heading: { levels: [1, 2, 3] } }),
  SingleElementDocument,
  SingleElementEditing,
  Underline,
  InlineStyle,
  ParagraphFormatting,
];

const textColors = ["#111827", "#475569", "#2563eb", "#b91c1c", "#15803d"];
const highlightColors = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#e9d5ff"];

function ToolbarButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" variant={active ? "secondary" : "ghost"} size="icon" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="size-8 rounded-md">{children}</Button>;
}

export function TextFormattingToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const activeEditor = editor;
  const activeBlock = editor.isActive("heading") ? "heading" : "paragraph";
  const activeLevel = editor.getAttributes("heading").level;
  const activeTextAlign = editor.getAttributes(activeBlock).textAlign ?? "left";
  const activeLineHeight = String(editor.getAttributes(activeBlock).lineHeight ?? "1.6");
  const indent = Number(editor.getAttributes(activeBlock).indent ?? 0);

  function setInlineStyle(attribute: "fontSize" | "color" | "highlight", value: string | null) {
    activeEditor.chain().focus().setMark("inlineStyle", { [attribute]: value }).run();
  }

  return <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Text formatting">
    <Select aria-label="Text style" value={editor.isActive("heading") ? String(activeLevel) : "paragraph"} onChange={(event) => {
      if (event.target.value === "paragraph") editor.chain().focus().setParagraph().run();
      else editor.chain().focus().setHeading({ level: Number(event.target.value) as 1 | 2 | 3 }).run();
    }} className="h-8 w-[6.5rem] rounded-md border-slate-200 px-2 text-xs shadow-none">
      <option value="paragraph">Paragraph</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option>
    </Select>
    <Select aria-label="Font size" defaultValue="16px" onChange={(event) => setInlineStyle("fontSize", event.target.value)} className="h-8 w-[5.25rem] rounded-md border-slate-200 px-2 text-xs shadow-none">
      <option value="14px">14 px</option><option value="16px">16 px</option><option value="18px">18 px</option><option value="20px">20 px</option><option value="24px">24 px</option><option value="30px">30 px</option><option value="36px">36 px</option>
    </Select>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></ToolbarButton>
    <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></ToolbarButton>
    <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></ToolbarButton>
    <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></ToolbarButton>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    <div className="flex items-center gap-0.5" role="group" aria-label="Text color">
      {textColors.map((color) => <button key={color} type="button" title={`Text color ${color}`} aria-label={`Text color ${color}`} onMouseDown={(event) => event.preventDefault()} onClick={() => setInlineStyle("color", color)} className="grid size-7 place-items-center rounded-md hover:bg-slate-100"><span className="size-4 rounded-full border border-slate-200" style={{ backgroundColor: color }} /></button>)}
    </div>
    <div className="flex items-center gap-0.5" role="group" aria-label="Highlight color">
      {highlightColors.map((color) => <button key={color} type="button" title={`Highlight ${color}`} aria-label={`Highlight ${color}`} onMouseDown={(event) => event.preventDefault()} onClick={() => setInlineStyle("highlight", color)} className="grid size-7 place-items-center rounded-md hover:bg-slate-100"><Highlighter size={15} style={{ color }} /></button>)}
    </div>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    <ToolbarButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolbarButton>
    <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarButton>
    <ToolbarButton label="Decrease indent" onClick={() => editor.chain().focus().updateAttributes(activeBlock, { indent: Math.max(0, indent - 24) }).run()}><IndentDecrease size={16} /></ToolbarButton>
    <ToolbarButton label="Increase indent" onClick={() => editor.chain().focus().updateAttributes(activeBlock, { indent: Math.min(240, indent + 24) }).run()}><IndentIncrease size={16} /></ToolbarButton>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    {(["left", "center", "right"] as const).map((align) => {
      const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
      return <ToolbarButton key={align} label={`Align ${align}`} active={activeTextAlign === align} onClick={() => editor.chain().focus().updateAttributes(activeBlock, { textAlign: align }).run()}><Icon size={16} /></ToolbarButton>;
    })}
    <Select aria-label="Line spacing" value={activeLineHeight} onChange={(event) => editor.chain().focus().updateAttributes(activeBlock, { lineHeight: event.target.value }).run()} className="ml-1 h-8 w-[5.25rem] rounded-md border-slate-200 px-2 text-xs shadow-none">
      <option value="1.2">Tight</option><option value="1.4">Compact</option><option value="1.6">Normal</option><option value="1.8">Relaxed</option><option value="2">Double</option>
    </Select>
    <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></ToolbarButton>
    <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></ToolbarButton>
    <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().updateAttributes(activeBlock, { textAlign: null, lineHeight: null, indent: 0 }).run()}><RemoveFormatting size={16} /></ToolbarButton>
  </div>;
}
