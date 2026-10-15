import { normalizeCodeLanguage, type CodeLanguage } from "./code-example";

export type CodeToken = {
  from: number;
  to: number;
  kind:
    | "comment"
    | "string"
    | "number"
    | "keyword"
    | "tag"
    | "property"
    | "function";
};
type TokenRule = [CodeToken["kind"], string];

export function inferCodeLanguage(code: string): CodeLanguage {
  if (/<\/?[a-z][\w:-]*(?:\s|>|\/)/i.test(code)) return "html";
  if (/^\s*[\[{]/.test(code) && /"[^"\n]+"\s*:/.test(code)) return "json";
  if (
    /(?:[.#][\w-]+|\b(?:body|div|p|h[1-6]|button))[^{}]*\{[^{}]*[\w-]+\s*:/i.test(
      code,
    )
  )
    return "css";
  if (/\b(?:def |from \w+ import |print\()/.test(code)) return "python";
  if (/\b(?:SELECT|INSERT INTO|CREATE TABLE|UPDATE)\b/i.test(code))
    return "sql";
  if (/\b(?:const|let|function|console\.)\b|=>/.test(code)) return "javascript";
  return "plaintext";
}

// Decoration ranges leave the stored source text untouched; source code is never executed.
export function highlightCode(
  code: string,
  requestedLanguage: unknown,
): CodeToken[] {
  const selected = normalizeCodeLanguage(requestedLanguage);
  const language = selected === "auto" ? inferCodeLanguage(code) : selected;
  if (!code || language === "plaintext") return [];
  const strings =
    "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`";
  const numbers =
    "\\b(?:0x[\\da-f]+|\\d+(?:\\.\\d+)?)(?:px|rem|em|vh|vw|ms|s|%)?";
  let rules: TokenRule[];
  if (language === "html") {
    rules = [
      ["comment", "<!--[\\s\\S]*?(?:-->|$)"],
      ["string", strings],
      ["tag", "<!DOCTYPE[^>]*>|</?[\\w:-]+|/?>"],
      ["property", "[\\w:-]+(?=\\s*=)"],
    ];
  } else if (language === "css") {
    rules = [
      ["comment", "/\\*[\\s\\S]*?(?:\\*/|$)"],
      ["string", strings],
      ["number", "#[\\da-f]{3,8}\\b|" + numbers],
      ["property", "[\\w-]+(?=\\s*:)"],
      ["tag", "[.#][\\w-]+|[\\w-]+(?=\\s*\\{)"],
      [
        "keyword",
        "!important|\\b(?:flex|grid|block|none|inline|auto|solid|relative|absolute)\\b",
      ],
      ["function", "[\\w-]+(?=\\()"],
    ];
  } else {
    const comments =
      language === "python" || language === "bash"
        ? "#[^\\n]*"
        : language === "sql"
          ? "--[^\\n]*|/\\*[\\s\\S]*?(?:\\*/|$)"
          : "//[^\\n]*|/\\*[\\s\\S]*?(?:\\*/|$)";
    rules = [
      ["comment", comments],
      ["string", strings],
      ["number", numbers],
      [
        "keyword",
        "\\b(?:const|let|var|function|return|if|else|for|while|class|new|import|export|from|async|await|throw|try|catch|true|false|null|undefined|interface|type|def|in|and|or|not|None|True|False|print|select|as|where|join|on|group|by|order|insert|into|values|update|set|create|table|delete|echo|then|fi|do|done)\\b",
      ],
      ["function", "[a-z_$][\\w$]*(?=\\s*\\()"],
    ];
  }
  const expression = new RegExp(
    rules.map(([kind, pattern]) => `(?<${kind}>${pattern})`).join("|"),
    "gim",
  );
  return Array.from(code.matchAll(expression), (match) => ({
    from: match.index,
    to: match.index + match[0].length,
    kind: rules.find(([kind]) => match.groups?.[kind] !== undefined)![0],
  }));
}
