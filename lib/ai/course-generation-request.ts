import { courseGenerationInputSchema } from "./course-generation-schemas";

export function parseCourseGenerationForm(formData: FormData, hasSource: boolean) {
  const text = (name: string, fallback = "") => {
    const value = formData.get(name);
    return value === null || String(value).trim() === "" ? fallback : String(value);
  };
  const number = (name: string, fallback: number) => Number(text(name, String(fallback)));
  const template = text("template", "custom");
  const hasActivities = template === "preLearnPost";
  const hasGrouping = hasSource && hasActivities;
  return courseGenerationInputSchema.safeParse({
    prompt: text("prompt"),
    audience: text("audience"),
    level: text("level", "beginner"),
    lessonCount: number("lessonCount", 5),
    template,
    learnGroupingMode: hasGrouping ? text("learnGroupingMode", "smart") : "smart",
    slidesPerContent: hasGrouping ? number("slidesPerContent", 5) : 5,
    targetLanguage: text("targetLanguage", "English"),
    contentDepth: text("contentDepth", "detailed"),
    interactivity: text("interactivity", "high"),
    postTestCount: hasActivities ? number("postTestCount", 5) : 5,
    includeImages: formData.get("includeImages") === "true",
    courseTitle: text("courseTitle"),
    courseDescription: text("courseDescription"),
    model: text("model") || undefined,
  });
}

const settingMessages: Record<string, string> = {
  prompt: "Course prompt must be 5,000 characters or fewer.",
  audience: "Learner audience must be 300 characters or fewer.",
  level: "Choose Beginner, Intermediate, or Advanced for Level.",
  lessonCount: "Learning lessons must be a whole number from 1 to 20.",
  template: "Choose Custom or Pre / Learn / Post for Course structure.",
  learnGroupingMode: "Choose Smart or Fixed for Learn content grouping.",
  slidesPerContent: "Slides per Learn content item must be a whole number from 1 to 500.",
  targetLanguage: "Choose English or Khmer for Target language.",
  contentDepth: "Choose Concise, Detailed, or Very detailed for Explanation depth.",
  interactivity: "Choose Low, Medium, or High for Interactivity.",
  postTestCount: "Post-test questions must be a whole number from 1 to 20.",
  courseTitle: "Course title must be 160 characters or fewer.",
  courseDescription: "Course description must be 5,000 characters or fewer.",
  model: "Choose one of the available OpenAI models.",
};

export function generationSettingsError(issues: { path: PropertyKey[]; message: string }[]) {
  return [...new Set(issues.map((issue) => settingMessages[String(issue.path[0])] ?? issue.message))].join(" ");
}
