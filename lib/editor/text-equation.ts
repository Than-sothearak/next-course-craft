import katex, { type KatexOptions } from "katex";
import { z } from "zod";

export const equationSourceSchema = z.string().trim().min(1, "Enter an equation.").max(5000, "Keep the equation to 5,000 characters or fewer.");
export const equationRenderOptions: KatexOptions = {
  output: "htmlAndMathml", trust: false, maxExpand: 1000, maxSize: 20,
  throwOnError: true,
};

export function previewEquation(source: string, displayMode = false) {
  const parsed = equationSourceSchema.safeParse(source);
  if (!parsed.success) return { html: "", error: parsed.error.issues[0].message };
  try {
    return { html: katex.renderToString(parsed.data, { ...equationRenderOptions, displayMode }), error: "" };
  } catch (error) {
    return { html: "", error: error instanceof Error ? error.message.replace(/^KaTeX parse error: /, "") : "Check the LaTeX syntax." };
  }
}

export const equationTemplates = [
  { label: "Fraction", source: "\\frac{a}{b}" },
  { label: "Root", source: "\\sqrt{x}" },
  { label: "Power", source: "x^{2}" },
  { label: "Sum", source: "\\sum_{i=1}^{n} i" },
  { label: "Integral", source: "\\int_{a}^{b} f(x)\\,dx" },
  { label: "Matrix", source: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
] as const;
