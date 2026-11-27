/**
 * Convert generated keyword, bold, and highlight markers into safe HTML.
 * Keywords use the padded theme background; highlights use ordinary text formatting.
 */
const inlineFormattingPattern = /\*\*\*([^*\r\n]+)\*\*\*|\*\*([^*\r\n]+)\*\*|==([^=\r\n]+)==/g;

function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function renderInlineFormatting(value: string, escapeText: (text: string) => string) {
  let html = "";
  let cursor = 0;

  for (const match of value.matchAll(inlineFormattingPattern)) {
    const index = match.index ?? 0;
    html += escapeText(value.slice(cursor, index));

    if (match[2] !== undefined) {
      html += `<strong>${escapeText(match[2])}</strong>`;
    } else if (match[1] !== undefined) {
      html += `<span data-generated-emphasis="true" style="background-color: #fef08a">${escapeText(match[1])}</span>`;
    } else {
      html += `<span style="background-color: #fef08a">${escapeText(match[3])}</span>`;
    }

    cursor = index + match[0].length;
  }

  return html + escapeText(value.slice(cursor));
}

export function inlineFormattingHtml(value: string) {
  return renderInlineFormatting(value, escapeHtml);
}

export function stripInlineFormatting(value: string) {
  return value.replace(
    inlineFormattingPattern,
    (match, keyword: string | undefined, bold: string | undefined, highlight: string | undefined) =>
      keyword ?? bold ?? highlight ?? match,
  );
}

export function hasInlineFormatting(value: string) {
  return value.match(inlineFormattingPattern) !== null;
}

/** Format text nodes in saved HTML, preserving entities, attributes and raw code. */
export function inlineFormattingInHtml(html: string) {
  const htmlToken = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>/gi;
  const skippedTags = new Set(["code", "pre", "script", "style"]);
  let result = "";
  let cursor = 0;
  let skippedDepth = 0;

  for (const match of html.matchAll(htmlToken)) {
    const index = match.index ?? 0;
    const text = html.slice(cursor, index);
    result += skippedDepth === 0
      ? renderInlineFormatting(text, (value) => value)
      : text;

    const token = match[0];
    result += token;
    const tag = token.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b[^>]*>$/i);
    if (tag && skippedTags.has(tag[2].toLowerCase())) {
      if (tag[1]) skippedDepth = Math.max(0, skippedDepth - 1);
      else if (!/\/\s*>$/.test(token)) skippedDepth += 1;
    }
    cursor = index + token.length;
  }

  const trailingText = html.slice(cursor);
  result += skippedDepth === 0
    ? renderInlineFormatting(trailingText, (value) => value)
    : trailingText;
  return result;
}
