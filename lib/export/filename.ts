export type CourseExportFormat = "html" | "pdf" | "scorm12" | "scorm2004";

export function courseExportFilename(title: string, format: CourseExportFormat) {
  if (format === "pdf") {
    const name = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
    return `${name}.pdf`;
  }

  let name = title
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, "-")
    .trim()
    .replace(/[. ]+$/g, "") || "course";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;

  if (format === "html") return `${name}.html`;
  return `${name}-scorm-${format === "scorm12" ? "1.2" : "2004"}.zip`;
}
