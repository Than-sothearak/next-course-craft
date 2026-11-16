/**
 * Convert the small inline-emphasis vocabulary accepted from course generation
 * into safe HTML. Raw HTML is always escaped before the markers are applied.
 */
export function inlineFormattingHtml(value: string) {
  const escaped = value.replace(
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

  return escaped
    .replace(/\*\*([^*\r\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/==([^=\r\n]+)==/g, '<span data-generated-emphasis="true" style="background-color: #fef08a">$1</span>');
}

export function stripInlineFormatting(value: string) {
  return value
    .replace(/\*\*([^*\r\n]+)\*\*/g, "$1")
    .replace(/==([^=\r\n]+)==/g, "$1");
}

export function hasInlineFormatting(value: string) {
  return /\*\*[^*\r\n]+\*\*|==[^=\r\n]+==/.test(value);
}
