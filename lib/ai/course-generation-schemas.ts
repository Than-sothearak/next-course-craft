import { z } from "zod";

export const courseGenerationModelValues = ["gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna"] as const;
export const courseGenerationModelSchema = z.enum(courseGenerationModelValues);
export type CourseGenerationModel = z.infer<typeof courseGenerationModelSchema>;
export const defaultCourseGenerationModel: CourseGenerationModel = "gpt-6-astra";
export const courseGenerationModelOptions: {
  value: CourseGenerationModel;
  label: string;
  description: string;
}[] = [
  { value: "gpt-6-astra", label: "GPT-6 Astra", description: "Most capable" },
  { value: "gpt-6.1-sol", label: "GPT-6.1 Sol", description: "Balanced" },
  { value: "gpt-6-luna", label: "GPT-6 Luna", description: "Efficient" },
];

export const courseGenerationInputSchema = z.object({
  prompt: z.string().max(5_000),
  audience: z.string().max(300),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  lessonCount: z.number().int().min(2).max(20),
  template: z.enum(["custom", "preLearnPost"]),
  includeImages: z.boolean(),
  courseTitle: z.string().max(160),
  courseDescription: z.string().max(5_000),
  model: courseGenerationModelSchema.optional(),
});

export const generatedAssessmentQuestionSchema = z.object({
  question: z.string().trim().min(1).max(1_000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(5),
  correctOptionIndex: z.number().int().min(0).max(4),
  correctFeedback: z.string().max(1_000),
  incorrectFeedback: z.string().max(1_000),
}).superRefine((question, context) => {
  if (question.correctOptionIndex >= question.options.length) {
    context.addIssue({
      code: "custom",
      path: ["correctOptionIndex"],
      message: "The correct answer must refer to one of the available options.",
    });
  }
});

export const generatedBlockSeedSchema = z.object({
  type: z.enum(["text", "statement", "knowledgeCheck", "processSteps", "flipCard", "accordion", "divider", "image"]),
  title: z.string().max(500),
  body: z.string().max(5_000),
  bullets: z.array(z.string().max(500)).max(10),
  style: z.enum(["key", "tip", "warning", "centered"]),
  question: z.string().max(1_000),
  options: z.array(z.string().max(500)).max(8),
  correctOptionIndex: z.number().int().min(0).max(7),
  steps: z.array(z.object({
    title: z.string().max(160),
    body: z.string().max(5_000),
  })).max(10),
  cards: z.array(z.object({
    front: z.string().trim().min(1).max(2_000),
    back: z.string().trim().min(1).max(2_000),
  })).max(12),
  imageAlt: z.string().max(500),
  imagePrompt: z.string().max(1_000),
});

export const generatedCourseSeedSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(5_000),
  sections: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    lessons: z.array(z.object({
      title: z.string().trim().min(1).max(160),
      objective: z.string().trim().min(1).max(1_000),
      blocks: z.array(generatedBlockSeedSchema).min(2).max(12),
    })).min(1).max(20),
  })).min(1).max(10),
  lessonOverview: z.array(z.object({
    focus: z.string().trim().min(1).max(1_000),
    slideRange: z.string().max(80),
  })).max(20),
  keyTerms: z.array(z.object({
    term: z.string().trim().min(1).max(160),
    definition: z.string().trim().min(1).max(1_000),
  })).max(5),
  preTest: z.array(generatedAssessmentQuestionSchema).max(3),
  postTest: z.array(generatedAssessmentQuestionSchema).max(20),
  lessonSummary: z.string().max(5_000),
  nextLesson: z.string().max(5_000),
}).superRefine((course, context) => {
  const lessonCount = course.sections.reduce((total, section) => total + section.lessons.length, 0);
  if (lessonCount > 20) {
    context.addIssue({
      code: "custom",
      path: ["sections"],
      message: "A generated course can contain at most 20 lessons at a time.",
    });
  }
  const imageCount = course.sections.reduce(
    (total, section) => total + section.lessons.reduce(
      (lessonTotal, lesson) => lessonTotal + lesson.blocks.filter((block) => block.type === "image").length,
      0,
    ),
    0,
  );
  if (imageCount > 3) {
    context.addIssue({
      code: "custom",
      path: ["sections"],
      message: "A generated course can include at most three AI images.",
    });
  }
});

export type CourseGenerationInput = z.infer<typeof courseGenerationInputSchema>;
export type GeneratedCourseSeed = z.infer<typeof generatedCourseSeedSchema>;
export type GeneratedAssessmentQuestion = z.infer<typeof generatedAssessmentQuestionSchema>;

export type GeneratedCourseDraft = {
  title: string;
  description: string;
  sections: { id: string; title: string; order: number }[];
  lessons: {
    id: string;
    sectionId: string;
    title: string;
    icon: "book" | "quiz";
    lessonType: "content" | "quiz";
    order: number;
    passingScore?: number;
    quizQuestions: import("@/lib/schemas/quiz").QuizQuestion[];
    blocks: import("@/lib/schemas/block").ContentBlock[];
  }[];
  template: CourseGenerationInput["template"];
  learningLessonCount: number;
  generatedImageCount: number;
};
