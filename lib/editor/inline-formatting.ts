/**
 * Convert generated bold, highlight, and inline-code markers into safe HTML.
 * Backtick terms use a light, padded theme highlight without changing weight.
 */
export function inlineFormattingHtml(value: string) {
  const escapeHtml = (text: string) =>
    text.replace(
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
  const pattern = /(`{1,2})([^`\r\n]+?)\1|\*\*([^*\r\n]+)\*\*|==([^=\r\n]+)==/g;
  let html = "";
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    html += escapeHtml(value.slice(cursor, index));

    if (match[2] !== undefined) {
      html += `<span data-generated-emphasis="true" style="background-color: #fef08a">${escapeHtml(match[2])}</span>`;
    } else if (match[3] !== undefined) {
      html += `<strong>${escapeHtml(match[3])}</strong>`;
    } else if (match[4] !== undefined) {
      html += `<span data-generated-emphasis="true" style="background-color: #fef08a">${escapeHtml(match[4])}</span>`;
    }

    cursor = index + match[0].length;
  }

  return html + escapeHtml(value.slice(cursor));
}

export function stripInlineFormatting(value: string) {
  return value.replace(
    /(`{1,2})([^`\r\n]+?)\1|\*\*([^*\r\n]+)\*\*|==([^=\r\n]+)==/g,
    (match, _delimiter: string, codeTerm: string | undefined, bold: string | undefined, highlight: string | undefined) =>
      codeTerm ?? bold ?? highlight ?? match,
  );
}

export function hasInlineFormatting(value: string) {
  return /(`{1,2})[^`\r\n]+?\1|\*\*[^*\r\n]+\*\*|==[^=\r\n]+==/.test(value);
}

export function hasInlineCodeTerms(value: string) {
  return /(`{1,2})[^`\r\n]+?\1/.test(value);
}

/** Apply the legacy backtick display treatment to text inside saved HTML. */
export function highlightInlineCodeTermsInHtml(html: string) {
  const htmlToken = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>/gi;
  const codeTerm = /(`{1,2})([^`\r\n]+?)\1/g;
  const skippedTags = new Set(["code", "pre", "script", "style"]);
  let result = "";
  let cursor = 0;
  let skippedDepth = 0;

  for (const match of html.matchAll(htmlToken)) {
    const index = match.index ?? 0;
    const text = html.slice(cursor, index);
    result += skippedDepth === 0
      ? text.replace(codeTerm, (_span, _delimiter: string, term: string) => `<span data-generated-emphasis="true" style="background-color: #fef08a">${term}</span>`)
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
    ? trailingText.replace(codeTerm, (_span, _delimiter: string, term: string) => `<span data-generated-emphasis="true" style="background-color: #fef08a">${term}</span>`)
    : trailingText;
  return result;
}
