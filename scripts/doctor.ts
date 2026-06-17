import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { defaultAgents } from "../src/core";

type CheckResult = {
  label: string;
  ok: boolean;
  detail: string;
};

const cwd = process.cwd();

function commandPath(command: string) {
  const result = spawnSync("sh", ["-lc", `command -v ${JSON.stringify(command)}`], {
    encoding: "utf8"
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

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
  checkFile("electron/agent-runtime.cjs"),
  checkFile("electron/preload.cjs"),
  checkFile("src/App.tsx"),
  checkFile("src/core.ts"),
  checkFile("scripts/echo-agent.mjs"),
  checkFile("dist/index.html")
];

for (const agent of defaultAgents) {
  const found = commandPath(agent.command);
  checks.push({
    label: `${agent.name} command (${agent.command})`,
    ok: Boolean(found),
    detail: found || "not found in PATH; configure it in Settings after installing"
  });
}

let failedRequired = 0;

for (const check of checks) {
  const mark = check.ok ? "OK " : "WARN";
  console.log(`${mark} ${check.label}: ${check.detail}`);
  if (!check.ok && !check.label.includes("command")) failedRequired += 1;
}

if (failedRequired > 0) {
  console.error(`\n${failedRequired} required checks failed.`);
  process.exit(1);
}

console.log("\nGalCode doctor finished.");
