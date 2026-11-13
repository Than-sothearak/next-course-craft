import { z } from "zod";
import { randomUUID } from "node:crypto";
import { DashboardError } from "@/lib/dashboard/rules";
import { courseOutlineSchema, normalizePreLearnPostOutline, type CourseOutline } from "../course-generation-session-schema";
import type { CourseGenerationInput, GeneratedSourceInventory } from "../course-generation-schemas";
import { requestStructuredJson } from "./provider";
import { generateSourcePlan } from "./source-generation-content";
import { learnerLanguageStyleInstruction } from "./language";
import { createGenerationBudget } from "../generation-retry";
import { generationStageTimeoutMs } from "../generation-timeouts";

export async function planGenerationSession(input: CourseGenerationInput, model: string, inventory?: GeneratedSourceInventory) {
  const sourcePlan = inventory ? await generateSourcePlan(input, model, inventory) : null;
  let sections: CourseOutline["sections"];
  if (sourcePlan) {
    sections = [{ id: randomUUID(), title: "Learn", lessons: sourcePlan.items.map((item, sourceIndex) => ({ id: randomUUID(), title: item.title, objective: item.focus, kind: "learn", sourceIndex })) }];
  } else {
    const budget = createGenerationBudget(generationStageTimeoutMs);
    const raw = await requestStructuredJson({
      model, budget, timeoutMs: generationStageTimeoutMs, schemaName: "course_outline",
      developerPrompt: "Plan an educational course outline only. Do not write lesson content. Return clear section names, lesson titles and measurable learning objectives.",
      content: [{ type: "input_text", text: `${JSON.stringify(input)}\nReturn exactly ${input.lessonCount} learning lessons total. ${input.template === "preLearnPost" ? "Return one Learn section containing all learning lessons. The application adds Pre and Post activities separately." : "Group related lessons into meaningful sections."} ${learnerLanguageStyleInstruction(input.targetLanguage)}` }],
      maxOutputTokens: 7_000,
      schema: { type: "object", additionalProperties: false, required: ["title", "description", "sections"], properties: {
        title: { type: "string", minLength: 1, maxLength: 160 }, description: { type: "string", minLength: 1, maxLength: 5_000 },
        sections: { type: "array", minItems: 1, maxItems: input.template === "preLearnPost" ? 1 : 10, items: { type: "object", additionalProperties: false, required: ["title", "lessons"], properties: {
          title: { type: "string", minLength: 1, maxLength: 160 }, lessons: { type: "array", minItems: 1, maxItems: 20, items: { type: "object", additionalProperties: false, required: ["title", "objective"], properties: { title: { type: "string", minLength: 1, maxLength: 160 }, objective: { type: "string", minLength: 1, maxLength: 1_000 } } } },
        } } },
      } },
    });
    // Runtime validation remains authoritative even with provider structured output.
    const parsed = z.object({ title: z.string(), description: z.string(), sections: z.array(z.object({ title: z.string(), lessons: z.array(z.object({ title: z.string(), objective: z.string() })) })) }).parse(raw);
    if (parsed.sections.flatMap((section) => section.lessons).length !== input.lessonCount)
      throw new DashboardError("The outline has an incorrect lesson count. Generate the outline again.", 422);
    sections = parsed.sections.map((section) => ({ ...section, id: randomUUID(), lessons: section.lessons.map((lesson) => ({ ...lesson, id: randomUUID(), kind: "learn" as const })) }));
    return { outline: addActivities(courseOutlineSchema.parse({ ...parsed, title: input.courseTitle.trim() || parsed.title, description: input.courseDescription.trim() || parsed.description, sections }), input), sourcePlan };
  }
  return { outline: addActivities(courseOutlineSchema.parse({ title: sourcePlan!.title, description: sourcePlan!.description, sections }), input), sourcePlan };
}

function addActivities(outline: CourseOutline, input: CourseGenerationInput): CourseOutline {
  if (input.template !== "preLearnPost") return outline;
  const item = (kind: CourseOutline["sections"][number]["lessons"][number]["kind"], title: string) => ({ id: randomUUID(), title, objective: title, kind });
  const khmer = input.targetLanguage === "Khmer";
  return normalizePreLearnPostOutline({ ...outline, sections: [
    { id: randomUUID(), title: khmer ? "សកម្មភាពមុនរៀន" : "Pre activities", lessons: [item("description", khmer ? "ការពិពណ៌នាវគ្គសិក្សា" : "Course description"), item("overview", khmer ? "ទិដ្ឋភាពទូទៅនៃមេរៀន" : "Lesson overview"), item("keywords", khmer ? "ពាក្យគន្លឹះ" : "Keywords"), item("preTest", khmer ? "តេស្តមុនរៀន" : "Pre-test")] },
    ...outline.sections,
    { id: randomUUID(), title: khmer ? "សកម្មភាពក្រោយរៀន" : "Post activities", lessons: [item("postTest", khmer ? "តេស្តក្រោយរៀន" : "Post-test"), item("summary", khmer ? "សេចក្តីសង្ខេបមេរៀន" : "Lesson summary"), item("next", khmer ? "មេរៀនបន្ទាប់" : "Next lesson")] },
  ] }, input.targetLanguage);
}
