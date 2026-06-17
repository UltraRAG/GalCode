import { strict as assert } from "node:assert";
import {
  createCustomAgent,
  defaultAgents,
  echoAgentPatch,
  filePathToAssetUrl,
  formatRawEvent,
  isDefaultAgent,
  makeSessionMarkdown,
  mergeTranscriptEntry
} from "../src/core";
import type { TranscriptEntry } from "../src/types";

assert.deepEqual(
  defaultAgents.map((agent) => agent.id),
  ["codex", "claude", "cursor"]
);

assert.equal(defaultAgents.every((agent) => agent.mode === "oneshot"), true);
assert.equal(defaultAgents.find((agent) => agent.id === "codex")?.args, 'exec --json --color never --skip-git-repo-check "{prompt}"');
assert.equal(isDefaultAgent("codex"), true);
assert.equal(isDefaultAgent("custom-agent-1"), false);
const customAgent = createCustomAgent(defaultAgents);
assert.equal(customAgent.id, "custom-agent-1");
assert.equal(customAgent.custom, true);
assert.equal(customAgent.command, "node");
assert.equal(customAgent.args, 'scripts/echo-agent.mjs "{prompt}"');
assert.deepEqual(echoAgentPatch(), {
  command: "node",
  args: 'scripts/echo-agent.mjs "{prompt}"',
  mode: "oneshot",
  modelNote: "Local deterministic Echo test agent"
});

const baseEntry: TranscriptEntry = {
  id: "a",
  agentId: "codex",
  speaker: "agent",
  stream: "stdout",
  text: "hello",
  at: "2026-06-17T00:00:00.000Z"
};
const merged = mergeTranscriptEntry(
  [baseEntry],
  { ...baseEntry, id: "b", text: " world", at: "2026-06-17T00:00:01.000Z" },
  true
);
assert.equal(merged.length, 1);
assert.equal(merged[0].text, "hello world");

assert.equal(
  filePathToAssetUrl("/Users/meisen/My Assets/codex.png"),
  "galcode-asset://local/Users/meisen/My%20Assets/codex.png"
);

assert.equal(formatRawEvent({ type: "output", sessionId: "s", at: "t", stream: "stdout", text: "ok" }), "[stdout] ok");

const markdown = makeSessionMarkdown({
  sessionId: "codex:/tmp/project",
  workspace: "/tmp/project",
  agent: defaultAgents[0],
  transcript: [baseEntry],
  runs: [
    {
      id: "run",
      agentId: "codex",
      prompt: "Explain the repo",
      startedAt: "2026-06-17T00:00:00.000Z",
      endedAt: "2026-06-17T00:00:05.000Z",
      status: "completed",
      exitCode: 0,
      outputChars: 5
    }
  ],
  rawLog: "[stdout] hello"
});
assert.match(markdown, /# GalCode Session/);
assert.match(markdown, /Koharu \(Codex\)/);
assert.match(markdown, /COMPLETED/);

console.log("smoke ok");
