import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const localFontUrlPattern = /url\((["']?)(\.\/[^)"']+\.woff2?)\1\)/gi;

export async function inlineLocalFontAssets(css: string, assetsDirectory: string) {
  const assetsRoot = resolve(assetsDirectory);
  const fontReferences = [...css.matchAll(localFontUrlPattern)];
  let result = css;

  for (const match of fontReferences) {
    const reference = match[2];
    if (!reference) continue;
    const assetPath = resolve(assetsRoot, reference);
    if (!assetPath.startsWith(`${assetsRoot}${sep}`))
      throw new Error("The course export contains an invalid local font path.");

    const extension = extname(assetPath).toLowerCase();
    const mimeType = extension === ".woff2" ? "font/woff2" : "font/woff";
    const fontData = await readFile(assetPath);
    const dataUrl = `url("data:${mimeType};base64,${fontData.toString("base64")}")`;
    result = result.replaceAll(match[0], dataUrl);
  }

  return result;
}
