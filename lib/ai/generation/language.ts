import { type CourseGenerationInput } from "../course-generation-schemas";

export function learnerLanguageStyleInstruction(targetLanguage: string) {
  if (!courseUsesKhmer(targetLanguage)) return "";
  return "KHMER LEARNER STYLE: Write in natural Khmer with the clear, respectful voice of an experienced Cambodian teacher. Explain ideas using natural Khmer sentence flow; do not translate English sentence structures word for word. Keep the source's teaching detail and level of explanation, and do not flatten it into overly simple or terse prose. Apply this voice to every learner-facing field: titles, explanations, block and card text, definitions, questions, choices, feedback, summaries, and next-lesson text. TECHNICAL VOCABULARY: Technical and subject-specific terms must remain in English, with their exact source spelling and capitalization. Do not translate or transliterate them, and do not replace them with a Khmer technical equivalent. This includes domain concepts, standards, acronyms, software and product names, commands, interface labels, code identifiers, and units. For example, keep HTML, CSS, JavaScript, Flexbox, API, variable, and algorithm in English. Weave each term into the Khmer explanation; at first use, briefly explain its meaning in Khmer while keeping the English term unchanged. If unsure whether a source word is a technical term, preserve its original form. Use standard Khmer spelling and punctuation. Avoid stiff formal or literary phrasing, slang, and forced dialect. Use Cambodian examples only when accurate and relevant.";
}

export function resolveTargetLanguage(input: CourseGenerationInput): "English" | "Khmer" {
  const explicitLanguage = /\b(?:in|into|translate(?:d)? to|write in)\s+(English|Khmer)\b/i.exec(input.prompt)?.[1];
  if (explicitLanguage) return explicitLanguage as "English" | "Khmer";
  return input.targetLanguage === "Khmer" ? "Khmer" : "English";
}

export function courseUsesKhmer(targetLanguage: string) {
  return /\bkhmer\b/i.test(targetLanguage) || /[\u1780-\u17ff]/u.test(targetLanguage);
}
