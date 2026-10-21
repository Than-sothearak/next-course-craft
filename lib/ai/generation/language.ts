import { type CourseGenerationInput } from "../course-generation-schemas";

export function learnerLanguageStyleInstruction(targetLanguage: string) {
  if (!courseUsesKhmer(targetLanguage)) return "";
  return "KHMER LEARNER STYLE: Write in natural, contemporary Khmer, with the clear and respectful tone a Cambodian teacher would use with learners. Prefer common everyday words and short, direct sentences. Keep technical terms and names in English (for example, write “Lab” as “Lab”); do not translate or transliterate them into Khmer. Mix these English terms naturally into Khmer sentences. If a term needs explaining, keep the English term and briefly explain its meaning in Khmer at first use. Use standard Khmer spelling and punctuation. Avoid word-for-word translation, stiff formal or literary phrasing, slang, and forced dialect. Use Cambodian examples only when accurate and relevant.";
}

export function resolveTargetLanguage(input: CourseGenerationInput) {
  const explicitLanguage = /\b(?:in|into|translate(?:d)? to|write in)\s+(English|Khmer)\b/i.exec(input.prompt)?.[1];
  if (explicitLanguage) return explicitLanguage;
  return input.targetLanguage === "Khmer" ? "Khmer" : "English";
}

export function courseUsesKhmer(targetLanguage: string) {
  return /\bkhmer\b/i.test(targetLanguage) || /[\u1780-\u17ff]/u.test(targetLanguage);
}
