export type AgentMode = "interactive" | "oneshot";

export type AgentConfig = {
  id: string;
  name: string;
  characterName: string;
  role: string;
  command: string;
  args: string;
  mode: AgentMode;
  accent: string;
  modelNote: string;
  portraitPath?: string;
  custom?: boolean;
};

export type TranscriptEntry = {
  id: string;
  agentId: string;
  speaker: "user" | "agent" | "system";
  text: string;
  at: string;
  stream?: "stdout" | "stderr";
  runId?: string;
};

export type RunRecord = {
  id: string;
  agentId: string;
  prompt: string;
  startedAt: string;
  endedAt?: string;
  status: "running" | "completed" | "failed" | "stopped";
  exitCode?: number | null;
  signal?: string | null;
  outputChars: number;
};

export type GalCodeState = {
  version: number;
  workspace: string;
  selectedAgentId: string;
  themeId: string;
  assetPackPath?: string;
  backgroundPath?: string;
  agents: AgentConfig[];
  transcripts: Record<string, TranscriptEntry[]>;
  runs: Record<string, RunRecord[]>;
};

export type AgentEvent =
  | {
      sessionId: string;
      at: string;
      runId?: string;
      type: "output";
      stream: "stdout" | "stderr";
      text: string;
      hidden?: boolean;
    }
  | {
      sessionId: string;
      at: string;
      runId?: string;
      type: "status";
      level: "info" | "warn" | "error";
      message: string;
    }
  | {
      sessionId: string;
      at: string;
      runId?: string;
      type: "error";
      message: string;
    }
  | {
      sessionId: string;
      at: string;
      runId?: string;
      type: "exit";
      code: number | null;
      signal: string | null;
      message: string;
    };

export type GalCodeBridge = {
  loadState: () => Promise<GalCodeState>;
  saveState: (state: GalCodeState) => Promise<GalCodeState>;
  chooseWorkspace: () => Promise<string | null>;
  chooseImageAsset: () => Promise<string | null>;
  importThemeFolder: (agents: AgentConfig[]) => Promise<{
    root: string;
    imageCount: number;
    backgroundPath?: string;
    portraits: Record<string, string>;
  } | null>;
  checkAgent: (agent: AgentConfig) => Promise<{ ok: boolean; path?: string; message: string }>;
  loginAgent: (payload: {
    agent: AgentConfig;
    workspace: string;
  }) => Promise<{ ok: boolean; message: string; command?: string }>;
  exportMarkdown: (payload: { defaultName: string; markdown: string }) => Promise<{ ok: boolean; path?: string }>;
  startAgent: (payload: {
    sessionId: string;
    runId?: string;
    agent: AgentConfig;
    workspace: string;
    prompt?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  sendToAgent: (payload: {
    sessionId: string;
    runId?: string;
    agent: AgentConfig;
    workspace: string;
    prompt: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  stopAgent: (sessionId: string) => Promise<{ ok: boolean; stopped: boolean }>;
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void;
};

declare global {
  interface Window {
    galcode?: GalCodeBridge;
  }
}
