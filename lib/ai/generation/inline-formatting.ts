import { isHtmlCodeExample, inlineFormattingHtml, stripInlineFormatting } from "@/lib/editor/inline-formatting";

/** Normalize AI prose at assembly, including responses restored from checkpoints. Never use for raw code or URLs. */
export function normalizeGeneratedInlineFormatting(value: string) {
  return value.replace(
    /(?<!`)(`{1,2})(?!`)([^\r\n]+?)\1(?!`)|\*\*\*([^*\r\n]+)\*\*\*/g,
    (match, _delimiter: string, _code: string | undefined, keyword: string | undefined) =>
      keyword !== undefined && isHtmlCodeExample(keyword) && !keyword.includes("`") ? `\`${keyword}\`` : match,
  );
}

export function generatedInlineHtml(value: string) {
  return inlineFormattingHtml(normalizeGeneratedInlineFormatting(value));
}

export function generatedPlainText(value: string) {
  return stripInlineFormatting(normalizeGeneratedInlineFormatting(value)).trim();
}
