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
  Quote,
  RotateCcw,
  Type,
  Video,
  X,
} from "lucide-react";
import { defaultBlockPadding, defaultBlockWidth, type ContentBlock, type DividerCompletionType, type ImageLayout, type StatementStyle } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { InputBlockPreview } from "./input-block-preview";
import { StatementBlockPreview } from "./statement-block-preview";
import { ChartBlockPreview } from "../../preview/chart-block";

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
  type: ContentBlock["type"];
  html?: string;
  dividerStyle?: "line" | "space" | "continue";
  dividerLabel?: string;
  dividerCompletionType?: DividerCompletionType;
  statement?: { style: StatementStyle; title: string; body: string };
  knowledgeCheck?: Extract<ContentBlock, { type: "knowledgeCheck" }>['data'];
  survey?: Extract<ContentBlock, { type: "survey" }>['data'];
  flipCard?: Extract<ContentBlock, { type: "flipCard" }>['data'];
  accordion?: Extract<ContentBlock, { type: "accordion" }>['data'];
  labeledGraphic?: Extract<ContentBlock, { type: "labeledGraphic" }>['data'];
  processSteps?: Extract<ContentBlock, { type: "processSteps" }>['data'];
  chart?: Extract<ContentBlock, { type: "chart" }>['data'];
  imageLayout?: ImageLayout;
  imageTitle?: string;
  imageBody?: string;
  width?: ContentBlock["width"];
  preview: string;
};

export const blockTemplates: BlockTemplate[] = [
  {
    id: "text-title-paragraph",
    category: "Text",
    title: "Title and paragraph",
    description: "A bold section title followed by comfortable body text.",
    type: "richText",
    html: '<p><strong><span style="font-size: 36px">Section heading</span></strong></p><p><span style="font-size: 16px">Write your paragraph here.</span></p>',
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
    id: "text-lead",
    category: "Text",
    title: "Lead paragraph",
    description: "Start with larger, softer text that introduces a topic.",
    type: "richText",
    html: '<p><span style="font-size: 20px; color: #475569">Introduce the main idea with a clear, welcoming explanation.</span></p>',
    preview: "text-lead",
  },
  {
    id: "text-large-body",
    category: "Text",
    title: "Large body text",
    description: "Use 24px type when a short explanation needs more emphasis.",
    type: "richText",
    html: '<p><span style="font-size: 24px">Explain one important idea in a few concise sentences.</span></p>',
    preview: "text-large-body",
  },
  {
    id: "text-small-note",
    category: "Text",
    title: "Small note",
    description: "Add a subtle 14px note, reminder, or supporting detail.",
    type: "richText",
    html: '<p><span style="font-size: 14px; color: #64748b">Note: Add a short reminder or supporting detail here.</span></p>',
    preview: "text-small-note",
  },
  {
    id: "text-centered-intro",
    category: "Text",
    title: "Centered introduction",
    description: "Center a short 20px introduction for a clear visual pause.",
    type: "richText",
    html: '<p style="text-align: center"><strong><span style="font-size: 20px">A new way to think about this topic</span></strong></p><p style="text-align: center"><span style="font-size: 16px">Add a sentence that sets up the lesson below.</span></p>',
    preview: "text-centered-intro",
  },
  {
    id: "text-subheading",
    category: "Text",
    title: "Subheading and body",
    description: "Separate a bold 24px subheading from its 16px explanation.",
    type: "richText",
    html: '<p><strong><span style="font-size: 24px">A clear subheading</span></strong></p><p><span style="font-size: 16px">Use the paragraph below to explain the idea or add an example.</span></p>',
    preview: "text-subheading",
  },
  {
    id: "text-color-emphasis",
    category: "Text",
    title: "Color emphasis",
    description: "Pair a colored 22px key phrase with regular supporting text.",
    type: "richText",
    html: '<p><strong><span style="font-size: 22px; color: #4f46e5">Key idea</span></strong><br><span style="font-size: 16px">Explain why this idea matters to the learner.</span></p>',
    preview: "text-color-emphasis",
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
    imageLayout: "full",
    preview: "image",
  },
  {
    id: "image-banner",
    category: "Image",
    title: "Wide image banner",
    description: "Use a panoramic image as a visual break in the lesson.",
    type: "image",
    imageLayout: "banner",
    width: "full",
    preview: "image-banner",
  },
  {
    id: "image-text-left",
    category: "Image",
    title: "Text left, image right",
    description: "Pair a short explanation with a supporting image.",
    type: "image",
    imageLayout: "text-left",
    imageTitle: "Explain the idea",
    imageBody: "Add a short explanation that helps learners understand this image.",
    width: "medium",
    preview: "image-text-left",
  },
  {
    id: "image-text-right",
    category: "Image",
    title: "Image left, text right",
    description: "Lead with a visual, then explain what learners should notice.",
    type: "image",
    imageLayout: "text-right",
    imageTitle: "What to notice",
    imageBody: "Describe the important detail or connect the visual to the lesson.",
    width: "medium",
    preview: "image-text-right",
  },
  {
    id: "image-text-overlay",
    category: "Image",
    title: "Image with text overlay",
    description: "Place a short title and description over a full-width image.",
    type: "image",
    imageLayout: "text-overlay",
    imageTitle: "A visual introduction",
    imageBody: "Set the scene with one short sentence.",
    width: "full",
    preview: "image-text-overlay",
  },
  {
    id: "image-feature-card",
    category: "Image",
    title: "Image feature card",
    description: "Combine a clean image, heading, and description in one card.",
    type: "image",
    imageLayout: "card",
    imageTitle: "Feature title",
    imageBody: "Add a concise explanation below the image.",
    width: "medium",
    preview: "image-feature-card",
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
    title: "Flip card",
    description: "Let learners reveal an answer, hint, or explanation.",
    type: "flipCard",
    flipCard: { cards: [{ id: "card-1", frontLabel: "Think about it", front: { type: "text", text: "What is one benefit of active recall?" }, backLabel: "Reveal", back: { type: "text", text: "Trying to remember an idea strengthens learning and shows what you still need to review." } }] },
    preview: "flip-card",
  },
  {
    id: "interactive-term-definition",
    category: "Interactive",
    title: "Term and definition",
    description: "Create a study card learners can flip to check a definition.",
    type: "flipCard",
    flipCard: { cards: [{ id: "card-1", frontLabel: "Term", front: { type: "text", text: "Active recall" }, backLabel: "Definition", back: { type: "text", text: "Retrieving information from memory instead of simply rereading it." } }] },
    preview: "flip-term",
  },
  {
    id: "interactive-scenario-reveal",
    category: "Interactive",
    title: "Scenario and response",
    description: "Invite a decision, then reveal a suggested response.",
    type: "flipCard",
    flipCard: { cards: [{ id: "card-1", frontLabel: "Scenario", front: { type: "text", text: "A learner is stuck on a difficult problem. What could they try next?" }, backLabel: "Suggested response", back: { type: "text", text: "Break the task into smaller steps, review a relevant example, and ask for feedback on the first step." } }] },
    preview: "flip-scenario",
  },
  {
    id: "interactive-flashcards-2",
    category: "Interactive",
    title: "Two-card study set",
    description: "Use two connected prompts to review a concept and its application.",
    type: "flipCard",
    flipCard: { cards: [
      { id: "card-1", frontLabel: "Concept", front: { type: "text", text: "What is spaced practice?" }, backLabel: "Definition", back: { type: "text", text: "Reviewing information over multiple sessions with time between them." } },
      { id: "card-2", frontLabel: "Apply it", front: { type: "text", text: "How could you use spaced practice this week?" }, backLabel: "Example", back: { type: "text", text: "Schedule short review sessions across several days instead of one long study session." } },
    ] },
    width: "full",
    preview: "flip-card",
  },
  {
    id: "interactive-flashcards-3",
    category: "Interactive",
    title: "Three-card review",
    description: "Build a short three-step recall activity for a lesson topic.",
    type: "flipCard",
    flipCard: { cards: [
      { id: "card-1", frontLabel: "Recall", front: { type: "text", text: "What is the key idea?" }, backLabel: "Key idea", back: { type: "text", text: "Write the main concept learners should remember." } },
      { id: "card-2", frontLabel: "Explain", front: { type: "text", text: "Why does it matter?" }, backLabel: "Reason", back: { type: "text", text: "Add a short explanation of why this idea is useful." } },
      { id: "card-3", frontLabel: "Apply", front: { type: "text", text: "Where could you use it?" }, backLabel: "Example", back: { type: "text", text: "Give a practical example from work, study, or daily life." } },
    ] },
    width: "full",
    preview: "flip-card",
  },
  {
    id: "interactive-flashcards-4",
    category: "Interactive",
    title: "Four-card key terms",
    description: "Start a four-term vocabulary or concept review.",
    type: "flipCard",
    flipCard: { cards: [
      { id: "card-1", frontLabel: "Term 1", front: { type: "text", text: "Add the first key term." }, backLabel: "Meaning", back: { type: "text", text: "Write a clear definition or explanation." } },
      { id: "card-2", frontLabel: "Term 2", front: { type: "text", text: "Add the second key term." }, backLabel: "Meaning", back: { type: "text", text: "Write a clear definition or explanation." } },
      { id: "card-3", frontLabel: "Term 3", front: { type: "text", text: "Add the third key term." }, backLabel: "Meaning", back: { type: "text", text: "Write a clear definition or explanation." } },
      { id: "card-4", frontLabel: "Term 4", front: { type: "text", text: "Add the fourth key term." }, backLabel: "Meaning", back: { type: "text", text: "Write a clear definition or explanation." } },
    ] },
    width: "full",
    preview: "flip-card",
  },
  {
    id: "interactive-accordion",
    category: "Interactive",
    title: "Accordion explanations",
    description: "Let learners open one explanation at a time.",
    type: "accordion",
    accordion: { layout: "accordion", items: [
      { id: "section-1", title: "What is retrieval practice?", body: "Retrieval practice means actively bringing information to mind instead of only rereading it." },
      { id: "section-2", title: "Why does it help?", body: "Trying to recall an idea strengthens memory and reveals what still needs review." },
      { id: "section-3", title: "When can I use it?", body: "Pause after reading or watching a lesson and explain the key ideas without looking at your notes." },
    ] },
    preview: "accordion",
  },
  {
    id: "interactive-tabs",
    category: "Interactive",
    title: "Tabbed explanations",
    description: "Group related explanations into learner-selectable tabs.",
    type: "accordion",
    accordion: { layout: "tabs", items: [
      { id: "tab-1", title: "Plan", body: "Choose one clear learning goal and decide what success will look like." },
      { id: "tab-2", title: "Practice", body: "Try the skill in a short, focused activity and notice where you get stuck." },
      { id: "tab-3", title: "Reflect", body: "Review what worked and choose one next step for continued practice." },
    ] },
    preview: "tabs",
  },
  {
    id: "interactive-labeled-graphic",
    category: "Interactive",
    title: "Labeled graphic",
    description: "Add clickable markers that explain parts of an image.",
    type: "labeledGraphic",
    labeledGraphic: {
      src: "https://placehold.co/1200x675?text=Add+a+graphic",
      alt: "Diagram with interactive labels",
      markers: [
        { id: "marker-1", label: "Part one", description: "Explain the first part of the graphic.", x: 30, y: 40 },
        { id: "marker-2", label: "Part two", description: "Explain how the second part works.", x: 68, y: 62 },
        { id: "marker-3", label: "Part three", description: "Add one more detail for learners to explore.", x: 52, y: 25 },
      ],
    },
    preview: "labeled-graphic",
  },
  {
    id: "interactive-process-steps",
    category: "Interactive",
    title: "Process steps",
    description: "Guide learners through a sequence one step at a time.",
    type: "processSteps",
    processSteps: { steps: [
      { id: "step-1", title: "Prepare", body: "Gather what you need and identify the goal." },
      { id: "step-2", title: "Work through the task", body: "Follow the process and focus on one action at a time." },
      { id: "step-3", title: "Review", body: "Check your result and decide whether any step needs another pass." },
    ] },
    preview: "process-steps",
  },
  {
    id: "interactive-knowledge-check",
    category: "Interactive",
    title: "Quick knowledge check",
    description: "Ask a question and give learners feedback on their choice.",
    type: "knowledgeCheck",
    knowledgeCheck: { question: "Which practice helps information stick?", options: ["Active recall", "Reading the same page again"], correctOptionIndex: 0, correctFeedback: "Correct! Retrieving information strengthens memory.", incorrectFeedback: "Try again. Choose the option that asks you to remember." },
    preview: "knowledge",
  },
  {
    id: "interactive-confidence-poll",
    category: "Interactive",
    title: "Confidence rating",
    description: "Give learners a quick way to reflect on their confidence.",
    type: "survey",
    survey: { question: "How confident do you feel about this topic?", minLabel: "Not yet", maxLabel: "Very confident" },
    preview: "survey",
  },
  {
    id: "knowledge-choice",
    category: "Knowledge check",
    title: "Multiple choice question",
    description: "Draft a question and answer options.",
    type: "knowledgeCheck",
    knowledgeCheck: { question: "Which option best describes the key idea?", options: ["It takes practice", "It happens instantly", "It needs no feedback"], correctOptionIndex: 0, correctFeedback: "Correct! Practice helps make learning stick.", incorrectFeedback: "Not quite. Think about what helps a new skill improve." },
    preview: "knowledge",
  },
  {
    id: "survey-rating",
    category: "Survey",
    title: "Rating scale",
    description: "Ask learners to rate their confidence.",
    type: "survey",
    survey: { question: "How confident do you feel?", minLabel: "Not yet", maxLabel: "Very confident" },
    preview: "survey",
  },
  {
    id: "chart-bars",
    category: "Chart",
    title: "Bar chart starter",
    description: "Show a simple comparison with bar lengths.",
    type: "chart",
    chart: {
      chartType: "bar",
      title: "Course progress",
      description: "Compare learner progress across the course.",
      color: "#4f46e5",
      fields: [
        { id: "completed", label: "Completed", value: 80 },
        { id: "in-progress", label: "In progress", value: 40 },
        { id: "not-started", label: "Not started", value: 15 },
      ],
    },
    width: "medium",
    preview: "chart",
  },
  {
    id: "chart-horizontal-comparison",
    category: "Chart",
    title: "Horizontal comparison",
    description: "Compare several categories with clear horizontal bars.",
    type: "chart",
    chart: {
      chartType: "bar",
      title: "Compare the results",
      description: "Compare values across three groups.",
      color: "#4f46e5",
      fields: [
        { id: "group-a", label: "Group A", value: 80 },
        { id: "group-b", label: "Group B", value: 60 },
        { id: "group-c", label: "Group C", value: 40 },
      ],
    },
    width: "medium",
    preview: "chart-horizontal",
  },
  {
    id: "chart-columns-quarterly",
    category: "Chart",
    title: "Quarterly columns",
    description: "Show values over time with a compact column chart.",
    type: "chart",
    chart: {
      chartType: "column",
      title: "Quarterly results",
      description: "Compare results across the year.",
      color: "#4f46e5",
      fields: [
        { id: "q1", label: "Q1", value: 34 },
        { id: "q2", label: "Q2", value: 52 },
        { id: "q3", label: "Q3", value: 68 },
        { id: "q4", label: "Q4", value: 91 },
      ],
    },
    width: "medium",
    preview: "chart-columns",
  },
  {
    id: "chart-line-trend",
    category: "Chart",
    title: "Line trend",
    description: "Illustrate a trend across a sequence of dates or stages.",
    type: "chart",
    chart: {
      chartType: "line",
      title: "Weekly engagement",
      description: "Track how engagement changes over time.",
      color: "#0f766e",
      fields: [
        { id: "week-1", label: "Week 1", value: 18 },
        { id: "week-2", label: "Week 2", value: 30 },
        { id: "week-3", label: "Week 3", value: 27 },
        { id: "week-4", label: "Week 4", value: 52 },
        { id: "week-5", label: "Week 5", value: 44 },
        { id: "week-6", label: "Week 6", value: 68 },
        { id: "week-7", label: "Week 7", value: 82 },
      ],
    },
    width: "medium",
    preview: "chart-line",
  },
  {
    id: "chart-donut-share",
    category: "Chart",
    title: "Donut share",
    description: "Highlight one percentage and explain the remaining share.",
    type: "chart",
    chart: {
      chartType: "donut",
      title: "Completion rate",
      description: "Show how much of the course has been completed.",
      color: "#4f46e5",
      fields: [
        { id: "completed", label: "Completed", value: 72 },
        { id: "remaining", label: "Remaining", value: 28 },
      ],
    },
    width: "medium",
    preview: "chart-donut",
  },
  {
    id: "chart-stacked-distribution",
    category: "Chart",
    title: "Stacked distribution",
    description: "Show how several groups combine into one total.",
    type: "chart",
    chart: {
      chartType: "stacked",
      title: "Response distribution",
      description: "Show how responses contribute to the overall total.",
      color: "#4f46e5",
      fields: [
        { id: "strong", label: "Strong", value: 6 },
        { id: "good", label: "Good", value: 4 },
        { id: "fair", label: "Fair", value: 3 },
        { id: "support", label: "Needs support", value: 2 },
      ],
    },
    width: "medium",
    preview: "chart-stacked",
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
    html: '<pre><code>// Greet the learner\nfunction greetLearner() {\n  return "Welcome!";\n}</code></pre>',
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
  Interactive: RotateCcw,
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
  const isLineDivider =
    template.type === "divider" && (template.dividerStyle ?? "line") === "line";
  const base = {
    ...commonBlock(id, template.type),
    ...(isLineDivider ? { width: "full" as const, blockPadding: 60 } : {}),
    ...(template.width ? { width: template.width } : {}),
  };
  if (template.type === "knowledgeCheck") {
    if (!template.knowledgeCheck) throw new Error(`Knowledge check template "${template.id}" is missing its content.`);
    return [{ ...base, type: "knowledgeCheck", data: template.knowledgeCheck }];
  }
  if (template.type === "survey") {
    if (!template.survey) throw new Error(`Survey template "${template.id}" is missing its content.`);
    return [{ ...base, type: "survey", data: template.survey }];
  }
  if (template.type === "flipCard") {
    if (!template.flipCard) throw new Error(`Flip card template "${template.id}" is missing its content.`);
    return [{ ...base, type: "flipCard", data: template.flipCard }];
  }
  if (template.type === "accordion") {
    if (!template.accordion) throw new Error(`Accordion template "${template.id}" is missing its content.`);
    return [{ ...base, type: "accordion", data: template.accordion }];
  }
  if (template.type === "labeledGraphic") {
    if (!template.labeledGraphic) throw new Error(`Labeled graphic template "${template.id}" is missing its content.`);
    return [{ ...base, type: "labeledGraphic", data: template.labeledGraphic }];
  }
  if (template.type === "processSteps") {
    if (!template.processSteps) throw new Error(`Process steps template "${template.id}" is missing its content.`);
    return [{ ...base, type: "processSteps", data: template.processSteps }];
  }
  if (template.type === "chart") {
    if (!template.chart) throw new Error(`Chart template "${template.id}" is missing its data.`);
    return [{ ...base, type: "chart", data: template.chart }];
  }
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
          ...(template.imageLayout === "full" ? { caption: "" } : {}),
          ...(template.imageLayout ? { layout: template.imageLayout } : {}),
          ...(template.imageTitle ? { title: template.imageTitle } : {}),
          ...(template.imageBody ? { body: template.imageBody } : {}),
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
        ...(isLineDivider
          ? { lineWeight: 1, lineColor: "#cbd5e1", lineStyle: "solid" as const }
          : {}),
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

function MiniLandscape({ className = "" }: { className?: string }) {
  return <div className={`relative overflow-hidden bg-gradient-to-br from-sky-200 via-cyan-100 to-emerald-200 ${className}`}>
    <div className="absolute bottom-0 h-1/2 w-full bg-gradient-to-t from-emerald-700/40 to-transparent" />
    <div className="absolute left-7 top-5 size-8 rounded-full bg-amber-200" />
    <div className="absolute bottom-0 h-1/2 w-full [clip-path:polygon(0_100%,34%_20%,56%_70%,76%_10%,100%_100%)] bg-emerald-600/70" />
    <ImageIcon size={18} className="absolute right-2 top-2 z-10 text-white drop-shadow" />
  </div>;
}

function ImageTemplatePreview({ layout }: { layout: ImageLayout }) {
  if (layout === "text-left" || layout === "text-right") {
    const text = <div className="space-y-2"><span className="block h-2 w-3/4 rounded bg-slate-800" /><span className="block h-1.5 w-full rounded bg-slate-300" /><span className="block h-1.5 w-5/6 rounded bg-slate-300" /><span className="block h-1.5 w-2/3 rounded bg-slate-300" /></div>;
    const image = <MiniLandscape className="aspect-[4/3] rounded-md" />;
    return <div className="grid grid-cols-2 items-center gap-2">{layout === "text-left" ? <>{text}{image}</> : <>{image}{text}</>}</div>;
  }
  if (layout === "text-overlay")
    return <div className="relative"><MiniLandscape className="aspect-video rounded-lg" /><div className="absolute inset-0 flex flex-col justify-end rounded-lg bg-gradient-to-t from-slate-950/80 via-slate-900/10 to-transparent p-3"><span className="text-[11px] font-semibold text-white">A visual introduction</span><span className="mt-1 text-[8px] text-white/80">Set the scene for this lesson.</span></div></div>;
  if (layout === "card")
    return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><MiniLandscape className="aspect-video" /><div className="space-y-1.5 p-2"><span className="block h-2 w-2/3 rounded bg-slate-800" /><span className="block h-1.5 w-full rounded bg-slate-300" /><span className="block h-1.5 w-4/5 rounded bg-slate-300" /></div></div>;
  return <MiniLandscape className={layout === "banner" ? "aspect-[21/9] min-h-24 rounded-lg" : "h-24 rounded-md"} />;
}

function FlipCardTemplatePreview({ cards }: { cards: NonNullable<BlockTemplate["flipCard"]>["cards"] }) {
  const columns = cards.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid ${columns} gap-1.5`}>
      {cards.map((card, index) => (
        <div
          key={card.id}
          data-template-preview-card={card.id}
          className="relative flex min-h-24 min-w-0 flex-col items-center justify-center rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-1.5 text-center shadow-sm sm:p-2"
        >
          <RotateCcw size={10} className="absolute right-1 top-1 text-indigo-500" aria-hidden="true" />
          <span className="mb-1 max-w-full break-words text-[7px] font-semibold uppercase tracking-wide text-indigo-600 sm:text-[8px]">
            {card.frontLabel || `Card ${index + 1}`}
          </span>
          {card.front.type === "image" ? (
            <ImageIcon size={16} className="text-indigo-400" aria-hidden="true" />
          ) : (
            <span className="line-clamp-3 max-w-full break-words text-[8px] font-semibold leading-3 text-slate-800 sm:text-[9px]">
              {card.front.text || "Add a prompt"}
            </span>
          )}
          <span className="mt-1.5 text-[7px] text-slate-400 sm:text-[8px]">
            {card.backLabel || "Flip to reveal"}
          </span>
        </div>
      ))}
    </div>
  );
}

function AccordionTemplatePreview({ data }: { data: NonNullable<BlockTemplate["accordion"]> }) {
  if (data.layout === "tabs") {
    return (
      <div className="space-y-2">
        <div className="flex gap-1 border-b border-slate-200">
          {data.items.map((item, index) => (
            <span key={item.id} className={`border-b-2 px-2 py-1 text-[8px] font-medium ${index === 0 ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400"}`}>
              {item.title}
            </span>
          ))}
        </div>
        <div className="min-h-14 rounded-b-md border border-t-0 border-slate-200 bg-white p-2 text-[8px] leading-3 text-slate-600">
          {data.items[0]?.body}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {data.items.map((item, index) => (
        <div key={item.id} className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[8px] font-semibold text-slate-700">
            <span className="line-clamp-1">{item.title}</span>
            <span className="text-xs text-slate-400">{index === 0 ? "−" : "+"}</span>
          </div>
          {index === 0 && <p className="border-t border-slate-100 px-2 py-1.5 text-[7px] leading-3 text-slate-500">{item.body}</p>}
        </div>
      ))}
    </div>
  );
}

function LabeledGraphicTemplatePreview({ data }: { data: NonNullable<BlockTemplate["labeledGraphic"]> }) {
  return (
    <div className="relative overflow-hidden rounded-lg">
      <MiniLandscape className="aspect-video" />
      {data.markers.map((marker, index) => (
        <span
          key={marker.id}
          className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-indigo-600 text-[8px] font-bold text-white shadow"
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        >
          {index + 1}
        </span>
      ))}
      <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 py-0.5 text-[7px] font-medium text-slate-600">
        Select a marker to explore
      </span>
    </div>
  );
}

function ProcessStepsTemplatePreview({ data }: { data: NonNullable<BlockTemplate["processSteps"]> }) {
  const firstStep = data.steps[0];
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Step 1 of {data.steps.length}</span>
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full w-1/3 rounded-full bg-indigo-600" />
        </span>
      </div>
      <p className="m-0 text-[10px] font-semibold text-slate-800">{firstStep?.title}</p>
      <p className="m-0 line-clamp-2 text-[8px] leading-3 text-slate-500">{firstStep?.body}</p>
      <div className="flex justify-end">
        <span className="rounded-full bg-indigo-600 px-2 py-1 text-[7px] font-semibold text-white">Next step →</span>
      </div>
    </div>
  );
}

export function TemplatePreview({ template }: { template: BlockTemplate }) {
  const kind = template.preview;
  if (template.type === "statement" && template.statement)
    return <StatementBlockPreview {...template.statement} />;
  if (template.type === "flipCard" && template.flipCard)
    return <FlipCardTemplatePreview cards={template.flipCard.cards} />;
  if (template.type === "accordion" && template.accordion)
    return <AccordionTemplatePreview data={template.accordion} />;
  if (template.type === "labeledGraphic" && template.labeledGraphic)
    return <LabeledGraphicTemplatePreview data={template.labeledGraphic} />;
  if (template.type === "processSteps" && template.processSteps)
    return <ProcessStepsTemplatePreview data={template.processSteps} />;
  if (template.type === "chart" && template.chart)
    return <ChartBlockPreview data={template.chart} />;
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
      <div className="space-y-2 text-slate-700">
        <p className="m-0 leading-tight"><strong><span className="text-2xl tracking-tight">Section heading</span></strong></p>
        <p className="m-0 text-xs leading-5">Write your paragraph here.</p>
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
  if (kind === "text-lead")
    return <p className="m-0 text-sm leading-5 text-slate-600">Introduce the main idea with a clear, welcoming explanation.</p>;
  if (kind === "text-large-body")
    return <p className="m-0 text-base font-medium leading-6 text-slate-800">Explain one important idea in a few concise sentences.</p>;
  if (kind === "text-small-note")
    return <p className="m-0 text-[10px] leading-4 text-slate-500">Note: Add a short reminder or supporting detail here.</p>;
  if (kind === "text-centered-intro")
    return <div className="space-y-1 text-center"><p className="m-0 text-sm font-semibold leading-5 text-slate-900">A new way to think about this topic</p><p className="m-0 text-[10px] leading-4 text-slate-600">Add a sentence that sets up the lesson below.</p></div>;
  if (kind === "text-subheading")
    return <div className="space-y-1"><p className="m-0 text-base font-semibold leading-5 text-slate-900">A clear subheading</p><p className="m-0 text-[10px] leading-4 text-slate-600">Use the paragraph below to explain the idea or add an example.</p></div>;
  if (kind === "text-color-emphasis")
    return <p className="m-0 text-[10px] leading-4 text-slate-600"><strong className="text-sm text-indigo-600">Key idea</strong><br />Explain why this idea matters to the learner.</p>;
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
  if (kind === "list") return <ListTemplatePreview style="disc" />;
  if (kind === "numbered") return <ListTemplatePreview style="numbered" />;
  if (kind === "lettered") return <ListTemplatePreview style="lettered" />;
  if (kind === "roman") return <ListTemplatePreview style="roman" />;
  if (kind === "circle-bullets") return <ListTemplatePreview style="circle" />;
  if (kind === "square-bullets") return <ListTemplatePreview style="square" />;
  if (kind === "checklist") return <ListTemplatePreview style="check" />;
  if (kind === "dash-list") return <ListTemplatePreview style="dash" />;
  if (kind.startsWith("image")) return <ImageTemplatePreview layout={template.imageLayout ?? "full"} />;
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
      <div data-template-code-preview className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-3 py-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-1.5 rounded-full bg-rose-400" />
            <span className="size-1.5 rounded-full bg-amber-300" />
            <span className="size-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[8px] font-medium text-slate-400">greeting.js</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-indigo-200">JavaScript</span>
        </div>
        <pre className="m-0 overflow-x-auto px-3 py-3 font-mono text-[9px] leading-4 text-slate-200">
          <code>
            <span className="text-slate-500">{"// Greet the learner"}</span>
            <br />
            <span className="text-violet-300">function</span>{" "}<span className="text-sky-300">greetLearner</span>() {"{"}
            <br />
            {"  "}<span className="text-violet-300">return</span>{" "}<span className="text-amber-200">&quot;Welcome!&quot;</span>;
            <br />
            {"}"}
          </code>
        </pre>
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
