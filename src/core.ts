import type { AgentConfig, GalCodeState, RunRecord, TranscriptEntry, AgentEvent } from "./types";

export const defaultAgents: AgentConfig[] = [
  {
    id: "codex",
    name: "Codex",
    characterName: "Koharu",
    role: "Reliable engineering heroine",
    command: "codex",
    args: 'exec --json --color never --skip-git-repo-check "{prompt}"',
    mode: "oneshot",
    accent: "#e56b6f",
    modelNote: "OpenAI local coding agent"
  },
  {
    id: "claude",
    name: "Claude Code",
    characterName: "Shiori",
    role: "Long-context strategist",
    command: "claude",
    args: '-p --output-format text "{prompt}"',
    mode: "oneshot",
    accent: "#2a9d8f",
    modelNote: "Anthropic coding agent"
  },
  {
    id: "cursor",
    name: "Cursor",
    characterName: "Akari",
    role: "IDE-native action partner",
    command: "cursor-agent",
    args: '--print --output-format text --trust "{prompt}"',
    mode: "oneshot",
    accent: "#f4a261",
    modelNote: "Cursor CLI agent"
  }
];

export const browserFallbackState: GalCodeState = {
  version: 1,
  workspace: "",
  selectedAgentId: "codex",
  themeId: "wa-koi-default",
  agents: defaultAgents,
  transcripts: {},
  runs: {}
};

export function createCustomAgent(existingAgents: AgentConfig[]): AgentConfig {
  const nextNumber = existingAgents.filter((agent) => agent.id.startsWith("custom-agent")).length + 1;
  const id = uniqueAgentId(`custom-agent-${nextNumber}`, existingAgents);
  return {
    id,
    name: `Custom Agent ${nextNumber}`,
    characterName: `Mika ${nextNumber}`,
    role: "User-configured local coding agent",
    command: "node",
    args: 'scripts/echo-agent.mjs "{prompt}"',
    mode: "oneshot",
    accent: "#8ab17d",
    modelNote: "Custom local agent",
    custom: true
  };
}

export function isDefaultAgent(agentId: string) {
  return defaultAgents.some((agent) => agent.id === agentId);
}

export function echoAgentPatch(): Pick<AgentConfig, "command" | "args" | "mode" | "modelNote"> {
  return {
    command: "node",
    args: 'scripts/echo-agent.mjs "{prompt}"',
    mode: "oneshot",
    modelNote: "Local deterministic Echo test agent"
  };
}

function uniqueAgentId(baseId: string, existingAgents: AgentConfig[]) {
  const ids = new Set(existingAgents.map((agent) => agent.id));
  if (!ids.has(baseId)) return baseId;
  let suffix = 2;
  while (ids.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

export function mergeTranscriptEntry(
  currentTranscript: TranscriptEntry[],
  entry: TranscriptEntry,
  mergeOutput = false
) {
  const lastEntry = currentTranscript.at(-1);
  if (mergeOutput && lastEntry && lastEntry.speaker === entry.speaker && lastEntry.stream === entry.stream) {
    return [
      ...currentTranscript.slice(0, -1),
      {
        ...lastEntry,
        text: `${lastEntry.text}${entry.text}`,
        at: entry.at
      }
    ];
  }
  return [...currentTranscript, entry];
}

export function formatRawEvent(event: AgentEvent) {
  if (event.type === "output") return `[${event.stream}] ${event.text}`;
  if (event.type === "exit") return `\n[exit] ${event.message}\n`;
  return `\n[${event.type}] ${event.message}\n`;
}

export function makeSessionMarkdown({
  sessionId,
  workspace,
  agent,
  transcript,
  runs,
  rawLog
}: {
  sessionId: string;
  workspace: string;
  agent?: AgentConfig;
  transcript: TranscriptEntry[];
  runs: RunRecord[];
  rawLog: string;
}) {
  const lines = [
    "# GalCode Session",
    "",
    `- Session: \`${sessionId}\``,
    `- Workspace: \`${workspace || "browser preview"}\``,
    `- Agent: ${agent ? `${agent.characterName} (${agent.name})` : "unknown"}`,
    `- Exported: ${new Date().toISOString()}`,
    "",
    "## Runs",
    ""
  ];

  if (runs.length === 0) {
    lines.push("_No runs recorded._", "");
  } else {
    for (const run of runs) {
      lines.push(
        `- ${run.status.toUpperCase()} ${run.startedAt}${run.endedAt ? ` -> ${run.endedAt}` : ""}`,
        `  - Prompt: ${run.prompt.replace(/\s+/g, " ").slice(0, 180)}`,
        `  - Output chars: ${run.outputChars}`,
        `  - Exit: ${run.exitCode ?? ""}${run.signal ? ` ${run.signal}` : ""}`
      );
    }
    lines.push("");
  }

  lines.push("## Transcript", "");
  for (const entry of transcript) {
    lines.push(`### ${entry.speaker.toUpperCase()} ${entry.at}`, "", "```text", entry.text.trimEnd(), "```", "");
  }

  if (rawLog.trim()) {
    lines.push("## Raw Log", "", "```text", rawLog.trimEnd(), "```", "");
  }

  return lines.join("\n");
}

export function filePathToAssetUrl(filePath: string) {
  const normalized = filePath.replaceAll("\\", "/");
  const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `galcode-asset://local${absolute.split("/").map(encodeURIComponent).join("/")}`;
}
