import { defineConfig } from "vite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname),
  base: "./",
  resolve: {
    alias: { "@": resolve(__dirname, "..") },
  },
  plugins: [{
    name: "course-font-license-bundle",
    generateBundle(_options, bundle) {
      const licensesDirectory = resolve(__dirname, "../app/fonts/licenses");
      const licenseFiles = readdirSync(licensesDirectory)
        .filter((fileName) => fileName.endsWith(".txt"))
        .sort();
      const licenseTexts = licenseFiles.map((fileName) => ({
        fileName,
        text: readFileSync(resolve(licensesDirectory, fileName), "utf8"),
      }));

      for (const { fileName, text } of licenseTexts) {
        this.emitFile({
          type: "asset",
          fileName: `assets/font-licenses/${fileName}`,
          source: text,
        });
      }

      const cssLicenseNotices = licenseTexts
        .map(({ fileName, text }) => `Font license: ${fileName}\n${text}`)
        .join("\n\n")
        .replaceAll("*/", "* /");
      for (const output of Object.values(bundle)) {
        if (output.type === "asset" && output.fileName.endsWith(".css"))
          output.source = `${String(output.source)}\n/*!\n${cssLicenseNotices}\n*/\n`;
      }
    },
  }],
  build: { outDir: resolve(__dirname, "../public/course-export"), emptyOutDir: true },
});
