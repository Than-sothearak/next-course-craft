import PDFDocument from "pdfkit";
import { join } from "node:path";
import { Asset } from "@/models/Asset";
import { getCourseEditor } from "@/lib/editor/services/course";
import { DashboardError } from "@/lib/dashboard/rules";
import { storedMediaBytes } from "@/lib/media/service";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { getHandoutBlockText, getQuizQuestionHandoutText, htmlToHandoutText } from "./content";

const assetUrlPattern = /\/api\/assets\/([\da-f]{24})\/file\b/gi;
const maxMediaBytes = 200 * 1024 * 1024;
const maxMediaFiles = 2_000;
const pageMargins = { top: 54, bottom: 54, left: 52, right: 52 };
const contentWidth = 595.28 - pageMargins.left - pageMargins.right;
const supportedImageTypes = new Set(["image/jpeg", "image/png"]);

type HandoutSnapshot = ReturnType<typeof parseScorm12Snapshot>;
type HandoutAsset = { mimeType: string; bytes: Buffer };

function fontForCharacter(character: string): "HandoutLatin" | "HandoutLatinExt" | "HandoutKhmer" {
  const codePoint = character.codePointAt(0) ?? 0;
  if ((codePoint >= 0x1780 && codePoint <= 0x17ff) || (codePoint >= 0x19e0 && codePoint <= 0x19ff)) return "HandoutKhmer";
  if ((codePoint >= 0x0100 && codePoint <= 0x02ff) || (codePoint >= 0x1e00 && codePoint <= 0x1eff)) return "HandoutLatinExt";
  return "HandoutLatin";
}

function textRuns(value: string) {
  const runs: Array<{ font: ReturnType<typeof fontForCharacter>; text: string }> = [];
  for (const character of value) {
    const font = fontForCharacter(character);
    const previous = runs[runs.length - 1];
    if (previous?.font === font) previous.text += character;
    else runs.push({ font, text: character });
  }
  return runs;
}

function writeText(
  doc: PDFKit.PDFDocument,
  text: string,
  { size = 10, color = "#334155", lineGap = 3 } = {},
) {
  const safeText = htmlToHandoutText(text);
  if (!safeText) return;
  const runs = textRuns(safeText);
  doc.fontSize(size).fillColor(color);
  runs.forEach((run, index) => {
    doc.font(run.font).text(run.text, {
      width: contentWidth,
      lineGap,
      continued: index < runs.length - 1,
    });
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - pageMargins.bottom) doc.addPage();
}

function addParagraph(doc: PDFKit.PDFDocument, text: string, options?: { size?: number; color?: string; after?: number }) {
  const cleaned = htmlToHandoutText(text);
  if (!cleaned) return;
  ensureSpace(doc, 28);
  writeText(doc, cleaned, options);
  doc.moveDown(options?.after === undefined ? 0.35 : options.after / 10);
}

function assetIdFromSource(source: string) {
  return source.match(/\/api\/assets\/([\da-f]{24})\/file\b/i)?.[1]?.toLowerCase();
}

function drawImage(doc: PDFKit.PDFDocument, source: string, assets: Map<string, HandoutAsset>) {
  const id = assetIdFromSource(source);
  const asset = id ? assets.get(id) : undefined;
  if (!asset || !supportedImageTypes.has(asset.mimeType)) return false;
  ensureSpace(doc, 190);
  const startY = doc.y;
  try {
    doc.image(asset.bytes, pageMargins.left, startY, {
      fit: [contentWidth, 168],
      align: "center",
      valign: "center",
    });
    doc.y = startY + 178;
    return true;
  } catch {
    return false;
  }
}

function addBlockImages(doc: PDFKit.PDFDocument, block: HandoutSnapshot["lessons"][number]["blocks"][number], assets: Map<string, HandoutAsset>) {
  switch (block.type) {
    case "image":
      return drawImage(doc, block.data.src, assets);
    case "gallery":
      block.data.images.forEach((image) => {
        if (drawImage(doc, image.src, assets) && image.alt) addParagraph(doc, `Image: ${image.alt}`, { size: 9, color: "#64748b" });
      });
      return false;
    case "labeledGraphic":
      if (block.data.interactionMode === "spotTarget") return false;
      return drawImage(doc, block.data.src, assets);
    case "flipCard":
      block.data.cards.forEach((card) => {
        if (card.front.type === "image") drawImage(doc, card.front.src, assets);
        if (card.back.type === "image") drawImage(doc, card.back.src, assets);
      });
      return false;
    default:
      return false;
  }
}

function renderLesson(doc: PDFKit.PDFDocument, lesson: HandoutSnapshot["lessons"][number], index: number, assets: Map<string, HandoutAsset>) {
  ensureSpace(doc, 56);
  doc.moveDown(0.7);
  writeText(doc, `${index + 1}. ${htmlToHandoutText(lesson.titleHtml || lesson.title)}`, { size: 17, color: "#0f172a" });
  doc.moveDown(0.6);

  if (lesson.lessonType === "quiz") {
    lesson.quizQuestions.forEach((question, questionIndex) => {
      const lines = getQuizQuestionHandoutText(question, questionIndex);
      addParagraph(doc, lines[0] ?? `Question ${questionIndex + 1}`, { size: 11, color: "#1e293b", after: 3 });
      if (question.imageSrc) drawImage(doc, question.imageSrc, assets);
      if (question.imageAlt) addParagraph(doc, `Image: ${question.imageAlt}`, { size: 9, color: "#64748b" });
      question.choices.forEach((choice, choiceIndex) => {
        addParagraph(doc, `${choiceIndex + 1}. ${choice.text || choice.imageAlt || "[Image answer]"}`, { size: 10, after: 2 });
        if (choice.imageSrc) drawImage(doc, choice.imageSrc, assets);
      });
      doc.moveDown(0.35);
    });
    return;
  }

  lesson.blocks.forEach((block) => {
    const hasImage = addBlockImages(doc, block, assets);
    const lines = getHandoutBlockText(block);
    if (block.type === "image" && lines.length) {
      lines.filter((line) => !hasImage || line !== `Image: ${block.data.alt}`).forEach((line) => addParagraph(doc, line));
      return;
    }
    if (block.type === "heading") {
      lines.forEach((line) => {
        ensureSpace(doc, 32);
        writeText(doc, line, { size: block.data.level === 1 ? 16 : block.data.level === 2 ? 14 : 12, color: "#1e293b" });
        doc.moveDown(0.35);
      });
      return;
    }
    lines.forEach((line) => addParagraph(doc, line));
  });
}

function addPageFooters(doc: PDFKit.PDFDocument) {
  const pages = doc.bufferedPageRange();
  for (let pageIndex = pages.start; pageIndex < pages.start + pages.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const footerY = doc.page.height - pageMargins.bottom + 16;
    doc.save();
    doc.strokeColor("#e2e8f0").lineWidth(0.6)
      .moveTo(pageMargins.left, footerY - 10)
      .lineTo(doc.page.width - pageMargins.right, footerY - 10)
      .stroke();
    doc.font("HandoutLatin").fontSize(8).fillColor("#64748b");
    doc.text("Course handout", pageMargins.left, footerY, { lineBreak: false });
    doc.text(`${pageIndex + 1} / ${pages.count}`, doc.page.width - pageMargins.right - 50, footerY, {
      width: 50,
      align: "right",
      lineBreak: false,
    });
    doc.restore();
  }
}

export async function renderCourseHandoutPdf(
  course: HandoutSnapshot,
  authorName: string,
  assets: Map<string, HandoutAsset> = new Map(),
) {
  const doc = new PDFDocument({
    size: "A4",
    margins: pageMargins,
    bufferPages: true,
    info: {
      Title: course.title,
      Author: course.authorVisible ? authorName : "",
      Subject: "Course handout",
    },
  });
  doc.registerFont("HandoutLatin", join(process.cwd(), "lib", "pdf", "fonts", "noto-sans-latin.woff"));
  doc.registerFont("HandoutLatinExt", join(process.cwd(), "lib", "pdf", "fonts", "noto-sans-latin-ext.woff"));
  doc.registerFont("HandoutKhmer", join(process.cwd(), "lib", "pdf", "fonts", "noto-sans-khmer.woff"));

  writeText(doc, course.title, { size: 24, color: "#0f172a", lineGap: 5 });
  doc.moveDown(0.5);
  if (course.authorVisible && authorName.trim()) addParagraph(doc, `By ${authorName.trim()}`, { size: 9, color: "#64748b", after: 5 });
  const description = htmlToHandoutText(course.descriptionHtml || course.description);
  if (description) addParagraph(doc, description, { size: 11, color: "#475569", after: 12 });

  const lessonsBySection = new Map<string, HandoutSnapshot["lessons"]>();
  for (const lesson of [...course.lessons].sort((left, right) => left.order - right.order)) {
    lessonsBySection.set(lesson.sectionId, [...(lessonsBySection.get(lesson.sectionId) ?? []), lesson]);
  }
  for (const section of [...course.sections].sort((left, right) => left.order - right.order)) {
    const lessons = lessonsBySection.get(section.id) ?? [];
    if (!lessons.length) continue;
    ensureSpace(doc, 42);
    doc.moveDown(0.9);
    writeText(doc, section.title, { size: 19, color: "#334155" });
    doc.moveDown(0.45);
    lessons.forEach((lesson, index) => renderLesson(doc, lesson, index, assets));
  }

  addPageFooters(doc);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

async function loadReferencedImages(course: HandoutSnapshot, ownerId: string, courseId: string) {
  const ids = new Set([...JSON.stringify(course).matchAll(assetUrlPattern)].map((match) => match[1].toLowerCase()));
  if (ids.size > maxMediaFiles) {
    throw new DashboardError("This PDF handout exceeds the 2,000 media file limit. Remove some media and try again.", 413);
  }
  const records = ids.size
    ? await Asset.find({ _id: { $in: [...ids] }, ownerId, courseId, status: "ready" }).lean()
    : [];
  if (records.length !== ids.size) {
    throw new DashboardError("One or more course media files could not be included. Check that they still belong to this course.", 409);
  }

  const images = records.filter((asset) => supportedImageTypes.has(asset.mimeType.split(";")[0].trim().toLowerCase()));
  const totalBytes = images.reduce((total, asset) => total + asset.size, 0);
  if (totalBytes > maxMediaBytes) {
    throw new DashboardError("This PDF handout exceeds the 200 MB image limit. Remove some images and try again.", 413);
  }

  const result = new Map<string, HandoutAsset>();
  for (let offset = 0; offset < images.length; offset += 8) {
    const batch = await Promise.all(images.slice(offset, offset + 8).map(async (asset) => {
      const id = String(asset._id).toLowerCase();
      const mimeType = asset.mimeType.split(";")[0].trim().toLowerCase();
      const bytes = await storedMediaBytes(asset);
      if (bytes.length !== asset.size) throw new DashboardError(`Image ${asset.originalName} changed while it was being exported.`, 409);
      return { id, mimeType, bytes };
    }));
    batch.forEach(({ id, mimeType, bytes }) => result.set(id, { mimeType, bytes }));
  }
  return result;
}

export async function buildCourseHandoutPdf({ ownerId, courseId, authorName }: { ownerId: string; courseId: string; authorName: string }) {
  const editorCourse = await getCourseEditor(ownerId, courseId);
  const course = parseScorm12Snapshot(editorCourse);
  const images = await loadReferencedImages(course, ownerId, courseId);
  const pdf = await renderCourseHandoutPdf(course, authorName, images);
  const filename = `${course.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course"}.pdf`;
  return { pdf, filename };
}
