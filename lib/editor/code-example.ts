export const codeThemeValues = ["midnight", "paper", "ocean", "forest", "plum", "amber"] as const;
export type CodeTheme = (typeof codeThemeValues)[number];
export const codeLanguageValues = ["auto", "html", "css", "javascript", "typescript", "json", "python", "sql", "bash", "plaintext"] as const;
export type CodeLanguage = (typeof codeLanguageValues)[number];
export const codeTemplateValues = ["midnight-code", "paper-explained-above", "midnight-explained-below", "ocean-explained-above", "forest-explained-below", "plum-explained-above", "amber-explained-below"] as const;
export type CodeExampleTemplate = (typeof codeTemplateValues)[number];

export const codeExamplePresets: {
  id: CodeExampleTemplate;
  title: string;
  description: string;
  theme: CodeTheme;
  explanationPosition: "above" | "below";
}[] = [
  { id: "midnight-code", title: "Midnight code", description: "A dark code window with syntax colors.", theme: "midnight", explanationPosition: "below" },
  { id: "paper-explained-above", title: "Explain first · Paper", description: "A title and paragraph introduce code in a light window.", theme: "paper", explanationPosition: "above" },
  { id: "midnight-explained-below", title: "Code first · Midnight", description: "A title, dark code window, and explanation of its result.", theme: "midnight", explanationPosition: "below" },
  { id: "ocean-explained-above", title: "Explain first · Ocean", description: "Introduce an example above a deep blue code window.", theme: "ocean", explanationPosition: "above" },
  { id: "forest-explained-below", title: "Code first · Forest", description: "Show code in green, then explain its important lines.", theme: "forest", explanationPosition: "below" },
  { id: "plum-explained-above", title: "Explain first · Plum", description: "Introduce an example above a purple code window.", theme: "plum", explanationPosition: "above" },
  { id: "amber-explained-below", title: "Code first · Amber", description: "A warm light code window followed by a clear explanation.", theme: "amber", explanationPosition: "below" },
];

export const codeExampleSample = {
  title: "Greet the learner",
  language: "javascript" as const,
  code: '// Greet the learner\nfunction greetLearner() {\n  return "Welcome!";\n}',
  explanation: 'The function returns the text "Welcome!". Calling greetLearner() gives the message back to the part of your program that needs it.',
};

export function normalizeCodeTheme(value: unknown): CodeTheme {
  return codeThemeValues.includes(value as CodeTheme) ? value as CodeTheme : "midnight";
}

export function normalizeCodeLanguage(value: unknown): CodeLanguage {
  const normalized = String(value ?? "auto").toLowerCase();
  const aliases: Record<string, CodeLanguage> = { js: "javascript", ts: "typescript", xml: "html", py: "python", sh: "bash", text: "plaintext" };
  return aliases[normalized] ?? (codeLanguageValues.includes(normalized as CodeLanguage) ? normalized as CodeLanguage : "auto");
}

function escapeCodeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderCodeExampleHtml({ title = "", code, explanation = "", template = "midnight-explained-below", language = "auto" }: {
  title?: string;
  code: string;
  explanation?: string;
  template?: CodeExampleTemplate;
  language?: CodeLanguage;
}) {
  const preset = codeExamplePresets.find((item) => item.id === template) ?? codeExamplePresets[2];
  const normalizedLanguage = normalizeCodeLanguage(language);
  const heading = title.trim() ? `<h2>${escapeCodeHtml(title.trim())}</h2>` : "";
  const paragraphs = explanation.trim().split(/\r?\n\s*\r?\n/).filter(Boolean)
    .map((paragraph) => `<p>${escapeCodeHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`).join("");
  const snippet = `<pre data-code-theme="${preset.theme}" data-code-language="${normalizedLanguage}"><code class="language-${normalizedLanguage}">${escapeCodeHtml(code)}</code></pre>`;
  return heading + (preset.explanationPosition === "above" ? paragraphs + snippet : snippet + paragraphs);
}
