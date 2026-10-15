import { PDFDocument, StandardFonts } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  createPdfPageBatch,
  detectSourceLanguage,
  extractPowerPointPageImages,
  indexSourceDocument,
} from "../lib/ai/source-document";

async function makePdf(pageTexts: string[]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Courier);
  for (const text of pageTexts) {
    const page = document.addPage([612, 792]);
    page.drawText(text, { x: 48, y: 700, size: 12, font });
  }
  return Buffer.from(await document.save());
}

function makePptx() {
  const slide = (text: string) => strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="p" xmlns:a="a"><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:sld>`,
  );
  const files: Record<string, Uint8Array> = {
    "ppt/presentation.xml": strToU8('<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="1" r:id="rId2"/><p:sldId id="2" r:id="rId1"/></p:sldIdLst></p:presentation>'),
    "ppt/_rels/presentation.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="slide" Target="/ppt/slides/slide2.xml"/></Relationships>'),
    "ppt/slides/slide1.xml": slide("Second &amp; later"),
    "ppt/slides/slide2.xml": slide("First in presentation order"),
    "ppt/slides/_rels/slide1.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/picture.png"/><Relationship Id="rId2" Type="notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>'),
    "ppt/media/picture.png": new Uint8Array([137, 80, 78, 71]),
  };
  return Buffer.from(zipSync(files));
}

describe("source document indexing", () => {
  it("counts and reads every PDF page in order and creates bounded page batches", async () => {
    const bytes = await makePdf(["first page", "second page", "third page"]);
    const source = await indexSourceDocument({
      name: "source.pdf",
      contentType: "application/pdf",
      bytes,
    });

    expect(source.pageCount).toBe(3);
    expect(source.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3]);
    expect(source.pages.map((page) => page.text)).toEqual([
      "first page",
      "second page",
      "third page",
    ]);

    const batch = await createPdfPageBatch(bytes, 2, 3);
    const indexedBatch = await indexSourceDocument({
      name: "batch.pdf",
      contentType: "application/pdf",
      bytes: batch,
    });
    expect(indexedBatch.pageCount).toBe(2);
    expect(indexedBatch.pages.map((page) => page.text)).toEqual(["second page", "third page"]);
  });

  it("rejects invalid PDF page ranges instead of silently omitting pages", async () => {
    const bytes = await makePdf(["one page"]);
    await expect(createPdfPageBatch(bytes, 1, 2)).rejects.toThrow("range is invalid");
  });

  it("follows PowerPoint presentation order and extracts only related slide images", async () => {
    const bytes = makePptx();
    const source = await indexSourceDocument({
      name: "source.pptx",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      bytes,
    });

    expect(source.pageCount).toBe(2);
    expect(source.pages.map((page) => page.text)).toEqual([
      "First in presentation order",
      "Second & later",
    ]);
    const images = extractPowerPointPageImages(bytes, 1, 2);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ pageNumber: 2, mimeType: "image/png" });
  });

  it("detects source language without examining generated course text", () => {
    expect(detectSourceLanguage("CSS display properties and flexbox" )).toBe("English");
    expect(detectSourceLanguage("ការរៀន CSS និង flexbox")).toBe("Khmer");
    expect(detectSourceLanguage("  ")).toBe("unknown");
  });
});
