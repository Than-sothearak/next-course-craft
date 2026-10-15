"use client";

import { Extension, Mark, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
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
import { normalizeFontSize, normalizeHexColor } from "@/lib/editor/text-format";
import { FontSizeControl } from "./(text_formatting_toolbar_components)/font-size-control";
import { TextColorControl } from "./(text_formatting_toolbar_components)/text-color-control";
import { ToolbarButton } from "./(text_formatting_toolbar_components)/toolbar-button";
import { setInlineStyle } from "./(text_formatting_toolbar_components)/text-formatting-commands";
import { StyledCodeBlock } from "./(text_formatting_toolbar_components)/styled-code-block";

function parseInlineColor(element: HTMLElement, property: "color" | "background-color") {
  const declaration = element.getAttribute("style")?.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"))?.[1];
  const browserValue = property === "color" ? element.style.color : element.style.backgroundColor;
  return normalizeHexColor(declaration ?? browserValue);
}

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
        parseHTML: (element) => parseInlineColor(element as HTMLElement, "color"),
      },
      highlight: {
        default: null,
        parseHTML: (element) => parseInlineColor(element as HTMLElement, "background-color"),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[style]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const style: string[] = [];
    const fontSize = normalizeFontSize(HTMLAttributes.fontSize);
    const color = normalizeHexColor(HTMLAttributes.color);
    const highlight = normalizeHexColor(HTMLAttributes.highlight);
    if (fontSize) style.push(`font-size: ${fontSize}`);
    if (color) style.push(`color: ${color}`);
    if (highlight) style.push(`background-color: ${highlight}`);
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
    }, {
      types: ["listItem"],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => normalizeFontSize((element as HTMLElement).style.fontSize),
          renderHTML: (attributes) => {
            const fontSize = normalizeFontSize(attributes.fontSize);
            return fontSize ? { style: `font-size: ${fontSize}` } : {};
          },
        },
      },
    }];
  },
});

const ListMarkerFormatting = Extension.create({
  name: "listMarkerFormatting",
  addGlobalAttributes() {
    return [{
      types: ["bulletList"],
      attributes: {
        listStyle: {
          default: "disc",
          parseHTML: (element: HTMLElement) => {
            const value = element.getAttribute("data-list-style");
            return ["disc", "circle", "square", "dash", "check"].includes(value ?? "") ? value : "disc";
          },
          renderHTML: (attributes) => ({
            "data-list-style": ["disc", "circle", "square", "dash", "check"].includes(String(attributes.listStyle)) ? attributes.listStyle : "disc",
          }),
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

const CourseOverviewTable = Node.create({
  name: "courseOverviewTable",
  group: "block",
  content: "courseOverviewRow+",
  isolating: true,
  parseHTML: () => [{ tag: "table" }],
  renderHTML: ({ HTMLAttributes }) => ["table", mergeAttributes(HTMLAttributes, {
    class: "w-full border-collapse text-left text-sm",
  }), 0],
});

const CourseOverviewRow = Node.create({
  name: "courseOverviewRow",
  content: "(courseOverviewHeader | courseOverviewCell)+",
  parseHTML: () => [{ tag: "tr" }],
  renderHTML: ({ HTMLAttributes }) => ["tr", HTMLAttributes, 0],
});

const CourseOverviewHeader = Node.create({
  name: "courseOverviewHeader",
  content: "block+",
  isolating: true,
  parseHTML: () => [{ tag: "th" }],
  renderHTML: ({ HTMLAttributes }) => ["th", mergeAttributes(HTMLAttributes, {
    scope: "col",
    class: "border border-slate-300 bg-slate-50 px-3 py-2 text-left font-semibold align-top",
  }), 0],
});

const CourseOverviewCell = Node.create({
  name: "courseOverviewCell",
  content: "block+",
  isolating: true,
  parseHTML: () => [{ tag: "td" }],
  renderHTML: ({ HTMLAttributes }) => ["td", mergeAttributes(HTMLAttributes, {
    class: "border border-slate-300 px-3 py-2 align-top",
  }), 0],
});

const sharedTextExtensions = [
  StarterKit.configure({ document: false, codeBlock: false, underline: false, heading: { levels: [1, 2, 3] } }),
  StyledCodeBlock,
  CourseOverviewTable,
  CourseOverviewRow,
  CourseOverviewHeader,
  CourseOverviewCell,
  Underline,
  InlineStyle,
  ParagraphFormatting,
  ListMarkerFormatting,
];

export const textEditorExtensions = [...sharedTextExtensions, SingleElementDocument, SingleElementEditing];
export const richTextEditorExtensions = [...sharedTextExtensions, Document];

const highlightColors = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#e9d5ff"];
export function TextFormattingToolbar({ editor, allowLists = true }: { editor: Editor | null; allowLists?: boolean }) {
  const editorFormatting = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) return { fontSize: null, color: null };
      const inlineStyle = currentEditor.getAttributes("inlineStyle");
      return { fontSize: inlineStyle.fontSize as string | null, color: inlineStyle.color as string | null };
    },
  });
  const selectedFontSize = normalizeFontSize(editorFormatting?.fontSize);
  const selectedColor = normalizeHexColor(editorFormatting?.color) ?? "#111827";

  if (!editor) return null;
  const activeBlock = editor.isActive("heading") ? "heading" : "paragraph";
  const activeLevel = editor.getAttributes("heading").level;
  const activeTextAlign = editor.getAttributes(activeBlock).textAlign ?? "left";
  const activeLineHeight = String(editor.getAttributes(activeBlock).lineHeight ?? "1.6");
  const indent = Number(editor.getAttributes(activeBlock).indent ?? 0);

  return <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Text formatting">
    <Select aria-label="Text style" value={editor.isActive("heading") ? String(activeLevel) : "paragraph"} onChange={(event) => {
      if (event.target.value === "paragraph") editor.chain().focus().setParagraph().run();
      else editor.chain().focus().setHeading({ level: Number(event.target.value) as 1 | 2 | 3 }).run();
    }} className="h-8 w-[6.5rem] rounded-md border-slate-200 px-2 text-xs shadow-none">
      <option value="paragraph">Paragraph</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option>
    </Select>
    <FontSizeControl editor={editor} selectedFontSize={selectedFontSize} />
    <span className="mx-1 h-6 w-px bg-slate-200" />
    <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></ToolbarButton>
    <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></ToolbarButton>
    <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></ToolbarButton>
    <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></ToolbarButton>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    <TextColorControl key={selectedColor} editor={editor} selectedColor={selectedColor} />
    <div className="flex items-center gap-0.5" role="group" aria-label="Highlight color">
      {highlightColors.map((color) => <button key={color} type="button" title={`Highlight ${color}`} aria-label={`Highlight ${color}`} onMouseDown={(event) => event.preventDefault()} onClick={() => setInlineStyle(editor, "highlight", color)} className="grid size-7 place-items-center rounded-md hover:bg-slate-100"><Highlighter size={15} style={{ color }} /></button>)}
    </div>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    {allowLists && <><ToolbarButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolbarButton>
    <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarButton></>}
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
    <Button type="button" variant="ghost" size="sm" aria-label="Reset format" title="Reset format" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().updateAttributes(activeBlock, { textAlign: null, lineHeight: null, indent: 0 }).run()} className="h-8 px-2 text-xs"><RemoveFormatting size={15} />Reset format</Button>
  </div>;
}
