import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname),
  base: "./",
  build: { outDir: resolve(__dirname, "../public/course-player"), emptyOutDir: true },
});
