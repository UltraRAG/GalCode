import { strict as assert } from "node:assert";
import {
  agentKind,
  browserFallbackState,
  buildDirectorStoryDraftPrompt,
  buildDirectorOpeningPrompt,
  buildDirectorUpdatePrompt,
  buildHeroineDraftPrompt,
  buildHeroineSystemPrompt,
  createSaveRecord,
  createModelConfig,
  createCompanionAgent,
  defaultAgents,
  defaultDirectorConfig,
  defaultModelConfig,
  deriveStoryTitle,
  filePathToAssetUrl,
  formatRawEvent,
  isDefaultAgent,
  isChatAgent,
  makeSessionMarkdown,
  mergeTranscriptEntry,
  normalizeGalCodeState,
  restoreSaveRecord,
  splitDialoguePages,
  upsertSaveRecord,
  MAX_SAVE_SLOTS
} from "../src/core";
import type { SaveRecord, StoryState, TranscriptEntry } from "../src/types";

assert.deepEqual(
  defaultAgents.map((agent) => agent.id),
  ["koharu", "shiori", "akari"]
);
assert.equal(defaultAgents.every((agent) => agent.kind === "chat"), true);
assert.equal(defaultAgents.every((agent) => agent.command === ""), true);
assert.equal(isDefaultAgent("koharu"), true);
assert.equal(isDefaultAgent("codex"), false);
assert.equal(agentKind(defaultAgents[0]), "chat");
assert.equal(isChatAgent(defaultAgents[0]), true);

const companionAgent = createCompanionAgent(defaultAgents);
assert.equal(companionAgent.kind, "chat");
assert.equal(companionAgent.custom, true);
assert.match(companionAgent.systemPrompt || "", /视觉小说女主角/);
assert.match(companionAgent.systemPrompt || "", /80-140/);

const migrated = normalizeGalCodeState({
  ...browserFallbackState,
  selectedAgentId: "codex",
  agents: [
    {
      id: "codex",
      kind: "cli",
      name: "Legacy Tool",
      characterName: "Koharu",
      role: "legacy",
      command: "codex",
      args: "{prompt}",
      mode: "oneshot",
      accent: "#fff",
      modelNote: "legacy"
    },
    companionAgent
  ]
});
assert.equal(migrated.agents.some((agent) => agent.id === "codex"), false);
assert.equal(migrated.selectedAgentId, companionAgent.id);
assert.equal(migrated.director?.systemPrompt.includes("视觉小说导演"), true);
assert.equal(migrated.modelConfigs?.length, 1);

const blankModel = createModelConfig([defaultModelConfig]);
const modelState = normalizeGalCodeState({
  ...browserFallbackState,
  modelConfigs: [defaultModelConfig, blankModel]
});
assert.equal(modelState.modelConfigs?.some((config) => config.id === blankModel.id), true);
const blankNameState = normalizeGalCodeState({
  ...browserFallbackState,
  agents: [{ ...defaultAgents[0], characterName: "" }]
});
assert.equal(blankNameState.agents[0].characterName, "");

const story: StoryState = {
  title: "夏日神社的约定",
  opening: "标题：夏日神社的约定\n蝉鸣从参道深处落下来。",
  summary: "用户和女主角们在夏日神社重逢。",
  currentBeat: "小春正准备带用户去看祭典灯笼。",
  generatedAt: "2026-06-18T00:00:00.000Z"
};
assert.match(buildHeroineSystemPrompt(defaultAgents[0], story), /当前剧情标题/);
assert.match(buildHeroineSystemPrompt(defaultAgents[0], story, true), /不要因为排在后面就写得更长/);
assert.match(buildHeroineDraftPrompt(defaultAgents[0], defaultAgents, "雨天旧书店", story), /systemPrompt/);
assert.match(buildHeroineDraftPrompt(defaultAgents[0], defaultAgents, "雨天旧书店", story), /当前剧情草案/);
assert.match(buildHeroineDraftPrompt(defaultAgents[0], defaultAgents, "雨天旧书店", story), /关系破裂/);
assert.match(buildDirectorOpeningPrompt(defaultAgents), /女主角设定/);
assert.match(buildDirectorOpeningPrompt(defaultAgents), /不要让所有矛盾都围绕用户/);
assert.match(
  buildDirectorStoryDraftPrompt({
    agents: defaultAgents,
    userIdea: "雨天旧书店",
    previousStory: story,
    creatorHistory: ["用户：不要太恋爱脑"],
    regenerate: false
  }),
  /关系破裂/
);
assert.match(buildDirectorUpdatePrompt(story, [{ speaker: "user", name: "You", text: "你好" }]), /最近对话/);
assert.equal(deriveStoryTitle("标题：雨后的走廊\n正文"), "雨后的走廊");

const baseEntry: TranscriptEntry = {
  id: "a",
  agentId: "koharu",
  speaker: "agent",
  stream: "stdout",
  text: "hello",
  at: "2026-06-18T00:00:00.000Z"
};
const merged = mergeTranscriptEntry(
  [baseEntry],
  { ...baseEntry, id: "b", text: " world", at: "2026-06-18T00:00:01.000Z" },
  true
);
assert.equal(merged.length, 1);
assert.equal(merged[0].text, "hello world");

const saveSource = normalizeGalCodeState({
  ...browserFallbackState,
  story,
  storyStarted: true,
  transcripts: {
    "koharu:story": [baseEntry]
  }
});
const firstSave = createSaveRecord(saveSource, [], "2026-06-18T00:10:00.000Z");
assert.equal(firstSave.storyTitle, "夏日神社的约定");
assert.equal("saves" in firstSave.snapshot, false);
let saveSlots: SaveRecord[] = [];
for (let index = 0; index < MAX_SAVE_SLOTS + 2; index += 1) {
  const nextSave = createSaveRecord(saveSource, saveSlots, `2026-06-18T00:${String(index).padStart(2, "0")}:00.000Z`);
  saveSlots = upsertSaveRecord(saveSlots, nextSave);
}
assert.equal(saveSlots.length, MAX_SAVE_SLOTS);
const restored = restoreSaveRecord({ ...saveSource, saves: saveSlots }, firstSave);
assert.equal(restored.story?.title, "夏日神社的约定");
assert.equal(restored.saves?.length, MAX_SAVE_SLOTS);

assert.equal(
  filePathToAssetUrl("/Users/meisen/My Assets/heroine.png"),
  "galcode-asset://local/Users/meisen/My%20Assets/heroine.png"
);

assert.equal(formatRawEvent({ type: "output", sessionId: "s", at: "t", stream: "stdout", text: "ok" }), "[stdout] ok");

assert.deepEqual(
  splitDialoguePages("你好。这里是第二句。第三句。", { maxCharsPerLine: 24, maxLinesPerPage: 2 }),
  ["你好。\n这里是第二句。", "第三句。"]
);
assert.equal(splitDialoguePages("", { maxCharsPerLine: 8, maxLinesPerPage: 2 })[0], "...");
assert.equal(
  splitDialoguePages("这是一段会被软切的很长很长很长很长很长的对白。", {
    maxCharsPerLine: 10,
    maxLinesPerPage: 1
  }).length > 1,
  true
);

const markdown = makeSessionMarkdown({
  sessionId: "koharu:story",
  workspace: "GalCode Web",
  agent: defaultAgents[0],
  story,
  transcript: [baseEntry],
  runs: [
    {
      id: "run",
      agentId: "koharu",
      prompt: "你好",
      startedAt: "2026-06-18T00:00:00.000Z",
      endedAt: "2026-06-18T00:00:05.000Z",
      status: "completed",
      exitCode: 0,
      outputChars: 5
    }
  ],
  rawLog: "[小春] hello"
});
assert.match(markdown, /# GalCode Session/);
assert.match(markdown, /夏日神社的约定/);
assert.match(markdown, /小春 \(Koharu\)/);
assert.match(defaultDirectorConfig.systemPrompt, /不要出现代码/);

console.log("smoke ok");
