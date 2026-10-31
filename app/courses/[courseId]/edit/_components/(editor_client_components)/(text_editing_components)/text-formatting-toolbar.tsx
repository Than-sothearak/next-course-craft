"use client";

import { Extension, Mark, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  AlignCenter,
  AlignJustify,
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
import { LinkControl } from "./(text_formatting_toolbar_components)/link-control";
import { setInlineStyle } from "./(text_formatting_toolbar_components)/text-formatting-commands";
import { StyledCodeBlock } from "./(text_formatting_toolbar_components)/styled-code-block";
import { parseGradient } from "@/lib/color";

function normalizeTextPaint(value: string | null | undefined) {
  return parseGradient(value) ? value : normalizeHexColor(value);
}

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
        parseHTML: (element) => normalizeTextPaint(element.getAttribute("data-text-gradient")) ?? parseInlineColor(element as HTMLElement, "color"),
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
    const color = normalizeTextPaint(HTMLAttributes.color);
    const highlight = normalizeHexColor(HTMLAttributes.highlight);
    if (fontSize) style.push(`font-size: ${fontSize}`);
    if (color) {
      if (parseGradient(color)) style.push(`color: transparent`, `background-image: ${color}`, "background-clip: text", "-webkit-background-clip: text");
      else style.push(`color: ${color}`);
    }
    if (highlight) style.push(`background-color: ${highlight}`);
    return ["span", { style: style.join("; ") || null, ...(parseGradient(color) ? { "data-text-gradient": color } : {}) }, 0];
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
          default: null,
          parseHTML: (element: HTMLElement) => {
            const value = element.getAttribute("data-list-style");
            return ["disc", "circle", "square", "dash", "check"].includes(value ?? "") ? value : null;
          },
          renderHTML: (attributes) => ["disc", "circle", "square", "dash", "check"].includes(String(attributes.listStyle))
            ? { "data-list-style": attributes.listStyle }
            : {},
        },
      },
    }, {
      types: ["orderedList"],
      attributes: {
        listStyle: {
          default: null,
          parseHTML: (element: HTMLElement) => {
            const value = element.getAttribute("data-list-style");
            const validValue = ["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"];
            if (validValue.includes(value ?? "")) return value;
            const legacyType = element.getAttribute("type");
            return legacyType === "a" ? "lower-alpha"
              : legacyType === "A" ? "upper-alpha"
                : legacyType === "i" ? "lower-roman"
                  : legacyType === "I" ? "upper-roman"
                    : null;
          },
          renderHTML: (attributes) => ["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"].includes(String(attributes.listStyle))
            ? { "data-list-style": attributes.listStyle }
            : {},
        },
      },
    }];
  },
});

const ListSpacingFormatting = Extension.create({
  name: "listSpacingFormatting",
  addGlobalAttributes() {
    return [{
      types: ["bulletList", "orderedList"],
      attributes: {
        itemSpacing: {
          default: "comfortable",
          parseHTML: (element: HTMLElement) => {
            const value = element.getAttribute("data-item-spacing");
            return ["compact", "comfortable", "spacious"].includes(value ?? "")
              ? value
              : "comfortable";
          },
          renderHTML: (attributes) => ({
            "data-item-spacing": ["compact", "comfortable", "spacious"].includes(String(attributes.itemSpacing))
              ? attributes.itemSpacing
              : "comfortable",
            role: "list",
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
  StarterKit.configure({
    document: false,
    codeBlock: false,
    underline: false,
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" } },
  }),
  StyledCodeBlock,
  CourseOverviewTable,
  CourseOverviewRow,
  CourseOverviewHeader,
  CourseOverviewCell,
  Underline,
  InlineStyle,
  ParagraphFormatting,
  ListMarkerFormatting,
  ListSpacingFormatting,
];

function getListContext(editor: Editor) {
  const { $from } = editor.state.selection;
  let activeListType: "bulletList" | "orderedList" | null = null;
  let listDepth = 0;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const typeName = $from.node(depth).type.name;
    if (typeName === "bulletList" || typeName === "orderedList") {
      activeListType ??= typeName;
      listDepth += 1;
    }
  }
  return { activeListType, listDepth };
}

export const textEditorExtensions = [...sharedTextExtensions, SingleElementDocument, SingleElementEditing];
export const richTextEditorExtensions = [...sharedTextExtensions, Document];

const highlightColors = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#e9d5ff"];
export function TextFormattingToolbar({ editor, allowLists = true, textAlign, onTextAlignChange }: {
  editor: Editor | null;
  allowLists?: boolean;
  textAlign?: "left" | "center" | "right" | "justify";
  onTextAlignChange?: (align: "left" | "center" | "right" | "justify") => void;
}) {
  const editorFormatting = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) return { fontSize: null, color: null, activeListType: null, listDepth: 0, itemSpacing: "comfortable", listStyle: null };
      const inlineStyle = currentEditor.getAttributes("inlineStyle");
      const { activeListType, listDepth } = getListContext(currentEditor);
      return {
        fontSize: inlineStyle.fontSize as string | null,
        color: inlineStyle.color as string | null,
        activeListType,
        listDepth,
        itemSpacing: activeListType
          ? String(currentEditor.getAttributes(activeListType).itemSpacing ?? "comfortable")
          : "comfortable",
        listStyle: activeListType
          ? currentEditor.getAttributes(activeListType).listStyle as string | null
          : null,
      };
    },
  });
  const selectedFontSize = normalizeFontSize(editorFormatting?.fontSize);
  const selectedColor = normalizeTextPaint(editorFormatting?.color) ?? "#111827";

  if (!editor) return null;
  const activeBlock = editor.isActive("heading") ? "heading" : "paragraph";
  const activeLevel = editor.getAttributes("heading").level;
  const activeTextAlign = textAlign ?? editor.getAttributes(activeBlock).textAlign ?? "left";
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
    <LinkControl editor={editor} active={editor.isActive("link")} />
    <div className="flex items-center gap-0.5" role="group" aria-label="Highlight color">
      {highlightColors.map((color) => <button key={color} type="button" title={`Highlight ${color}`} aria-label={`Highlight ${color}`} onMouseDown={(event) => event.preventDefault()} onClick={() => setInlineStyle(editor, "highlight", color)} className="cursor-pointer grid size-7 place-items-center rounded-md hover:bg-slate-100"><Highlighter size={15} style={{ color }} /></button>)}
    </div>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    {allowLists && <><ToolbarButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolbarButton>
    <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarButton></>}
    {editorFormatting?.activeListType && <Select
      aria-label="List item spacing"
      value={editorFormatting.itemSpacing}
      onChange={(event) => editor.chain().focus().updateAttributes(editorFormatting.activeListType!, { itemSpacing: event.target.value }).run()}
      className="ml-1 h-8 w-[8rem] rounded-md border-slate-200 px-2 text-xs shadow-none"
    >
      <option value="compact">Compact</option>
      <option value="comfortable">Comfortable</option>
      <option value="spacious">Spacious</option>
    </Select>}
    {editorFormatting?.activeListType && editorFormatting.listDepth > 1 && <Select
      aria-label="Sublist style"
      value={String(editorFormatting.listStyle ?? "default")}
      onChange={(event) => editor.chain().focus().updateAttributes(editorFormatting.activeListType!, { listStyle: event.target.value === "default" ? null : event.target.value }).run()}
      className="ml-1 h-8 w-[8.5rem] rounded-md border-slate-200 px-2 text-xs shadow-none"
    >
      <option value="default">Default style</option>
      {editorFormatting.activeListType === "bulletList"
        ? <><option value="disc">Solid bullets</option><option value="circle">Open circles</option><option value="square">Squares</option><option value="dash">Dashes</option><option value="check">Checks</option></>
        : <><option value="decimal">Numbers</option><option value="lower-alpha">Lowercase letters</option><option value="upper-alpha">Uppercase letters</option><option value="lower-roman">Lowercase Roman</option><option value="upper-roman">Uppercase Roman</option></>}
    </Select>}
    <ToolbarButton label={editor.isActive("listItem") ? "Decrease list nesting" : "Decrease indent"} onClick={() => {
      const chain = editor.chain().focus();
      if (editor.isActive("listItem")) chain.liftListItem("listItem").run();
      else chain.updateAttributes(activeBlock, { indent: Math.max(0, indent - 24) }).run();
    }}><IndentDecrease size={16} /></ToolbarButton>
    <ToolbarButton label={editor.isActive("listItem") ? "Increase list nesting" : "Increase indent"} onClick={() => {
      const chain = editor.chain().focus();
      if (editor.isActive("listItem")) chain.sinkListItem("listItem").run();
      else chain.updateAttributes(activeBlock, { indent: Math.min(240, indent + 24) }).run();
    }}><IndentIncrease size={16} /></ToolbarButton>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    {(["left", "center", "right", "justify"] as const).map((align) => {
      const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : align === "right" ? AlignRight : AlignJustify;
      return <ToolbarButton key={align} label={`Align ${align}`} active={activeTextAlign === align} onClick={() => {
        if (onTextAlignChange) onTextAlignChange(align);
        else editor.chain().focus().updateAttributes(activeBlock, { textAlign: align }).run();
      }}><Icon size={16} /></ToolbarButton>;
    })}
    <Select aria-label="Line spacing" value={activeLineHeight} onChange={(event) => editor.chain().focus().updateAttributes(activeBlock, { lineHeight: event.target.value }).run()} className="ml-1 h-8 w-[5.25rem] rounded-md border-slate-200 px-2 text-xs shadow-none">
      <option value="1.2">Tight</option><option value="1.4">Compact</option><option value="1.6">Normal</option><option value="1.8">Relaxed</option><option value="2">Double</option>
    </Select>
    <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></ToolbarButton>
    <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></ToolbarButton>
    <Button type="button" variant="ghost" size="sm" aria-label="Reset format" title="Reset format" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().updateAttributes(activeBlock, { textAlign: null, lineHeight: null, indent: 0 }).run()} className="h-8 px-2 text-xs"><RemoveFormatting size={15} />Reset format</Button>
  </div>;
}
