import { spawnSync } from "node:child_process";

type AgentProbe = {
  id: "codex" | "claude" | "cursor";
  label: string;
  command: string;
  args: string[];
  expected: string;
  loginCheck: () => { ok: boolean; detail: string };
};

function run(command: string, args: string[], timeout = 120_000) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: [
        `${process.env.HOME}/.local/bin`,
        `${process.env.HOME}/.local/share/node-v24.14.0-darwin-arm64/bin`,
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/Applications/Codex.app/Contents/Resources",
        process.env.PATH || ""
      ].join(":"),
      TERM: "xterm-256color"
    },
    input: "",
    timeout
  });
}

function hasCommand(command: string) {
  const result = run("sh", ["-lc", `command -v ${JSON.stringify(command)}`], 10_000);
  return result.status === 0 ? result.stdout.trim() : "";
}

function oneLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function codexLoginCheck() {
  const result = run("codex", ["doctor", "--summary"], 30_000);
  const output = `${result.stdout}\n${result.stderr}`;
  return {
    ok: output.includes("✓ auth"),
    detail: output.includes("✓ auth") ? "auth configured" : oneLine(output).slice(0, 220)
  };
}

function claudeLoginCheck() {
  const result = run("claude", ["auth", "status"], 30_000);
  const output = `${result.stdout}\n${result.stderr}`;
  return {
    ok: output.includes('"loggedIn": true'),
    detail: oneLine(output).slice(0, 220)
  };
}

function cursorLoginCheck() {
  const result = run("cursor-agent", ["status"], 30_000);
  const output = `${result.stdout}\n${result.stderr}`;
  return {
    ok: result.status === 0 && !output.includes("Not logged in") && !output.includes("Authentication required"),
    detail: oneLine(output).slice(0, 220) || `exit ${result.status ?? "unknown"}`
  };
}

const probes: AgentProbe[] = [
  {
    id: "codex",
    label: "Codex",
    command: "codex",
    args: [
      "exec",
      "--json",
      "--color",
      "never",
      "--skip-git-repo-check",
      "Only print GC_CODEX_OK. Do not edit files."
    ],
    expected: "GC_CODEX_OK",
    loginCheck: codexLoginCheck
  },
  {
    id: "claude",
    label: "Claude Code",
    command: "claude",
    args: ["-p", "--output-format", "text", "Only print GC_CLAUDE_OK. Do not edit files."],
    expected: "GC_CLAUDE_OK",
    loginCheck: claudeLoginCheck
  },
  {
    id: "cursor",
    label: "Cursor Agent",
    command: "cursor-agent",
    args: ["--print", "--output-format", "text", "--trust", "Only print GC_CURSOR_OK. Do not edit files."],
    expected: "GC_CURSOR_OK",
    loginCheck: cursorLoginCheck
  }
];

let failures = 0;

for (const probe of probes) {
  const commandPath = hasCommand(probe.command);
  if (!commandPath) {
    failures += 1;
    console.log(`FAIL ${probe.label}: ${probe.command} not found`);
    continue;
  }

  console.log(`OK   ${probe.label} command: ${commandPath}`);

  const login = probe.loginCheck();
  if (!login.ok) {
    failures += 1;
    console.log(`FAIL ${probe.label} login: ${login.detail}`);
    continue;
  }
  console.log(`OK   ${probe.label} login: ${login.detail}`);

  const result = run(probe.command, probe.args);
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 && output.includes(probe.expected)) {
    console.log(`OK   ${probe.label} prompt: ${probe.expected}`);
  } else {
    failures += 1;
    console.log(`FAIL ${probe.label} prompt: exit ${result.status ?? "unknown"} ${oneLine(output).slice(0, 260)}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} agent probe(s) failed.`);
  process.exit(1);
}

console.log("\nAll GalCode agents passed.");
