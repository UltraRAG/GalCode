const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { buildCommand, parseArgs, pickBestImage, scoreImageForQuery } = require("../electron/agent-runtime.cjs");

assert.deepEqual(parseArgs('exec "{prompt}" --flag value'), ["exec", "{prompt}", "--flag", "value"]);
assert.deepEqual(parseArgs("-p '{prompt}'"), ["-p", "{prompt}"]);

assert.deepEqual(
  buildCommand({ command: "local-chat", args: 'send "{prompt}" --json', mode: "oneshot" }, "hello world"),
  { command: "local-chat", args: ["send", "hello world", "--json"] }
);
assert.deepEqual(
  buildCommand({ command: "node", args: "scripts/echo-agent.mjs", mode: "oneshot" }, "hello world"),
  { command: "node", args: ["scripts/echo-agent.mjs", "hello world"] }
);
assert.deepEqual(
  buildCommand({ command: "local-agent", args: "--print", mode: "interactive" }, "ignored"),
  { command: "local-agent", args: ["--print"] }
);

const candidates = [
  "/theme/backgrounds/room-evening.png",
  "/theme/characters/koharu-smile.png",
  "/theme/characters/shiori-reading.png"
];
assert.equal(scoreImageForQuery(candidates[1], ["koharu", "portrait"]) > 0, true);
assert.equal(pickBestImage(candidates, ["shiori", "reading"]), candidates[2]);

const echo = spawnSync("node", [path.join("scripts", "echo-agent.mjs"), "hello", "agent"], {
  cwd: path.join(__dirname, ".."),
  encoding: "utf8"
});
assert.equal(echo.status, 0);
assert.match(echo.stdout, /GalCode Echo Agent/);
assert.match(echo.stdout, /Prompt: hello agent/);

console.log("runtime ok");
