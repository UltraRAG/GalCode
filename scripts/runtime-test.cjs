const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { buildCommand, parseArgs, pickBestImage, scoreImageForQuery } = require("../electron/agent-runtime.cjs");

assert.deepEqual(parseArgs('exec "{prompt}" --flag value'), ["exec", "{prompt}", "--flag", "value"]);
assert.deepEqual(parseArgs("-p '{prompt}'"), ["-p", "{prompt}"]);

assert.deepEqual(
  buildCommand({ command: "codex", args: 'exec --json --color never --skip-git-repo-check "{prompt}"', mode: "oneshot" }, "hello world"),
  { command: "codex", args: ["exec", "--json", "--color", "never", "--skip-git-repo-check", "hello world"] }
);
assert.deepEqual(
  buildCommand({ command: "node", args: "scripts/echo-agent.mjs", mode: "oneshot" }, "hello world"),
  { command: "node", args: ["scripts/echo-agent.mjs", "hello world"] }
);
assert.deepEqual(
  buildCommand({ command: "cursor-agent", args: "--print", mode: "interactive" }, "ignored"),
  { command: "cursor-agent", args: ["--print"] }
);

const candidates = [
  "/theme/backgrounds/room-evening.png",
  "/theme/characters/codex-koharu.png",
  "/theme/characters/claude-shiori.png"
];
assert.equal(scoreImageForQuery(candidates[1], ["codex", "portrait"]) > 0, true);
assert.equal(pickBestImage(candidates, ["claude", "shiori"]), candidates[2]);

const echo = spawnSync("node", [path.join("scripts", "echo-agent.mjs"), "hello", "agent"], {
  cwd: path.join(__dirname, ".."),
  encoding: "utf8"
});
assert.equal(echo.status, 0);
assert.match(echo.stdout, /GalCode Echo Agent/);
assert.match(echo.stdout, /Prompt: hello agent/);

console.log("runtime ok");
