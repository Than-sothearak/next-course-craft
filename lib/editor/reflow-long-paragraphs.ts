const maxSentencesPerParagraph = 4;

function splitSentences(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return text.match(/[^.!?]+[.!?]+[\s"'”’)]*|[^.!?]+$/g) ?? [text];
}

function textPosition(root: Node, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) return { node, offset: remaining };
    remaining -= length;
    node = walker.nextNode();
  }
  const fallback = root.lastChild;
  return fallback ? { node: fallback, offset: fallback.textContent?.length ?? 0 } : null;
}

function balancedGroupSizes(total: number) {
  const groupCount = Math.ceil(total / maxSentencesPerParagraph);
  const base = Math.floor(total / groupCount);
  const remainder = total % groupCount;
  return Array.from({ length: groupCount }, (_, index) => base + Number(index < remainder));
}

/** Display-only paragraph splitting. It keeps inline markup and the full original text. */
export function reflowLongParagraphs(html: string) {
  if (!html || typeof DOMParser === "undefined") return html;
  const parsed = new DOMParser().parseFromString(html, "text/html");
  for (const paragraph of Array.from(parsed.body.querySelectorAll("p"))) {
    if (paragraph.closest("li, table, blockquote, pre") || paragraph.matches("[data-type='inline-math'], [data-type='block-math'], .tiptap-mathematics-render") || paragraph.querySelector("code, [data-type='inline-math'], [data-type='block-math'], .tiptap-mathematics-render")) continue;
    const text = paragraph.textContent ?? "";
    const segments = splitSentences(text);
    const sentences: string[] = [];
    for (const segment of segments) {
      if (!segment.trim() && sentences.length) sentences[sentences.length - 1] += segment;
      else if (segment.trim()) sentences.push(segment);
      else if (sentences.length) sentences[sentences.length - 1] += segment;
      else if (segment) sentences.push(segment);
    }
    if (sentences.length <= maxSentencesPerParagraph) continue;

    const sizes = balancedGroupSizes(sentences.length);
    const paragraphs: HTMLElement[] = [];
    let sentenceIndex = 0;
    let startOffset = 0;
    for (const size of sizes) {
      const group = sentences.slice(sentenceIndex, sentenceIndex + size);
      const groupText = group.join("");
      const endOffset = startOffset + groupText.length;
      const start = textPosition(paragraph, startOffset);
      const end = textPosition(paragraph, endOffset);
      if (!start || !end) break;
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      const next = paragraph.cloneNode(false) as HTMLElement;
      next.append(range.cloneContents());
      paragraphs.push(next);
      sentenceIndex += size;
      startOffset = endOffset;
    }
    if (paragraphs.length > 1 && sentenceIndex === sentences.length) paragraph.replaceWith(...paragraphs);
  }
  return parsed.body.innerHTML;
}
