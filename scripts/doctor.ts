import { existsSync } from "node:fs";
import { join } from "node:path";

type CheckResult = {
  label: string;
  ok: boolean;
  detail: string;
};

const cwd = process.cwd();

function checkFile(path: string): CheckResult {
  return {
    label: path,
    ok: existsSync(join(cwd, path)),
    detail: existsSync(join(cwd, path)) ? "present" : "missing"
  };
}

const checks: CheckResult[] = [
  {
    label: "Node.js",
    ok: Number(process.versions.node.split(".")[0]) >= 20,
    detail: process.version
  },
  checkFile("electron/main.cjs"),
  checkFile("electron/preload.cjs"),
  checkFile("src/App.tsx"),
  checkFile("src/core.ts"),
  checkFile("vite.config.ts"),
  checkFile("dist/index.html")
];

let failedRequired = 0;

for (const check of checks) {
  const mark = check.ok ? "OK " : "WARN";
  console.log(`${mark} ${check.label}: ${check.detail}`);
  if (!check.ok) failedRequired += 1;
}

if (failedRequired > 0) {
  console.error(`\n${failedRequired} required checks failed.`);
  process.exit(1);
}

console.log("\nGalCode doctor finished.");
