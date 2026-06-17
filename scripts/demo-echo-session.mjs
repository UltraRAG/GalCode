import { spawnSync } from "node:child_process";

const prompt = process.argv.slice(2).join(" ") || "hello GalCode";
const result = spawnSync("node", ["scripts/echo-agent.mjs", prompt], {
  encoding: "utf8"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const now = new Date().toISOString();
const markdown = [
  "# GalCode Echo Demo",
  "",
  `- Prompt: ${prompt}`,
  `- Generated: ${now}`,
  "",
  "## Expected Agent Output",
  "",
  "```text",
  result.stdout.trimEnd(),
  "```",
  "",
  "Use `Quick Start -> Use Echo Test Agent` in the desktop app, send the same prompt, and compare the raw log."
].join("\n");

console.log(markdown);
