import { z } from "zod";
import { educationalImageDirections, educationalImageLookSchema, educationalImageVisualTypeSchema } from "./educational-image-options";

export const processStepImageRequestSchema = z.object({
  source: z.enum(["step", "block"]).optional(),
  visualType: educationalImageVisualTypeSchema.optional(),
  look: educationalImageLookSchema.optional(),
  title: z.string().trim().max(160).default(""),
  instructions: z.string().trim().max(5000).default(""),
  customPrompt: z.string().trim().max(5000).default(""),
}).refine((input) => Boolean(input.customPrompt || input.instructions), {
  message: "Add step instructions or write custom image instructions.",
});

export function processStepImagePrompt(input: z.infer<typeof processStepImageRequestSchema>) {
  const block = input.source === "block";
  const workingEnvironment = !input.look || input.look === "auto" || input.look === "screenshotUi";
  return [
    block
      ? "Create a practical educational visual that explains the supplied content block. Demonstrate its specific concepts, examples, relationships or actions with a realistic working example, accurate diagram or close-up as appropriate. Do not force informational content into a procedure."
      : "Create a practical visual guide that demonstrates how to carry out this single process step and what its result looks like.",
    "Base the demonstration on the specific actions, objects, tools, values and examples in the image instructions. Show the actual task in progress or a worked example with its result, rather than a generic subject illustration.",
    workingEnvironment ? "When the chosen visual type and look call for a working screen, match the real working environment for the task. For software, create a realistic application screenshot with authentic window layout, toolbars, menus, panels, spacing, icons and crisp interface typography. Use the application named in the instructions. Show the relevant working screen directly, with an annotated interface example only when a subtle highlight helps. Avoid invented generic app interfaces, cartoon computers, floating code cards, infographic layouts, isometric scenes and photographs of people using laptops. These are generated demonstrations, not verified captures of a running application." : "Depict the supplied tools, objects and examples accurately using the selected look; do not force a photographic screenshot or physical photo when an illustration or educational layout was selected.",
    workingEnvironment ? "For web development, use Visual Studio Code (VS Code) unless another editor is explicitly requested. Show a recognizable VS Code workspace with its activity bar, Explorer file tree, correctly named file tabs, line numbers and realistic syntax-highlighted HTML, CSS or JavaScript appropriate to the step. When the step creates or styles a page, show a realistic browser window beside the editor with the matching rendered website or app. The browser result must agree with the visible code, text, colors, spacing and styling. Include the relevant CSS and its visible effect when styling is being taught. Keep simple exercises simple; do not add unrelated features or turn a basic page into an elaborate dashboard. For terminal, setup or debugging steps, focus on the actual terminal, settings or error state needed for that step instead of forcing a browser preview." : "Keep any code, formulas and depicted results accurate and consistent with the content. Keep simple exercises simple and do not add unrelated features.",
    workingEnvironment ? "For other software tasks, use the recognizable interface of the relevant real application and its normal visual style. With Auto look, physical tasks may use a realistic close-up photograph showing the action and materials. Use an accurate diagram or worked example when the chosen visual type calls for one." : "",
    "Use a single focused view, or two to four clearly ordered panels only when needed to explain the supplied actions. Add arrows, highlights or numbered callouts that show exactly where to look and what to do. Keep text minimal: only short labels, necessary interface text or a small worked example. Preserve code syntax and numeric values; translate human-readable text into English. Keep code and worked examples small enough to read. Do not invent product-specific controls, unsupported facts, extra procedure steps or numerical results.",
    "Do not print, quote or paraphrase the step instructions, custom prompt or step title inside the image. Do not add instruction paragraphs, written directions, captions or title banners. Demonstrate the action visually. All visible text must be in English only, even when the supplied instructions or custom prompt use another language.",
    "Make the guide useful beside the written instructions. Avoid decorative cover art, title banners, stock-photo scenes and unrelated imagery.",
    educationalImageDirections(input.visualType, input.look),
    input.title ? `${block ? "Block" : "Step"} title: ${input.title}` : "",
    `Image instructions: ${input.customPrompt || input.instructions}`,
  ].filter(Boolean).join("\n");
}
