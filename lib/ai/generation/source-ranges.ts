

export function sourceRangesCoverFile(ranges: string[], sourcePageCount: number) {
  let nextSourcePage = 1;
  for (const sourceRange of ranges) {
    const match = /^(?:slides?\s*)?(\d+)\s*[-–]\s*(\d+)$/i.exec(
      sourceRange.trim().replaceAll("\u2013", "-"),
    );
    if (!match) return false;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start !== nextSourcePage || end < start) return false;
    nextSourcePage = end + 1;
  }
  return ranges.length > 0 && nextSourcePage === sourcePageCount + 1;
}

export function normalizeSourceRange(value: string) {
  return value
    .trim()
    .replace(/^(?:slides?|pages?)\s*/i, "")
    .replaceAll("\u2013", "-")
    .replace(/\s*-\s*/g, "-");
}

export function buildFixedSourceRanges(sourcePageCount: number, pagesPerContent: number) {
  return Array.from(
    { length: Math.ceil(sourcePageCount / pagesPerContent) },
    (_, index) => {
      const startPage = index * pagesPerContent + 1;
      return {
        startPage,
        endPage: Math.min(sourcePageCount, startPage + pagesPerContent - 1),
      };
    },
  );
}
