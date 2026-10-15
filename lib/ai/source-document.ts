import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// Register PDF.js's Node fallback handler as a normal module so Turbopack does not
// resolve its default relative worker URL against a generated server chunk.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { strFromU8, unzipSync } from "fflate";

export type SourceDocumentFile = {
  name: string;
  contentType:
    | "application/pdf"
    | "application/vnd.ms-powerpoint"
    | "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  bytes: Buffer;
};

export type IndexedSourcePage = {
  pageNumber: number;
  text: string;
};

export type IndexedSourceDocument = {
  pageCount: number;
  pages: IndexedSourcePage[];
  sourceLanguage: string;
};

const maximumSourcePages = 500;

export async function indexSourceDocument(
  sourceFile: SourceDocumentFile,
): Promise<IndexedSourceDocument> {
  if (sourceFile.contentType === "application/pdf")
    return indexPdf(sourceFile.bytes);
  if (
    sourceFile.contentType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return indexPowerPoint(sourceFile.bytes);
  throw new Error(
    "Legacy .ppt files cannot be indexed reliably. Save the presentation as .pptx or PDF and upload it again.",
  );
}

async function indexPdf(bytes: Buffer): Promise<IndexedSourceDocument> {
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    stopAtErrors: true,
  });
  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages < 1 || pdf.numPages > maximumSourcePages)
      throw new Error(`PDFs must contain between 1 and ${maximumSourcePages} pages.`);

    const pages: IndexedSourcePage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = "";
      let previousRight: number | undefined;
      let previousY: number | undefined;
      let previousFontSize = 0;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        const fontSize = Math.hypot(item.transform[0], item.transform[1]);
        if (
          line &&
          previousY !== undefined &&
          Math.abs(y - previousY) > Math.max(fontSize, previousFontSize) * 0.45
        ) {
          lines.push(line);
          line = "";
          previousRight = undefined;
        }
        if (
          line &&
          previousRight !== undefined &&
          x - previousRight > Math.max(fontSize, previousFontSize) * 0.24 &&
          !line.endsWith(" ") &&
          !item.str.startsWith(" ")
        ) {
          line += " ";
        }
        line += item.str;
        previousRight = x + item.width;
        previousY = y;
        previousFontSize = fontSize;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
          previousRight = undefined;
          previousY = undefined;
        }
      }
      if (line.trim()) lines.push(line);
      pages.push({ pageNumber, text: lines.join("\n").trim() });
      page.cleanup();
    }
    return {
      pageCount: pdf.numPages,
      pages,
      sourceLanguage: detectSourceLanguage(pages.map((page) => page.text).join("\n")),
    };
  } finally {
    await loadingTask.destroy();
  }
}

function indexPowerPoint(bytes: Buffer): IndexedSourceDocument {
  const files = unzipSync(new Uint8Array(bytes));
  const presentationXml = files["ppt/presentation.xml"];
  const relationshipsXml = files["ppt/_rels/presentation.xml.rels"];
  if (!presentationXml || !relationshipsXml)
    throw new Error("This PPTX file is missing its slide list or relationships.");

  const relationships = parseRelationships(strFromU8(relationshipsXml));

  const orderedSlideIds = [...strFromU8(presentationXml).matchAll(/<p:sldId\b([^>]*)\/?\s*>/g)]
    .map(([, attributes]) => /\br:id="([^"]+)"/.exec(attributes)?.[1])
    .filter((id): id is string => Boolean(id));
  if (!orderedSlideIds.length || orderedSlideIds.length > maximumSourcePages)
    throw new Error(`PowerPoint files must contain between 1 and ${maximumSourcePages} slides.`);

  const pages = orderedSlideIds.map((relationshipId, index) => {
    const target = relationships.get(relationshipId);
    if (!target) throw new Error(`PowerPoint slide ${index + 1} could not be located.`);
    const slidePath = resolveZipTarget("ppt", target);
    const slideXml = files[slidePath];
    if (!slideXml) throw new Error(`PowerPoint slide ${index + 1} could not be read.`);
    return {
      pageNumber: index + 1,
      text: extractPowerPointSlideText(strFromU8(slideXml)),
    };
  });

  return {
    pageCount: pages.length,
    pages,
    sourceLanguage: detectSourceLanguage(pages.map((page) => page.text).join("\n")),
  };
}

export async function createPdfPageBatch(
  bytes: Buffer,
  firstPage: number,
  lastPage: number,
) {
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  if (firstPage < 1 || lastPage < firstPage || lastPage > source.getPageCount())
    throw new Error("The requested PDF page range is invalid.");
  const batch = await PDFDocument.create();
  const pages = await batch.copyPages(
    source,
    Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage - 1 + index),
  );
  for (const page of pages) batch.addPage(page);
  return Buffer.from(await batch.save({ useObjectStreams: true }));
}

export function extractPowerPointPageImages(
  bytes: Buffer,
  firstPage: number,
  lastPage: number,
) {
  const files = unzipSync(new Uint8Array(bytes));
  const presentationXml = files["ppt/presentation.xml"];
  const relationshipsXml = files["ppt/_rels/presentation.xml.rels"];
  if (!presentationXml || !relationshipsXml) return [];

  const presentationRelationships = parseRelationships(strFromU8(relationshipsXml));
  const slideIds = [...strFromU8(presentationXml).matchAll(/<p:sldId\b([^>]*)\/?\s*>/g)]
    .map(([, attributes]) => /\br:id="([^"]+)"/.exec(attributes)?.[1])
    .filter((id): id is string => Boolean(id));
  const images: { pageNumber: number; mimeType: string; bytes: Buffer }[] = [];

  for (let pageNumber = firstPage; pageNumber <= Math.min(lastPage, slideIds.length); pageNumber += 1) {
    const slideTarget = presentationRelationships.get(slideIds[pageNumber - 1]);
    if (!slideTarget) continue;
    const slidePath = resolveZipTarget("ppt", slideTarget);
    const slideFileName = slidePath.split("/").at(-1);
    if (!slideFileName) continue;
    const relationshipPath = slidePath.replace(
      `/${slideFileName}`,
      `/_rels/${slideFileName}.rels`,
    );
    const slideRelationshipsXml = files[relationshipPath];
    if (!slideRelationshipsXml) continue;

    for (const target of parseRelationships(strFromU8(slideRelationshipsXml), true).values()) {
      const imagePath = resolveZipTarget("ppt/slides", target);
      const image = files[imagePath];
      const mimeType = imageMimeType(imagePath);
      if (!image || !mimeType || image.length > 8 * 1024 * 1024) continue;
      images.push({ pageNumber, mimeType, bytes: Buffer.from(image) });
      if (images.filter((item) => item.pageNumber === pageNumber).length >= 4) break;
    }
  }
  return images;
}

function parseRelationships(xml: string, includeImages = false) {
  const relationships = new Map<string, string>();
  for (const [, attributes] of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    const id = /\bId="([^"]+)"/.exec(attributes)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attributes)?.[1];
    const type = /\bType="([^"]+)"/.exec(attributes)?.[1] ?? "";
    if (!id || !target || (includeImages && !type.endsWith("/image"))) continue;
    relationships.set(id, decodeXml(target));
  }
  return relationships;
}

function extractPowerPointSlideText(xml: string) {
  return [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
    .map(([, paragraph]) => [...paragraph.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map(([, text]) => decodeXml(text))
      .join(""),
    )
    .filter(Boolean)
    .join("\n");
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([\da-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeZipPath(value: string) {
  const parts: string[] = [];
  for (const part of value.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveZipTarget(baseDirectory: string, target: string) {
  let decodedTarget = target;
  try {
    decodedTarget = decodeURIComponent(target);
  } catch {
    // Keep the literal package path when it contains malformed URI escapes.
  }
  return normalizeZipPath(
    decodedTarget.startsWith("/")
      ? decodedTarget.slice(1)
      : `${baseDirectory}/${decodedTarget}`,
  );
}

function imageMimeType(path: string) {
  const extension = path.toLowerCase().split(".").at(-1);
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return undefined;
}

export function detectSourceLanguage(value: string) {
  const total = [...value.trim()].length;
  if (!total) return "unknown";
  const count = (pattern: RegExp) => [...value.matchAll(pattern)].length;
  if (count(/[\u1780-\u17ff]/gu) > 0) return "Khmer";
  if (count(/[\u3040-\u30ff]/gu) > 0) return "Japanese";
  if (count(/[\u4e00-\u9fff]/gu) > 0) return "Chinese";
  if (count(/[\uac00-\ud7af]/gu) > 0) return "Korean";
  if (count(/[\u0400-\u04ff]/gu) > 0) return "Russian";
  if (count(/[\u0600-\u06ff]/gu) > 0) return "Arabic";
  return "English";
}
