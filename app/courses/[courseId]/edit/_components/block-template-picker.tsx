"use client";

import { useEffect, useState } from "react";
import {
  AlignLeft,
  BarChart3,
  CheckCircle2,
  Code2,
  FilePlus2,
  Image as ImageIcon,
  Images,
  List,
  Minus,
  MousePointerClick,
  Quote,
  Type,
  Video,
  X,
} from "lucide-react";
import { defaultBlockPadding, defaultBlockWidth, type ContentBlock, type DividerCompletionType, type StatementStyle } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { InputBlockPreview } from "./input-block-preview";
import { StatementBlockPreview } from "./statement-block-preview";

export const blockCategories = [
  "Text",
  "Statement",
  "Quote",
  "List",
  "Image",
  "Gallery",
  "Multimedia",
  "Interactive",
  "Knowledge check",
  "Survey",
  "Chart",
  "Divider",
  "Blank",
  "Code",
] as const;
export type BlockCategory = (typeof blockCategories)[number];

export type BlockTemplate = {
  id: string;
  category: BlockCategory;
  title: string;
  description: string;
  type: "richText" | "image" | "gallery" | "video" | "divider" | "statement";
  html?: string;
  dividerStyle?: "line" | "space" | "continue";
  dividerLabel?: string;
  dividerCompletionType?: DividerCompletionType;
  statement?: { style: StatementStyle; title: string; body: string };
  preview: string;
};

export const blockTemplates: BlockTemplate[] = [
  {
    id: "text-title-paragraph",
    category: "Text",
    title: "Title and paragraph",
    description: "A 36px heading followed by supporting text.",
    type: "richText",
    html: '<p><strong><span style="font-size: 36px">Section heading</span></strong><br><span style="font-size: 12px">Write your paragraph here.</span></p>',
    preview: "title",
  },
  {
    id: "text-paragraph",
    category: "Text",
    title: "Text only",
    description: "A clean paragraph for your lesson content.",
    type: "richText",
    html: "<p>Write your text here.</p>",
    preview: "text",
  },
  {
    id: "statement-callout",
    category: "Statement",
    title: "Key statement",
    description: "Draw attention to one important idea.",
    type: "statement",
    statement: { style: "key", title: "Key statement", body: "Practice helps turn a new idea into a lasting skill." },
    preview: "statement-key",
  },
  {
    id: "statement-tip",
    category: "Statement",
    title: "Helpful tip",
    description: "Highlight a practical suggestion learners can use.",
    type: "statement",
    statement: { style: "tip", title: "Helpful tip", body: "Try the new technique in a low-risk situation first." },
    preview: "statement-tip",
  },
  {
    id: "statement-important-note",
    category: "Statement",
    title: "Important note",
    description: "Call attention to information learners should remember.",
    type: "statement",
    statement: { style: "warning", title: "Important note", body: "Save your work before leaving this lesson." },
    preview: "statement-warning",
  },
  {
    id: "statement-centered",
    category: "Statement",
    title: "Big statement",
    description: "Emphasize one concise idea with a centered layout.",
    type: "statement",
    statement: { style: "centered", title: "Small steps add up.", body: "Consistent practice makes progress visible." },
    preview: "statement-centered",
  },
  {
    id: "quote-attribution",
    category: "Quote",
    title: "Quote with attribution",
    description: "Feature a quote and its source.",
    type: "richText",
    html: "<blockquote><p><em>“Add a meaningful quote here.”</em></p><p>— Attribution</p></blockquote>",
    preview: "quote",
  },
  {
    id: "quote-pull",
    category: "Quote",
    title: "Pull quote",
    description: "Make a memorable sentence stand out with larger type.",
    type: "richText",
    html: '<blockquote><p><strong><span style="font-size: 28px">“Write a memorable line here.”</span></strong></p><p>— Attribution</p></blockquote>',
    preview: "quote-pull",
  },
  {
    id: "quote-centered",
    category: "Quote",
    title: "Centered quote",
    description: "Center a short quote and its attribution.",
    type: "richText",
    html: '<blockquote><p style="text-align: center"><em>“A short thought worth remembering.”</em></p><p style="text-align: center">— Attribution</p></blockquote>',
    preview: "quote-centered",
  },
  {
    id: "quote-citation",
    category: "Quote",
    title: "Quote with citation",
    description: "Pair a quote with a book, article, or source.",
    type: "richText",
    html: '<blockquote><p>“Add a sourced quotation to support this lesson.”</p><p>— Source title, author, year</p></blockquote>',
    preview: "quote-citation",
  },
  {
    id: "quote-testimonial",
    category: "Quote",
    title: "Learner testimonial",
    description: "Share learner feedback with a name and role.",
    type: "richText",
    html: '<blockquote><p><em>“This course helped me put the ideas into practice.”</em></p><p><strong>Learner name</strong><br>Role or organization</p></blockquote>',
    preview: "quote-testimonial",
  },
  {
    id: "list-bulleted",
    category: "List",
    title: "Bulleted list",
    description: "Present related points in a simple list.",
    type: "richText",
    html: "<ul><li><p>First point</p></li><li><p>Second point</p></li><li><p>Third point</p></li></ul>",
    preview: "list",
  },
  {
    id: "list-numbered",
    category: "List",
    title: "Numbered steps",
    description: "Show a sequence learners can follow.",
    type: "richText",
    html: "<ol><li><p>First step</p></li><li><p>Second step</p></li><li><p>Third step</p></li></ol>",
    preview: "numbered",
  },
  {
    id: "list-lettered",
    category: "List",
    title: "Lettered list",
    description: "Organize points with A, B, and C markers.",
    type: "richText",
    html: '<ol type="A"><li><p>First point</p></li><li><p>Second point</p></li><li><p>Third point</p></li></ol>',
    preview: "lettered",
  },
  {
    id: "list-roman",
    category: "List",
    title: "Roman numeral steps",
    description: "Present a sequence with I, II, and III markers.",
    type: "richText",
    html: '<ol type="I"><li><p>First step</p></li><li><p>Second step</p></li><li><p>Third step</p></li></ol>',
    preview: "roman",
  },
  {
    id: "list-circle-bullets",
    category: "List",
    title: "Circle bullets",
    description: "Use open-circle markers for supporting points.",
    type: "richText",
    html: '<ul data-list-style="circle"><li><p>First point</p></li><li><p>Second point</p></li><li><p>Third point</p></li></ul>',
    preview: "circle-bullets",
  },
  {
    id: "list-square-bullets",
    category: "List",
    title: "Square bullets",
    description: "Use compact square markers to group key details.",
    type: "richText",
    html: '<ul data-list-style="square"><li><p>First point</p></li><li><p>Second point</p></li><li><p>Third point</p></li></ul>',
    preview: "square-bullets",
  },
  {
    id: "list-checklist",
    category: "List",
    title: "Checklist",
    description: "Give learners a clear checklist of actions.",
    type: "richText",
    html: '<ul data-list-style="check"><li><p>Review the example</p></li><li><p>Try the steps yourself</p></li><li><p>Check your result</p></li></ul>',
    preview: "checklist",
  },
  {
    id: "list-dashes",
    category: "List",
    title: "Dash list",
    description: "Use a light dash marker for concise notes.",
    type: "richText",
    html: '<ul data-list-style="dash"><li><p>First note</p></li><li><p>Second note</p></li><li><p>Third note</p></li></ul>',
    preview: "dash-list",
  },
  {
    id: "image-single",
    category: "Image",
    title: "Image with caption",
    description: "Add one image and an optional caption.",
    type: "image",
    preview: "image",
  },
  {
    id: "gallery-three",
    category: "Gallery",
    title: "Three image gallery",
    description: "Start with a three-image gallery.",
    type: "gallery",
    preview: "gallery",
  },
  {
    id: "media-video",
    category: "Multimedia",
    title: "Video",
    description: "Add a video link with a large preview area.",
    type: "video",
    preview: "video",
  },
  {
    id: "interactive-reveal",
    category: "Interactive",
    title: "Reflection prompt",
    description: "A starter prompt learners can respond to.",
    type: "richText",
    html: "<blockquote><p><strong>Take a moment to reflect</strong><br>What would you do in this situation? Write a prompt for your learners.</p></blockquote>",
    preview: "interactive",
  },
  {
    id: "knowledge-choice",
    category: "Knowledge check",
    title: "Multiple choice question",
    description: "Draft a question and answer options.",
    type: "richText",
    html: "<blockquote><p><strong>Check your understanding</strong><br>Which option best describes the key idea?</p><p>○ Answer option one</p><p>○ Answer option two</p><p>○ Answer option three</p></blockquote>",
    preview: "knowledge",
  },
  {
    id: "survey-rating",
    category: "Survey",
    title: "Rating scale",
    description: "Ask learners to rate their confidence.",
    type: "richText",
    html: "<blockquote><p><strong>Quick survey</strong><br>How confident do you feel about this topic?</p><p>○ 1 &nbsp; ○ 2 &nbsp; ○ 3 &nbsp; ○ 4 &nbsp; ○ 5</p></blockquote>",
    preview: "survey",
  },
  {
    id: "chart-bars",
    category: "Chart",
    title: "Bar chart starter",
    description: "Show a simple comparison with bar lengths.",
    type: "richText",
    html: "<blockquote><p><strong>Course progress</strong><br>Completed &nbsp; ▰ ▰ ▰ ▰ ▰ ▰ &nbsp; 80%<br>In progress &nbsp; ▰ ▰ ▰ &nbsp; 40%<br>Not started &nbsp; ▰ &nbsp; 15%</p></blockquote>",
    preview: "chart",
  },
  {
    id: "divider-line",
    category: "Divider",
    title: "Line divider",
    description: "Separate lesson content with a fine line.",
    type: "divider",
    dividerStyle: "line",
    preview: "divider",
  },
  {
    id: "divider-space",
    category: "Divider",
    title: "Spacer",
    description: "Add breathing room between sections.",
    type: "divider",
    dividerStyle: "space",
    preview: "spacer",
  },
  {
    id: "divider-continue",
    category: "Divider",
    title: "Continue button",
    description: "Reveal the next part of the lesson when clicked.",
    type: "divider",
    dividerStyle: "continue",
    dividerLabel: "Continue",
    preview: "continue",
  },
  {
    id: "divider-continue-reading",
    category: "Divider",
    title: "Continue reading",
    description: "Add a labeled button to reveal more lesson content.",
    type: "divider",
    dividerStyle: "continue",
    dividerLabel: "Continue reading",
    preview: "continue-reading",
  },
  {
    id: "divider-continue-required",
    category: "Divider",
    title: "Continue after reading",
    description: "Require learners to reach the end of the content above.",
    type: "divider",
    dividerStyle: "continue",
    dividerLabel: "Continue",
    dividerCompletionType: "completeAbove",
    preview: "continue-required",
  },
  {
    id: "blank-text",
    category: "Blank",
    title: "Blank text block",
    description: "Start with an empty text area.",
    type: "richText",
    html: "<p></p>",
    preview: "blank",
  },
  {
    id: "blank-image",
    category: "Blank",
    title: "Blank image block",
    description: "Start with an image placeholder.",
    type: "image",
    preview: "image",
  },
  {
    id: "blank-video",
    category: "Blank",
    title: "Blank multimedia block",
    description: "Start with a video placeholder.",
    type: "video",
    preview: "video",
  },
  {
    id: "code-snippet",
    category: "Code",
    title: "Code snippet",
    description: "Add an editable code example.",
    type: "richText",
    html: '<pre><code>function greetLearner() {\n  return "Welcome to the course";\n}</code></pre>',
    preview: "code",
  },
];

const categoryIcons = {
  Text: Type,
  Statement: AlignLeft,
  Quote,
  List,
  Image: ImageIcon,
  Gallery: Images,
  Multimedia: Video,
  Interactive: MousePointerClick,
  "Knowledge check": CheckCircle2,
  Survey: CheckCircle2,
  Chart: BarChart3,
  Divider: Minus,
  Blank: FilePlus2,
  Code: Code2,
};

function commonBlock(id: string, type: ContentBlock["type"]) {
  return {
    id,
    version: 1 as const,
    width: defaultBlockWidth(type),
    widthCustom: false,
    backgroundColor: "#ffffff",
    blockPadding: defaultBlockPadding(type),
  };
}

export function createBlocksFromTemplate(
  template: BlockTemplate,
  id: string,
): ContentBlock[] {
  const blockType = template.id === "knowledge-choice" ? "knowledgeCheck" : template.id === "survey-rating" ? "survey" : template.type;
  const base = commonBlock(id, blockType);
  if (template.id === "knowledge-choice")
    return [
      {
        ...base,
        type: "knowledgeCheck",
        data: {
          question: "Which option best describes the key idea?",
          options: [
            "It takes practice",
            "It happens instantly",
            "It needs no feedback",
          ],
        },
      },
    ];
  if (template.id === "survey-rating")
    return [
      {
        ...base,
        type: "survey",
        data: {
          question: "How confident do you feel?",
          minLabel: "Not yet",
          maxLabel: "Very confident",
        },
      },
    ];
  if (template.type === "statement") {
    if (!template.statement) {
      throw new Error(`Statement template "${template.id}" is missing its content.`);
    }
    return [{ ...base, type: "statement", data: template.statement }];
  }
  if (template.type === "richText")
    return [
      { ...base, type: "richText", data: { html: template.html ?? "<p></p>" } },
    ];
  if (template.type === "image")
    return [
      {
        ...base,
        type: "image",
        data: {
          src: "https://placehold.co/1200x675?text=Add+an+image",
          alt: "",
          caption: "",
        },
      },
    ];
  if (template.type === "gallery")
    return [
      {
        ...base,
        type: "gallery",
        data: {
          images: [1, 2, 3].map((number) => ({
            src: `https://placehold.co/480x360?text=Image+${number}`,
            alt: `Gallery image ${number}`,
          })),
        },
      },
    ];
  if (template.type === "video")
    return [
      {
        ...base,
        type: "video",
        data: { src: "https://www.youtube.com/watch?v=", captions: "" },
      },
    ];
  return [
    {
      ...base,
      type: "divider",
      data: {
        style: template.dividerStyle ?? "line",
        label: template.dividerLabel ?? "Continue",
        completionType: template.dividerCompletionType ?? "none",
      },
    },
  ];
}

type ListPreviewStyle = "disc" | "circle" | "square" | "check" | "dash" | "numbered" | "lettered" | "roman";

function ListTemplatePreview({ style }: { style: ListPreviewStyle }) {
  const labels: Record<ListPreviewStyle, string[]> = {
    disc: ["•", "•", "•"],
    circle: ["○", "○", "○"],
    square: ["▪", "▪", "▪"],
    check: ["✓", "✓", "✓"],
    dash: ["–", "–", "–"],
    numbered: ["1.", "2.", "3."],
    lettered: ["A.", "B.", "C."],
    roman: ["I.", "II.", "III."],
  };
  const items = style === "numbered" || style === "lettered" || style === "roman"
    ? ["Review the example", "Try the steps yourself", "Check your result"]
    : ["First point", "Second point", "Third point"];

  return <div className="space-y-1.5 text-[11px] leading-4 text-slate-700">
    {items.map((item, index) => <p key={item} className="flex gap-2">
      <span className={`w-7 shrink-0 text-right ${style === "check" || style === "numbered" || style === "lettered" || style === "roman" ? "font-semibold text-indigo-600" : "text-indigo-600"}`}>{labels[style][index]}</span>
      <span>{item}</span>
    </p>)}
  </div>;
}

function TemplatePreview({ template }: { template: BlockTemplate }) {
  const kind = template.preview;
  if (template.type === "statement" && template.statement)
    return <StatementBlockPreview {...template.statement} />;
  if (kind === "knowledge")
    return (
      <InputBlockPreview
        type="knowledgeCheck"
        question="Which option best describes the key idea?"
        options={[
          "It takes practice",
          "It happens instantly",
          "It needs no feedback",
        ]}
      />
    );
  if (kind === "survey")
    return (
      <InputBlockPreview
        type="survey"
        question="How confident do you feel?"
        minLabel="Not yet"
        maxLabel="Very confident"
      />
    );
  if (kind === "title")
    return (
      <div className="text-slate-700">
        <p className="my-2 leading-normal">
          <strong>
            <span className="text-4xl tracking-tight">Section heading</span>
          </strong>
          <br />
          <span className="text-xs">Write your paragraph here.</span>
        </p>
      </div>
    );
  if (kind === "text")
    return (
      <article className="text-[11px] leading-4 text-slate-600">
        <p>
          Write a concise explanation for your learners. Add another sentence to
          connect the idea to a real example.
        </p>
      </article>
    );
  if (kind === "quote")
    return (
      <blockquote className="border-l-2 border-slate-300 pl-3 text-[11px] italic leading-4 text-slate-700">
        <p>
          “Great things are done by a series of small things brought together.”
        </p>
        <footer className="mt-2 text-[10px] not-italic text-slate-500">
          Vincent van Gogh
        </footer>
      </blockquote>
    );
  if (kind === "quote-pull")
    return <blockquote className="border-l-2 border-indigo-500 pl-3 text-sm font-semibold leading-5 text-slate-800"><p>“Write a memorable line here.”</p><footer className="mt-2 text-[10px] font-normal text-slate-500">— Attribution</footer></blockquote>;
  if (kind === "quote-centered")
    return <blockquote className="border-l-2 border-slate-300 pl-3 text-center text-[11px] italic leading-4 text-slate-700"><p>“A short thought worth remembering.”</p><footer className="mt-2 text-[10px] not-italic text-slate-500">— Attribution</footer></blockquote>;
  if (kind === "quote-citation")
    return <blockquote className="border-l-2 border-emerald-500 pl-3 text-[11px] leading-4 text-slate-700"><p>“Add a sourced quotation to support this lesson.”</p><footer className="mt-2 text-[10px] text-slate-500">Source title, author, year</footer></blockquote>;
  if (kind === "quote-testimonial")
    return <blockquote className="border-l-2 border-violet-400 pl-3 text-[11px] italic leading-4 text-slate-700"><p>“This course helped me put the ideas into practice.”</p><footer className="mt-2 text-[10px] not-italic font-semibold text-slate-600">Learner name <span className="font-normal text-slate-400">· Role or organization</span></footer></blockquote>;
  if (kind === "interactive")
    return (
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-[11px] text-slate-700">
        <p className="font-semibold text-slate-900">Take a moment to reflect</p>
        <p className="mt-1 leading-4">What would you do in this situation?</p>
        <span className="mt-2 inline-flex rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white">
          Reveal answer
        </span>
      </div>
    );
  if (kind === "list") return <ListTemplatePreview style="disc" />;
  if (kind === "numbered") return <ListTemplatePreview style="numbered" />;
  if (kind === "lettered") return <ListTemplatePreview style="lettered" />;
  if (kind === "roman") return <ListTemplatePreview style="roman" />;
  if (kind === "circle-bullets") return <ListTemplatePreview style="circle" />;
  if (kind === "square-bullets") return <ListTemplatePreview style="square" />;
  if (kind === "checklist") return <ListTemplatePreview style="check" />;
  if (kind === "dash-list") return <ListTemplatePreview style="dash" />;
  if (kind === "image")
    return (
      <div className="relative grid h-24 place-items-center overflow-hidden rounded-md bg-gradient-to-br from-sky-200 via-cyan-100 to-emerald-200">
        <div className="absolute bottom-0 h-1/2 w-full bg-gradient-to-t from-emerald-700/40 to-transparent" />
        <div className="absolute left-7 top-5 size-8 rounded-full bg-amber-200" />
        <div className="absolute bottom-0 h-10 w-full [clip-path:polygon(0_100%,34%_20%,56%_70%,76%_10%,100%_100%)] bg-emerald-600/70" />
        <ImageIcon size={18} className="relative z-10 text-white drop-shadow" />
      </div>
    );
  if (kind === "gallery")
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {[
          "from-amber-200 to-rose-300",
          "from-sky-200 to-indigo-300",
          "from-emerald-200 to-teal-400",
        ].map((colors, index) => (
          <div
            key={index}
            className={`relative h-20 overflow-hidden rounded bg-gradient-to-br ${colors}`}
          >
            <span className="absolute bottom-0 left-0 h-1/2 w-full bg-gradient-to-t from-slate-900/25 to-transparent" />
          </div>
        ))}
      </div>
    );
  if (kind === "video")
    return (
      <div className="relative grid h-24 place-items-center overflow-hidden rounded-md bg-gradient-to-br from-slate-700 via-slate-800 to-indigo-950">
        <div className="absolute bottom-2 left-2 right-2 h-1 rounded-full bg-white/30">
          <span className="block h-full w-1/3 rounded-full bg-indigo-400" />
        </div>
        <span className="relative grid size-9 place-items-center rounded-full bg-white/95 pl-0.5 text-slate-800 shadow">
          <Video size={16} />
        </span>
        <span className="absolute left-2 top-2 text-[9px] font-medium text-white/90">
          Course introduction
        </span>
      </div>
    );
  if (kind === "chart")
    return (
      <div className="space-y-2 text-[9px] text-slate-600">
        {[
          ["Completed", "80%", "w-4/5"],
          ["In progress", "40%", "w-2/5"],
          ["Not started", "15%", "w-1/6"],
        ].map(([label, value, width]) => (
          <div
            key={label}
            className="grid grid-cols-[58px_minmax(0,1fr)_24px] items-center gap-1.5"
          >
            <span>{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100">
              <span
                className={`block h-full rounded-full bg-indigo-500 ${width}`}
              />
            </span>
            <span className="text-right">{value}</span>
          </div>
        ))}
      </div>
    );
  if (kind === "divider")
    return (
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-300" />
        <span className="text-[9px] text-slate-400">Section break</span>
        <span className="h-px flex-1 bg-slate-300" />
      </div>
    );
  if (kind === "spacer")
    return (
      <div className="grid h-20 place-items-center text-[10px] text-slate-400">
        <span className="rounded border border-dashed border-slate-300 px-3 py-1">
          Space between sections
        </span>
      </div>
    );
  if (kind === "continue" || kind === "continue-reading" || kind === "continue-required")
    return (
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[10px] font-semibold text-white shadow-sm">
          {kind === "continue-reading" ? "Continue reading" : "Continue"}
        </span>
      </div>
    );
  if (kind === "blank")
    return (
      <div className="grid h-20 place-items-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">
        Start writing here…
      </div>
    );
  if (kind === "code")
    return (
      <div className="rounded-md bg-slate-900 p-3 font-mono text-[9px] leading-4 text-emerald-300">
        <span className="text-slate-500">{"// greet the learner"}</span>
        <br />
        function greetLearner() &#123;
        <br />
        &nbsp; return <span className="text-amber-200">&quot;Welcome!&quot;</span>;<br />
        &#125;
      </div>
    );
  return <div className="h-12 rounded-md bg-slate-100" />;
}
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
