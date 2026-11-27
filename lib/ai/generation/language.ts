import { type CourseGenerationInput } from "../course-generation-schemas";

export function learnerLanguageStyleInstruction(targetLanguage: string) {
  if (!courseUsesKhmer(targetLanguage)) return "";
  return [
    "KHMER LEARNER STYLE: Write in natural Khmer with the clear, respectful voice of an experienced Cambodian teacher. Use natural Khmer sentence flow rather than translating English sentence structures word for word. Preserve the source's teaching detail and level of explanation without making it overly terse.",
    "LANGUAGE COVERAGE: Write every learner-facing value in Khmer, including titles, explanations, block and card text, definitions, questions, choices, feedback, summaries, activity labels, and next-lesson text. Translate ordinary source prose instead of leaving English sentences or headings in the course.",
    "TECHNICAL VOCABULARY: For every technical, subject-specific, borrowed, or otherwise unclear term, write its natural Khmer equivalent first, followed immediately by the exact English term in parentheses. For example: អថេរ (variable), ក្បួនដោះស្រាយ (algorithm). Keep the original English spelling and capitalization inside the parentheses, and use this Khmer-first form consistently; never leave such a term by itself in English in learner-facing prose.",
    "Use a standard Khmer equivalent when one exists. For product names, acronyms, interface labels, commands, and units that need to remain recognizable, provide a short Khmer description or equivalent before the exact English form in parentheses. In runnable examples, preserve code, commands, identifiers, URLs, and schema keys exactly; when explaining them in prose, use the Khmer-first form.",
    "Use standard Khmer spelling and punctuation. Avoid stiff formal or literary phrasing, slang, and forced dialect. Use Cambodian examples only when accurate and relevant.",
  ].join("\n");
}

export function resolveTargetLanguage(input: CourseGenerationInput): "English" | "Khmer" {
  const explicitLanguage = /\b(?:in|into|translate(?:d)? to|write in)\s+(English|Khmer)\b/i.exec(input.prompt)?.[1];
  if (explicitLanguage) return explicitLanguage as "English" | "Khmer";
  return input.targetLanguage === "Khmer" ? "Khmer" : "English";
}

export function courseUsesKhmer(targetLanguage: string) {
  return /\bkhmer\b/i.test(targetLanguage) || /[\u1780-\u17ff]/u.test(targetLanguage);
}
