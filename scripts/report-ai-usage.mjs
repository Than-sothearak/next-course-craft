import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createUsageReport, formatUsageReport } from "../lib/ai/generation/usage-report.ts";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: npm run report:ai-usage -- [--json] [log-file ...]\nWith no files (or -), read stdin. Reads existing logs only; makes no API requests.");
} else {
  try {
    if (args.some((arg) => arg.startsWith("--") && arg !== "--json")) throw new Error("Unknown option. Use --help.");
    const files = args.filter((arg) => arg !== "--json");
    if ((!files.length || files.includes("-")) && process.stdin.isTTY) throw new Error("Provide a log file or pipe logs through stdin. Use --help.");
    if (files.filter((file) => file === "-").length > 1) throw new Error("Read stdin at most once.");
    const report = createUsageReport();
    for (const file of files.length ? files : ["-"]) {
      const input = file === "-" ? process.stdin : createReadStream(file, { encoding: "utf8" });
      const lines = createInterface({ input, crlfDelay: Infinity });
      try { for await (const line of lines) report.addLine(line); }
      finally { lines.close(); if (file !== "-") input.destroy(); }
    }
    const result = report.result();
    console.log(args.includes("--json") ? JSON.stringify(result, null, 2) : formatUsageReport(result));
  } catch {
    // Do not echo log contents or filesystem error messages into the report.
    console.error("Could not create usage report. Check input files and options; use --help.");
    process.exitCode = 1;
  }
}
