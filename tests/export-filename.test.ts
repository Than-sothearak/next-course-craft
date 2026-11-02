import { describe, expect, it } from "vitest";
import { courseExportFilename } from "@/lib/export/filename";

describe("course export filenames", () => {
  it.each([
    ["html", "My Presentation.html"],
    ["scorm12", "My Presentation-scorm-1.2.zip"],
    ["scorm2004", "My Presentation-scorm-2004.zip"],
  ] as const)("names %s downloads using the course title", (format, expected) => {
    expect(courseExportFilename("My Presentation", format)).toBe(expected);
  });

  it.each(["html", "scorm12", "scorm2004"] as const)("preserves Khmer titles in %s downloads", (format) => {
    const title = "មេរៀនភាសាខ្មែរ";
    const suffix = { html: ".html", scorm12: "-scorm-1.2.zip", scorm2004: "-scorm-2004.zip" };
    expect(courseExportFilename(title, format)).toBe(`${title}${suffix[format]}`);
  });

  it("replaces unsafe filename characters and trims trailing dots and spaces", () => {
    expect(courseExportFilename('  Course: A/B\\C?*"<>|\n.  ', "html")).toBe("Course- A-B-C-------.html");
  });

  it("handles empty titles and Windows reserved filenames", () => {
    expect(courseExportFilename(" ... ", "html")).toBe("course.html");
    expect(courseExportFilename("", "scorm12")).toBe("course-scorm-1.2.zip");
    expect(courseExportFilename("CON", "html")).toBe("_CON.html");
  });

  it("keeps existing PDF naming", () => {
    expect(courseExportFilename("My Presentation", "pdf")).toBe("my-presentation.pdf");
  });
});
