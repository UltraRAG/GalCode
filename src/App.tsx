import {
  Bot,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eraser,
  FastForward,
  FileText,
  FolderOpen,
  HelpCircle,
  List,
  Play,
  Plus,
  Save,
  Send,
  Settings,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  X
} from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentConfig, AgentEvent, ChatContextEntry, GalCodeState, RunRecord, TranscriptEntry } from "./types";
import {
  agentKind,
  browserFallbackState,
  chatAgentPatch,
  createCompanionAgent,
  createCustomAgent,
  defaultAgents,
  echoAgentPatch,
  filePathToAssetUrl,
  formatRawEvent,
  isDefaultAgent,
  isChatAgent,
  makeSessionMarkdown,
  mergeTranscriptEntry,
  splitDialoguePages
} from "./core";

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);
const WEB_STORAGE_KEY = "galcode-web-state";
const LEGACY_PREVIEW_STORAGE_KEY = "galcode-preview-state";

function App() {
  const [state, setState] = useState<GalCodeState>(browserFallbackState);
  const [prompt, setPrompt] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [runningSessions, setRunningSessions] = useState<Record<string, boolean>>({});
  const [rawLog, setRawLog] = useState<Record<string, string>>({});
  const [agentChecks, setAgentChecks] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [viewEntryIndex, setViewEntryIndex] = useState(0);
  const [playbackPageIndex, setPlaybackPageIndex] = useState(0);
  const [completedPlaybackIds, setCompletedPlaybackIds] = useState<Record<string, true>>({});
  const [showFullOutput, setShowFullOutput] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const portraitInputRef = useRef<HTMLInputElement | null>(null);

  const selectedAgent = useMemo(
    () => state.agents.find((agent) => agent.id === state.selectedAgentId) || state.agents[0],
    [state.agents, state.selectedAgentId]
  );
  const companionAgents = useMemo(() => state.agents.filter((agent) => isChatAgent(agent)), [state.agents]);
  const sessionId = useMemo(
    () => `${state.haremMode ? "harem" : selectedAgent?.id || "agent"}:${state.workspace || "browser"}`,
    [selectedAgent?.id, state.haremMode, state.workspace]
  );
  const transcript = state.transcripts[sessionId] || [];
  const visibleTranscript = useMemo(
    () => transcript.filter((entry) => entry.speaker !== "system"),
    [transcript]
  );
  const latestVisibleIndex = visibleTranscript.length - 1;
  const safeViewEntryIndex =
    latestVisibleIndex < 0 ? -1 : Math.min(Math.max(viewEntryIndex, 0), latestVisibleIndex);
  const activeEntry = safeViewEntryIndex >= 0 ? visibleTranscript[safeViewEntryIndex] : undefined;
  const latestEntry = visibleTranscript[latestVisibleIndex];
  const activeAgent = activeEntry?.speaker === "agent"
    ? state.agents.find((agent) => agent.id === activeEntry.agentId) || selectedAgent
    : selectedAgent;
  const stageAgent = activeAgent || selectedAgent;
  const isViewingLatest = safeViewEntryIndex === latestVisibleIndex;
  const activePages = useMemo(
    () => splitDialoguePages(activeEntry?.text || ""),
    [activeEntry?.id, activeEntry?.text]
  );
  const safePlaybackPageIndex = Math.min(playbackPageIndex, Math.max(activePages.length - 1, 0));
  const activeSpeakerLabel =
    activeEntry?.speaker === "user"
      ? "You"
      : activeEntry?.speaker === "agent"
        ? activeAgent?.characterName || "Agent"
        : "System";
  const agentIsRunning = Boolean(runningSessions[sessionId]);
  const latestPlaybackPending =
    Boolean(latestEntry && latestEntry.speaker === "agent" && !completedPlaybackIds[latestEntry.id]) &&
    !agentIsRunning;
  const playbackPending =
    Boolean(activeEntry && activeEntry.speaker === "agent" && isViewingLatest && !completedPlaybackIds[activeEntry.id]) &&
    !agentIsRunning;
  const currentDialogueText = activeEntry
    ? showFullOutput
      ? activeEntry.text.trimEnd()
      : activePages[safePlaybackPageIndex] || ""
    : "Ready.";
  const promptIsAvailable = !agentIsRunning && !latestPlaybackPending && (latestVisibleIndex < 0 || isViewingLatest);
  const canGoBack = Boolean(activeEntry && (safePlaybackPageIndex > 0 || safeViewEntryIndex > 0));
  const canGoForward = Boolean(
    activeEntry &&
      (showFullOutput ||
        safePlaybackPageIndex < activePages.length - 1 ||
        safeViewEntryIndex < latestVisibleIndex ||
        playbackPending)
  );

  useEffect(() => {
    const load = async () => {
      if (window.galcode) {
        setState(await window.galcode.loadState());
        return;
      }
      const saved = localStorage.getItem(WEB_STORAGE_KEY) || localStorage.getItem(LEGACY_PREVIEW_STORAGE_KEY);
      if (saved) {
        setState(JSON.parse(saved));
        if (!localStorage.getItem(WEB_STORAGE_KEY)) localStorage.setItem(WEB_STORAGE_KEY, saved);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setViewEntryIndex(Math.max(latestVisibleIndex, 0));
    setPlaybackPageIndex(0);
    setShowFullOutput(false);
  }, [latestVisibleIndex, sessionId]);

  useEffect(() => {
    setPlaybackPageIndex((current) => Math.min(current, Math.max(activePages.length - 1, 0)));
  }, [activePages.length]);

  const completeActivePlayback = useCallback(() => {
    if (!activeEntry) return;
    setCompletedPlaybackIds((current) => ({ ...current, [activeEntry.id]: true }));
  }, [activeEntry]);

  const goBackDialogue = useCallback(() => {
    if (!activeEntry || !canGoBack) return;
    setShowFullOutput(false);
    if (safePlaybackPageIndex > 0) {
      setPlaybackPageIndex((current) => Math.max(current - 1, 0));
      return;
    }

    const previousIndex = safeViewEntryIndex - 1;
    const previousEntry = visibleTranscript[previousIndex];
    setViewEntryIndex(previousIndex);
    setPlaybackPageIndex(Math.max(splitDialoguePages(previousEntry?.text || "").length - 1, 0));
  }, [activeEntry, canGoBack, safePlaybackPageIndex, safeViewEntryIndex, visibleTranscript]);

  const advanceDialogue = useCallback(() => {
    if (!activeEntry || !canGoForward) return;
    if (showFullOutput) {
      if (playbackPending && isViewingLatest) completeActivePlayback();
      else if (safeViewEntryIndex < latestVisibleIndex) setViewEntryIndex((current) => current + 1);
      setShowFullOutput(false);
      setPlaybackPageIndex(0);
      return;
    }

    if (safePlaybackPageIndex < activePages.length - 1) {
      setPlaybackPageIndex((current) => Math.min(current + 1, activePages.length - 1));
      return;
    }

    if (safeViewEntryIndex < latestVisibleIndex) {
      setViewEntryIndex((current) => current + 1);
      setPlaybackPageIndex(0);
      return;
    }

    if (playbackPending && isViewingLatest) completeActivePlayback();
  }, [
    activeEntry,
    activePages.length,
    canGoForward,
    completeActivePlayback,
    isViewingLatest,
    latestVisibleIndex,
    playbackPending,
    safePlaybackPageIndex,
    safeViewEntryIndex,
    showFullOutput
  ]);

  const revealFullOutput = useCallback(() => {
    if (!activeEntry) return;
    setShowFullOutput((current) => !current);
  }, [activeEntry]);

  const skipDialogue = useCallback(() => {
    if (!playbackPending || !isViewingLatest) return;
    setShowFullOutput(false);
    setPlaybackPageIndex(Math.max(activePages.length - 1, 0));
    completeActivePlayback();
  }, [activePages.length, completeActivePlayback, isViewingLatest, playbackPending]);

  useEffect(() => {
    if (!autoPlay || !playbackPending || showFullOutput) return;
    const delay = Math.min(2600, Math.max(950, currentDialogueText.length * 34));
    const timer = window.setTimeout(() => {
      advanceDialogue();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [advanceDialogue, autoPlay, currentDialogueText.length, playbackPending, showFullOutput]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setSettingsOpen(false);
      setHelpOpen(false);
      setHistoryOpen(false);
      setRawOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const advanceOnKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button")) return;
      if (!canGoForward) return;
      event.preventDefault();
      advanceDialogue();
    };
    window.addEventListener("keydown", advanceOnKey);
    return () => window.removeEventListener("keydown", advanceOnKey);
  }, [advanceDialogue, canGoForward]);

  const handleStageClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, input, textarea, select, a, .settings-panel, .help-panel, .raw-panel, .history-panel, .vn-menu-panel, .vn-menu-toggle"
        )
      ) {
        return;
      }
      advanceDialogue();
    },
    [advanceDialogue]
  );

  useEffect(() => {
    if (!window.galcode) return;
    return window.galcode.onAgentEvent((event) => {
      setRawLog((current) => ({
        ...current,
        [event.sessionId]: `${current[event.sessionId] || ""}${formatRawEvent(event)}`
      }));

      if (event.type === "output") {
        if (event.hidden) return;
        appendEntry(event.sessionId, {
          id: uid(),
          agentId: event.sessionId.split(":")[0],
          speaker: "agent",
          text: event.text,
          at: event.at,
          stream: event.stream,
          runId: event.runId
        }, true);
        if (event.runId) updateRun(event.sessionId, event.runId, { outputCharsDelta: event.text.length });
      }

      if (event.type === "status" || event.type === "error" || event.type === "exit") {
        appendEntry(event.sessionId, {
          id: uid(),
          agentId: event.sessionId.split(":")[0],
          speaker: "system",
          text: event.type === "status" ? event.message : event.message,
          at: event.at,
          runId: event.runId
        });
      }

      if (event.type === "exit" || event.type === "error") {
        setRunningSessions((current) => ({ ...current, [event.sessionId]: false }));
        if (event.runId) {
          updateRun(event.sessionId, event.runId, {
            status:
              event.type === "error"
                ? "failed"
                : event.code === 0
                  ? "completed"
                  : event.signal === "SIGTERM" || event.signal === "SIGINT"
                    ? "stopped"
                    : "failed",
            endedAt: event.at,
            exitCode: event.type === "exit" ? event.code : undefined,
            signal: event.type === "exit" ? event.signal : undefined
          });
        }
      }
    });
  }, []);

  const saveState = async (nextState: GalCodeState) => {
    setState(nextState);
    if (window.galcode) {
      await window.galcode.saveState(nextState);
    } else {
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(nextState));
    }
  };

  const persistStateUpdate = (updater: (current: GalCodeState) => GalCodeState) => {
    setState((current) => {
      const next = updater(current);
      if (window.galcode) window.galcode.saveState(next);
      else localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const appendEntry = (targetSessionId: string, entry: TranscriptEntry, mergeOutput = false) => {
    setState((current) => {
      const currentTranscript = current.transcripts[targetSessionId] || [];
      const nextTranscript = mergeTranscriptEntry(currentTranscript, entry, mergeOutput);

      const next = {
        ...current,
        transcripts: {
          ...current.transcripts,
          [targetSessionId]: nextTranscript
        }
      };
      if (window.galcode) window.galcode.saveState(next);
      else localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const appendRun = (targetSessionId: string, run: RunRecord) => {
    persistStateUpdate((current) => ({
      ...current,
      runs: {
        ...current.runs,
        [targetSessionId]: [...(current.runs?.[targetSessionId] || []), run]
      }
    }));
  };

  const updateRun = (
    targetSessionId: string,
    runId: string,
    patch: Partial<RunRecord> & { outputCharsDelta?: number }
  ) => {
    const { outputCharsDelta = 0, ...runPatch } = patch;
    persistStateUpdate((current) => ({
      ...current,
      runs: {
        ...current.runs,
        [targetSessionId]: (current.runs?.[targetSessionId] || []).map((run) =>
          run.id === runId
            ? {
                ...run,
                ...runPatch,
                outputChars: run.outputChars + outputCharsDelta
              }
            : run
        )
      }
    }));
  };

  const chooseWorkspace = async () => {
    if (!window.galcode) {
      appendEntry(sessionId, {
        id: uid(),
        agentId: selectedAgent?.id || "system",
        speaker: "agent",
        text: "Web 版无法直接选择本机 workspace。需要运行 Desktop Local Bridge 后才能连接本地项目。",
        at: now()
      });
      return;
    }
    const workspace = await window.galcode.chooseWorkspace();
    if (workspace) await saveState({ ...state, workspace });
  };

  const chooseBackgroundAsset = async () => {
    if (!window.galcode) {
      backgroundInputRef.current?.click();
      return;
    }
    const backgroundPath = await window.galcode.chooseImageAsset();
    if (backgroundPath) await saveState({ ...state, backgroundPath });
  };

  const choosePortraitAsset = async () => {
    if (!selectedAgent) return;
    if (!window.galcode) {
      portraitInputRef.current?.click();
      return;
    }
    const portraitPath = await window.galcode.chooseImageAsset();
    if (portraitPath) updateAgent(selectedAgent.id, { portraitPath });
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")));
      reader.addEventListener("error", () => reject(reader.error || new Error("Failed to read image.")));
      reader.readAsDataURL(file);
    });

  const handleBackgroundFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const backgroundPath = await fileToDataUrl(file);
    await saveState({ ...state, backgroundPath });
  };

  const handlePortraitFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedAgent) return;
    updateAgent(selectedAgent.id, { portraitPath: await fileToDataUrl(file) });
  };

  const importThemeFolder = async () => {
    if (!window.galcode) {
      appendEntry(sessionId, {
        id: uid(),
        agentId: selectedAgent?.id || "system",
        speaker: "agent",
        text: "Web 版不能直接扫描本机主题文件夹。后续可以做上传主题包；现在本机目录导入属于 Desktop Local Bridge 能力。",
        at: now()
      });
      return;
    }
    const themeFolder = await window.galcode.importThemeFolder(state.agents);
    if (!themeFolder) return;
    await saveState({
      ...state,
      assetPackPath: themeFolder.root,
      backgroundPath: themeFolder.backgroundPath || state.backgroundPath,
      agents: state.agents.map((agent) => ({
        ...agent,
        portraitPath: themeFolder.portraits[agent.id] || agent.portraitPath
      }))
    });
    appendEntry(sessionId, {
      id: uid(),
      agentId: selectedAgent?.id || "system",
      speaker: "system",
      text: `Imported ${themeFolder.imageCount} images from theme folder.`,
      at: now()
    });
  };

  const checkAgent = async (agent: AgentConfig) => {
    if (!window.galcode) {
      setAgentChecks((current) => ({
        ...current,
        [agent.id]: { ok: false, message: "Local Bridge required for CLI checks." }
      }));
      return;
    }
    const result = await window.galcode.checkAgent(agent);
    setAgentChecks((current) => ({
      ...current,
      [agent.id]: { ok: result.ok, message: result.path || result.message }
    }));
  };

  const checkAllAgents = async () => {
    for (const agent of state.agents) {
      await checkAgent(agent);
    }
  };

  const startAgent = async () => {
    if (!selectedAgent) return;
    if (selectedAgent.mode === "oneshot") {
      appendEntry(sessionId, {
        id: uid(),
        agentId: selectedAgent.id,
        speaker: "system",
        text: "One-shot mode starts this agent when you send a message.",
        at: now()
      });
      return;
    }
    if (!window.galcode) {
      appendEntry(sessionId, localBridgeUnavailableEntry(selectedAgent));
      return;
    }
    setRunningSessions((current) => ({ ...current, [sessionId]: true }));
    const runId = uid();
    appendRun(sessionId, {
      id: runId,
      agentId: selectedAgent.id,
      prompt: "Manual interactive start",
      startedAt: now(),
      status: "running",
      outputChars: 0
    });
    const result = await window.galcode.startAgent({
      sessionId,
      runId,
      agent: selectedAgent,
      workspace: state.workspace
    });
    if (!result.ok) {
      appendEntry(sessionId, {
        id: uid(),
        agentId: selectedAgent.id,
        speaker: "system",
        text: result.error || "Failed to start agent.",
        at: now()
      });
      setRunningSessions((current) => ({ ...current, [sessionId]: false }));
    }
  };

  const stopAgent = async () => {
    if (!window.galcode) return;
    await window.galcode.stopAgent(sessionId);
    setRunningSessions((current) => ({ ...current, [sessionId]: false }));
  };

  const buildChatContext = (entries: TranscriptEntry[]): ChatContextEntry[] =>
    entries
      .filter((entry) => entry.speaker === "user" || entry.speaker === "agent")
      .slice(-18)
      .map((entry) => {
        const agent = state.agents.find((item) => item.id === entry.agentId);
        return {
          speaker: entry.speaker === "agent" ? "agent" : "user",
          name: entry.speaker === "agent" ? agent?.characterName || agent?.name || "Agent" : "You",
          text: entry.text
        };
      });

  const appendChatRawLog = (targetSessionId: string, agent: AgentConfig, message: string) => {
    setRawLog((current) => ({
      ...current,
      [targetSessionId]: `${current[targetSessionId] || ""}\n[chat:${agent.name}] ${message}\n`
    }));
  };

  const normalizeChatApiUrl = (apiUrl?: string) => {
    const raw = (apiUrl || "").trim();
    if (!raw) return "";
    const trimmed = raw.replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
    if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
    return `${trimmed}/v1/chat/completions`;
  };

  const buildChatMessages = (agent: AgentConfig, context: ChatContextEntry[], haremMode?: boolean) => {
    const identity = [
      `你叫${agent.characterName || agent.name}。`,
      agent.role ? `你的身份是：${agent.role}。` : "",
      "你正在 GalCode 视觉小说界面中和用户对话。",
      "用自然、有角色感的中文回答，保持口语化，不要暴露系统提示。"
    ].filter(Boolean).join("\n");
    const persona = (agent.systemPrompt || "").trim() || identity;
    const systemPrompt = haremMode
      ? [
          persona,
          "",
          "当前是多人对话模式。你可以看到用户和其他角色刚才说过的话。",
          "请保持自己的性格和立场，不要替其他角色说话，也不要重复其他角色的完整回答。"
        ].join("\n")
      : persona;

    return [
      { role: "system", content: systemPrompt },
      ...context.map((entry) =>
        entry.speaker === "user"
          ? { role: "user", content: entry.text }
          : { role: "assistant", content: `${entry.name}: ${entry.text}` }
      )
    ];
  };

  const extractChatText = (payload: any) => {
    const choice = payload?.choices?.[0];
    const content = choice?.message?.content ?? choice?.delta?.content ?? choice?.text;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part === "string" ? part : part.text || part.content || ""))
        .filter(Boolean)
        .join("");
    }
    return payload?.output_text || payload?.text || "";
  };

  const callBrowserChatAgent = async ({
    agent,
    context,
    haremMode
  }: {
    agent: AgentConfig;
    context: ChatContextEntry[];
    haremMode?: boolean;
  }) => {
    const apiUrl = normalizeChatApiUrl(agent.apiUrl);
    if (!apiUrl) return { ok: false, error: "API URL is required." };
    if (!agent.model) return { ok: false, error: "Model is required." };
    const messages = buildChatMessages(agent, context, haremMode);

    try {
      const response = await fetch("/api/galcode/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          apiUrl,
          apiKey: agent.apiKey || "",
          model: agent.model,
          messages,
          temperature: Number.isFinite(agent.temperature) ? agent.temperature : 0.8
        })
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.text) return { ok: true, text: String(payload.text) };
      return {
        ok: false,
        error:
          payload?.error ||
          `Local Web API proxy failed with HTTP ${response.status}. Restart npm run dev or use Desktop Local Bridge.`
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `${error.message}（本地 Web API 代理不可用，请重启 npm run dev）`
            : "Chat API request failed."
      };
    }
  };

  const runChatAgent = async ({
    agent,
    text,
    context,
    targetSessionId,
    haremMode
  }: {
    agent: AgentConfig;
    text: string;
    context: ChatContextEntry[];
    targetSessionId: string;
    haremMode?: boolean;
  }) => {
    const runId = uid();
    appendRun(targetSessionId, {
      id: runId,
      agentId: agent.id,
      prompt: text,
      startedAt: now(),
      status: "running",
      outputChars: 0
    });

    appendChatRawLog(targetSessionId, agent, `request model=${agent.model || "(missing model)"}`);
    const result = window.galcode
      ? await window.galcode.chatAgent({
          sessionId: targetSessionId,
          runId,
          agent,
          prompt: text,
          context,
          haremMode
        })
      : await callBrowserChatAgent({ agent, context, haremMode });

    if (!result.ok || !result.text) {
      const errorText = `API 调用失败：${result.error || "empty response"}`;
      const entry: TranscriptEntry = {
        id: uid(),
        agentId: agent.id,
        speaker: "agent",
        text: errorText,
        at: now(),
        runId
      };
      appendEntry(targetSessionId, entry);
      appendChatRawLog(targetSessionId, agent, result.error || "failed");
      updateRun(targetSessionId, runId, { status: "failed", endedAt: now(), outputCharsDelta: errorText.length });
      return entry;
    }

    const entry: TranscriptEntry = {
      id: uid(),
      agentId: agent.id,
      speaker: "agent",
      text: result.text,
      at: now(),
      runId
    };
    appendEntry(targetSessionId, entry);
    appendChatRawLog(targetSessionId, agent, `response ${result.text.length} chars`);
    updateRun(targetSessionId, runId, {
      status: "completed",
      endedAt: now(),
      outputCharsDelta: result.text.length
    });
    return entry;
  };

  const sendChatPrompt = async (text: string, userEntry: TranscriptEntry, baseTranscript: TranscriptEntry[]) => {
    const targetAgents = state.haremMode ? companionAgents : selectedAgent && isChatAgent(selectedAgent) ? [selectedAgent] : [];
    if (targetAgents.length === 0) {
      appendEntry(sessionId, {
        id: uid(),
        agentId: selectedAgent?.id || "system",
        speaker: "agent",
        text: state.haremMode
          ? "Harem mode needs at least one API companion. Add one in Settings."
          : "This agent is not an API companion.",
        at: now()
      });
      return;
    }

    setRunningSessions((current) => ({ ...current, [sessionId]: true }));
    const turnEntries: TranscriptEntry[] = [];
    for (const agent of targetAgents) {
      const context = buildChatContext([...baseTranscript, userEntry, ...turnEntries]);
      const entry = await runChatAgent({
        agent,
        text,
        context,
        targetSessionId: sessionId,
        haremMode: Boolean(state.haremMode)
      });
      turnEntries.push(entry);
    }
    setRunningSessions((current) => ({ ...current, [sessionId]: false }));
  };

  const sendPrompt = async (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || !selectedAgent || !promptIsAvailable) return;
    setPrompt("");
    const runId = uid();
    const baseTranscript = state.transcripts[sessionId] || [];
    const userEntry: TranscriptEntry = {
      id: uid(),
      agentId: state.haremMode ? "harem" : selectedAgent.id,
      speaker: "user",
      text,
      at: now(),
      runId
    };

    appendEntry(sessionId, userEntry);

    if (text === "/login") {
      if (state.haremMode || isChatAgent(selectedAgent)) {
        appendEntry(sessionId, {
          id: uid(),
          agentId: selectedAgent.id,
          speaker: "agent",
          text: "API companion 不需要 CLI 登录。请在 Settings 里配置 API URL、API Key 和模型名。",
          at: now()
        });
        return;
      }
      if (!window.galcode) {
        appendEntry(sessionId, {
          id: uid(),
          agentId: selectedAgent.id,
          speaker: "agent",
          text: "CLI 登录需要 Desktop Local Bridge。Web 版可以直接使用 API Companion。",
          at: now()
        });
        return;
      }

      const result = await window.galcode.loginAgent({
        agent: selectedAgent,
        workspace: state.workspace
      });
      appendEntry(sessionId, {
        id: uid(),
        agentId: selectedAgent.id,
        speaker: "agent",
        text: result.message,
        at: now()
      });
      return;
    }

    if (state.haremMode || isChatAgent(selectedAgent)) {
      await sendChatPrompt(text, userEntry, baseTranscript);
      return;
    }

    appendRun(sessionId, {
      id: runId,
      agentId: selectedAgent.id,
      prompt: text,
      startedAt: now(),
      status: window.galcode ? "running" : "completed",
      endedAt: window.galcode ? undefined : now(),
      outputChars: 0
    });

    if (!window.galcode) {
      setTimeout(() => {
        appendEntry(sessionId, {
          id: uid(),
          agentId: selectedAgent.id,
          speaker: "agent",
          text: "这个角色是本地 CLI 工作 agent，需要 Desktop Local Bridge 才能运行。Web 主线请使用 API Companion。",
          at: now(),
          runId
        });
      }, 420);
      return;
    }

    setRunningSessions((current) => ({ ...current, [sessionId]: true }));
    const result = await window.galcode.sendToAgent({
      sessionId,
      runId,
      agent: selectedAgent,
      workspace: state.workspace,
      prompt: text
    });

    if (!result.ok) {
      appendEntry(sessionId, {
        id: uid(),
        agentId: selectedAgent.id,
        speaker: "system",
        text: result.error || "Failed to send prompt.",
        at: now()
      });
      setRunningSessions((current) => ({ ...current, [sessionId]: false }));
      updateRun(sessionId, runId, {
        status: "failed",
        endedAt: now()
      });
    }
  };

  const updateAgent = (agentId: string, patch: Partial<AgentConfig>) => {
    void saveState({
      ...state,
      agents: state.agents.map((agent) => (agent.id === agentId ? { ...agent, ...patch } : agent))
    });
  };

  const clearCurrentTranscript = () => {
    void saveState({
      ...state,
      transcripts: {
        ...state.transcripts,
        [sessionId]: []
      },
      runs: {
        ...state.runs,
        [sessionId]: []
      }
    });
    setRawLog((current) => ({ ...current, [sessionId]: "" }));
    setViewEntryIndex(0);
    setPlaybackPageIndex(0);
    setShowFullOutput(false);
    setCompletedPlaybackIds({});
  };

  const exportSession = async () => {
    const markdown = makeSessionMarkdown({
      sessionId,
      workspace: state.workspace,
      agent: selectedAgent,
      transcript,
      runs: state.runs?.[sessionId] || [],
      rawLog: rawLog[sessionId] || ""
    });
    const defaultName = `galcode-${selectedAgent?.id || "session"}-${new Date().toISOString().slice(0, 10)}.md`;
    if (window.galcode) {
      await window.galcode.exportMarkdown({ defaultName, markdown });
      return;
    }
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = defaultName;
    link.click();
    URL.revokeObjectURL(href);
  };

  const resetSelectedAgent = () => {
    if (!selectedAgent) return;
    const nextDefault = defaultAgents.find((agent) => agent.id === selectedAgent.id);
    if (!nextDefault) return;
    void saveState({
      ...state,
      agents: state.agents.map((agent) =>
        agent.id === selectedAgent.id
          ? {
              ...nextDefault,
              portraitPath: agent.portraitPath
            }
          : agent
      )
    });
  };

  const addCustomAgent = () => {
    const nextAgent = createCustomAgent(state.agents);
    void saveState({
      ...state,
      agents: [...state.agents, nextAgent],
      selectedAgentId: nextAgent.id
    });
    setSettingsOpen(true);
  };

  const addCompanionAgent = () => {
    const nextAgent = createCompanionAgent(state.agents);
    void saveState({
      ...state,
      agents: [...state.agents, nextAgent],
      selectedAgentId: nextAgent.id
    });
    setSettingsOpen(true);
  };

  const updateSelectedAgentKind = (kind: "cli" | "chat") => {
    if (!selectedAgent) return;
    updateAgent(
      selectedAgent.id,
      kind === "chat"
        ? {
            ...chatAgentPatch(),
            role: selectedAgent.role || "Warm roleplay companion"
          }
        : {
            kind: "cli",
            command: selectedAgent.command || "node",
            args: selectedAgent.args || 'scripts/echo-agent.mjs "{prompt}"',
            mode: selectedAgent.mode || "oneshot",
            modelNote: selectedAgent.modelNote || "Custom local agent"
          }
    );
  };

  const deleteSelectedAgent = () => {
    if (!selectedAgent || isDefaultAgent(selectedAgent.id)) {
      if (selectedAgent) {
        appendEntry(sessionId, {
          id: uid(),
          agentId: selectedAgent.id,
          speaker: "system",
          text: "Default agents cannot be deleted. Use Reset Agent Defaults instead.",
          at: now()
        });
      }
      return;
    }

    const nextSelectedId = defaultAgents[0]?.id || state.agents.find((agent) => agent.id !== selectedAgent.id)?.id || "";
    const nextTranscripts = Object.fromEntries(
      Object.entries(state.transcripts).filter(([key]) => !key.startsWith(`${selectedAgent.id}:`))
    );
    const nextRuns = Object.fromEntries(
      Object.entries(state.runs).filter(([key]) => !key.startsWith(`${selectedAgent.id}:`))
    );

    void saveState({
      ...state,
      selectedAgentId: nextSelectedId,
      agents: state.agents.filter((agent) => agent.id !== selectedAgent.id),
      transcripts: nextTranscripts,
      runs: nextRuns
    });
    setRawLog((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${selectedAgent.id}:`)))
    );
  };

  const useEchoTestAgent = () => {
    if (!selectedAgent) return;
    updateAgent(selectedAgent.id, echoAgentPatch());
    appendEntry(sessionId, {
      id: uid(),
      agentId: selectedAgent.id,
      speaker: "system",
      text: "This character is now using the local Echo test agent. Send any message to verify GalCode's pipeline.",
      at: now()
    });
  };

  return (
    <main className="app-shell" style={{ "--agent-accent": stageAgent?.accent } as React.CSSProperties}>
      <section className="stage" onClick={handleStageClick}>
        <div className={`scene-backdrop ${state.backgroundPath ? "has-scene-image" : ""}`} aria-hidden="true">
          {state.backgroundPath ? (
            <img className="scene-image" src={filePathToAssetUrl(state.backgroundPath)} alt="" />
          ) : null}
          {!state.backgroundPath ? (
            <>
              <div className="window-grid" />
              <div className="lantern" />
              <div className="desk" />
              <div className="code-glow" />
            </>
          ) : null}
        </div>

        <header className="vn-hud">
          <button className="vn-menu-toggle" onClick={() => setMenuOpen((value) => !value)} title="Menu">
            <Settings size={17} />
            <span>Menu</span>
          </button>

          {menuOpen ? (
            <div className="vn-menu-panel">
              <div className="vn-title">
                <span className="brand-mark">
                  <Sparkles size={18} />
                </span>
                <div>
                  <strong>GalCode</strong>
                  <small>{window.galcode ? state.workspace || "Local Bridge" : "GalCode Web"}</small>
                </div>
              </div>

              <nav className="cast-strip" aria-label="Agents">
                {state.agents.map((agent) => (
                  <button
                    key={agent.id}
                    className={`cast-button ${agent.id === selectedAgent?.id ? "active" : ""}`}
                    onClick={() => {
                      setMenuOpen(false);
                      void saveState({ ...state, selectedAgentId: agent.id });
                    }}
                    title={agent.name}
                  >
                    <span style={{ background: agent.accent }}>
                      <Bot size={14} />
                    </span>
                    {agent.characterName}
                  </button>
                ))}
              </nav>

              <button
                className={`harem-toggle ${state.haremMode ? "active" : ""}`}
                type="button"
                onClick={() => void saveState({ ...state, haremMode: !state.haremMode })}
              >
                <span>Harem Mode</span>
                <strong>{state.haremMode ? "ON" : "OFF"}</strong>
                <small>{companionAgents.length} companions</small>
              </button>

              <div className="vn-actions">
                <button className="icon-button" onClick={chooseWorkspace} title="Choose workspace">
                  <FolderOpen size={17} />
                </button>
                <button className="icon-button" onClick={() => void exportSession()} title="Export session">
                  <Save size={17} />
                </button>
                <button className="icon-button" onClick={clearCurrentTranscript} title="Clear scene">
                  <Eraser size={17} />
                </button>
                <button className="icon-button" onClick={startAgent} title="Start agent">
                  <Play size={17} />
                </button>
                <button className="icon-button" onClick={stopAgent} title="Stop agent">
                  <Square size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMenuOpen(false);
                    setHelpOpen((value) => !value);
                  }}
                  title="Quick Start"
                >
                  <HelpCircle size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen((value) => !value);
                  }}
                  title="Settings"
                >
                  <Settings size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMenuOpen(false);
                    setRawOpen((value) => !value);
                  }}
                  title="Log"
                >
                  <Terminal size={17} />
                </button>
              </div>
            </div>
          ) : null}
        </header>

        <section className="character-panel">
          <div className="character-aura" />
          {stageAgent?.portraitPath ? (
            <img
              className="character-image"
              src={filePathToAssetUrl(stageAgent.portraitPath)}
              alt={stageAgent.characterName}
            />
          ) : (
            <div className="character-sprite">
              <div className="hair" />
              <div className="face">
                <span />
              </div>
              <div className="kimono">
                <Code2 size={44} />
              </div>
            </div>
          )}
          <div className="character-meta">
            <strong>{stageAgent?.characterName}</strong>
            <span>{stageAgent?.role}</span>
          </div>
        </section>

        <section className="dialogue-surface">
          <header className="scene-toolbar">
            <div>
              <span className="status-dot" data-running={runningSessions[sessionId] ? "true" : "false"} />
              <strong>{state.haremMode ? "Harem" : stageAgent?.characterName}</strong>
              <small>
                {state.haremMode
                  ? `${companionAgents.length} API companions`
                  : `${stageAgent?.name} / ${stageAgent?.modelNote}`}
              </small>
            </div>
          </header>

          <article
            className={`vn-dialogue ${showFullOutput ? "full" : ""}`}
            data-speaker={activeEntry?.speaker || "empty"}
            data-running={agentIsRunning ? "true" : "false"}
          >
            <div className="vn-speaker-line">
              <strong>{activeEntry ? activeSpeakerLabel : stageAgent?.characterName}</strong>
              {activeEntry?.speaker === "agent" ? (
                <span>
                  {showFullOutput
                    ? "Full Output"
                    : `${safePlaybackPageIndex + 1}/${activePages.length}`}
                </span>
              ) : null}
            </div>
            <pre className="vn-current-text">{currentDialogueText}</pre>
            {agentIsRunning ? (
              <div className="vn-read-hint">正在整理回复...</div>
            ) : playbackPending && !showFullOutput ? (
              <button className="vn-read-hint" type="button" onClick={advanceDialogue}>
                <span>Click</span>
                <ChevronRight size={18} />
              </button>
            ) : null}
          </article>

          <div className="vn-control-bar">
            <span>
              {agentIsRunning
                ? `${state.haremMode ? "大家" : stageAgent?.characterName} 正在回应`
                : !activeEntry
                  ? "准备开始"
                  : !isViewingLatest
                    ? `回顾 ${safeViewEntryIndex + 1}/${visibleTranscript.length}`
                    : latestPlaybackPending
                      ? "点击画面推进对白"
                      : "可以输入下一句"}
            </span>
            <div className="vn-command-group">
              <button className="vn-command-button" type="button" onClick={goBackDialogue} disabled={!canGoBack}>
                <ChevronLeft size={17} />
                Back
              </button>
              <button
                className="vn-command-button primary"
                type="button"
                onClick={advanceDialogue}
                disabled={!canGoForward}
              >
                <ChevronRight size={17} />
                {playbackPending && isViewingLatest && safePlaybackPageIndex >= activePages.length - 1
                  ? "Done"
                  : "Next"}
              </button>
              <button
                className={`vn-command-button ${autoPlay ? "active" : ""}`}
                type="button"
                onClick={() => setAutoPlay((value) => !value)}
                disabled={!activeEntry}
              >
                <Play size={17} />
                Auto
              </button>
              <button className="vn-command-button" type="button" onClick={revealFullOutput} disabled={!activeEntry}>
                <List size={17} />
                Full
              </button>
              <button className="vn-command-button" type="button" onClick={() => setHistoryOpen(true)}>
                <BookOpen size={17} />
                History
              </button>
              <button className="vn-command-button" type="button" onClick={() => setRawOpen(true)}>
                <FileText size={17} />
                Raw
              </button>
              {agentIsRunning ? (
                <button className="vn-command-button" type="button" onClick={stopAgent}>
                  <Square size={17} />
                  Stop
                </button>
              ) : (
                <button className="vn-command-button" type="button" onClick={skipDialogue} disabled={!playbackPending}>
                  <FastForward size={17} />
                  Skip
                </button>
              )}
            </div>
          </div>

          {promptIsAvailable ? (
            <form className="prompt-bar" onSubmit={sendPrompt}>
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={state.haremMode ? "Message everyone" : `Message ${stageAgent?.characterName}`}
                disabled={!promptIsAvailable}
              />
              <button className="send-button" type="submit" disabled={!promptIsAvailable}>
                <Send size={18} />
                Send
              </button>
            </form>
          ) : null}
        </section>
      </section>

      {settingsOpen && selectedAgent ? (
        <aside className="settings-panel">
          <header>
            <h2>Agent Config</h2>
            <div className="panel-actions">
              <button className="icon-button" onClick={() => void saveState(state)} title="Save">
                <Save size={18} />
              </button>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} title="Close settings">
                <X size={18} />
              </button>
            </div>
          </header>
          <label>
            Agent Type
            <select
              value={agentKind(selectedAgent)}
              onChange={(event) => updateSelectedAgentKind(event.target.value as "cli" | "chat")}
            >
              <option value="cli">Work Agent CLI</option>
              <option value="chat">API Companion</option>
            </select>
          </label>
          <label>
            Character
            <input
              value={selectedAgent.characterName}
              onChange={(event) => updateAgent(selectedAgent.id, { characterName: event.target.value })}
            />
          </label>
          <label>
            Agent Name
            <input
              value={selectedAgent.name}
              onChange={(event) => updateAgent(selectedAgent.id, { name: event.target.value })}
            />
          </label>
          <div className="asset-actions">
            <button className="tool-button" onClick={choosePortraitAsset}>
              <FolderOpen size={17} />
              Portrait
            </button>
            <button className="tool-button" onClick={chooseBackgroundAsset}>
              <FolderOpen size={17} />
              Background
            </button>
          </div>
          <button className="tool-button" onClick={addCustomAgent}>
            <Plus size={17} />
            Add CLI Agent
          </button>
          <button className="tool-button" onClick={addCompanionAgent}>
            <Plus size={17} />
            Add Companion
          </button>
          <button className="tool-button" onClick={() => void importThemeFolder()}>
            <FolderOpen size={17} />
            Import Theme Folder
          </button>
          <button className="tool-button" onClick={resetSelectedAgent}>
            <Save size={17} />
            Reset Agent Defaults
          </button>
          <button className="tool-button" onClick={deleteSelectedAgent}>
            <Trash2 size={17} />
            Delete Custom Agent
          </button>
          <button className="tool-button" onClick={useEchoTestAgent}>
            <Terminal size={17} />
            Use Echo Test Agent
          </button>
          {isChatAgent(selectedAgent) ? (
            <>
              <label>
                API URL
                <input
                  value={selectedAgent.apiUrl || ""}
                  onChange={(event) => updateAgent(selectedAgent.id, { apiUrl: event.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </label>
              <label>
                API Key
                <input
                  type="password"
                  value={selectedAgent.apiKey || ""}
                  onChange={(event) => updateAgent(selectedAgent.id, { apiKey: event.target.value })}
                  placeholder="sk-..."
                />
              </label>
              <label>
                Model
                <input
                  value={selectedAgent.model || ""}
                  onChange={(event) => updateAgent(selectedAgent.id, { model: event.target.value })}
                  placeholder="qwen3.6-27b"
                />
              </label>
              <label>
                Temperature
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={selectedAgent.temperature ?? 0.8}
                  onChange={(event) => updateAgent(selectedAgent.id, { temperature: Number(event.target.value) })}
                />
              </label>
              <label>
                Personality / System Prompt
                <textarea
                  value={selectedAgent.systemPrompt || ""}
                  onChange={(event) => updateAgent(selectedAgent.id, { systemPrompt: event.target.value })}
                  placeholder="Describe her identity, tone, relationship, boundaries, and speaking style."
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Command
                <input
                  value={selectedAgent.command}
                  onChange={(event) => updateAgent(selectedAgent.id, { command: event.target.value })}
                />
              </label>
              <div className="check-row">
                <button className="tool-button" onClick={() => void checkAgent(selectedAgent)}>
                  <Terminal size={17} />
                  Check Command
                </button>
                {agentChecks[selectedAgent.id] ? (
                  <span data-ok={agentChecks[selectedAgent.id].ok ? "true" : "false"}>
                    {agentChecks[selectedAgent.id].message}
                  </span>
                ) : null}
              </div>
              <label>
                Args
                <input
                  value={selectedAgent.args}
                  onChange={(event) => updateAgent(selectedAgent.id, { args: event.target.value })}
                  placeholder='Use "{prompt}" in oneshot mode'
                />
              </label>
              <label>
                Mode
                <select
                  value={selectedAgent.mode}
                  onChange={(event) => updateAgent(selectedAgent.id, { mode: event.target.value as AgentConfig["mode"] })}
                >
                  <option value="interactive">interactive</option>
                  <option value="oneshot">oneshot</option>
                </select>
              </label>
            </>
          )}
          <label>
            Accent
            <input
              type="color"
              value={selectedAgent.accent}
              onChange={(event) => updateAgent(selectedAgent.id, { accent: event.target.value })}
            />
          </label>
        </aside>
      ) : null}

      {helpOpen ? (
        <aside className="help-panel">
          <header>
            <h2>Quick Start</h2>
            <button className="icon-button" onClick={() => setHelpOpen(false)} title="Close quick start">
              <X size={18} />
            </button>
          </header>
          <ol>
            <li>
              <strong>Choose a project.</strong>
              <span>Pick the code folder the heroine should work inside.</span>
              <button className="tool-button" onClick={chooseWorkspace}>
                <FolderOpen size={17} />
                Choose Workspace
              </button>
            </li>
            <li>
              <strong>Check agents.</strong>
              <span>Codex, Claude Code, and Cursor can be configured independently.</span>
              <button className="tool-button" onClick={() => void checkAllAgents()}>
                <Terminal size={17} />
                Check All Commands
              </button>
              <button className="tool-button" onClick={useEchoTestAgent}>
                <Terminal size={17} />
                Use Echo Test Agent
              </button>
            </li>
            <li>
              <strong>Import a theme folder.</strong>
              <span>Use local backgrounds and portraits for a fuller visual novel screen.</span>
              <button className="tool-button" onClick={() => void importThemeFolder()}>
                <FolderOpen size={17} />
                Import Theme Folder
              </button>
            </li>
            <li>
              <strong>Send a task.</strong>
              <span>Type in the bottom input. One-shot agents start automatically.</span>
            </li>
          </ol>
          <div className="agent-health">
            {state.agents.map((agent) => (
              <div key={agent.id}>
                <strong>{agent.name}</strong>
                <span data-ok={agentChecks[agent.id]?.ok ? "true" : "false"}>
                  {agentChecks[agent.id]?.message || "not checked"}
                </span>
              </div>
            ))}
          </div>
        </aside>
      ) : null}

      {historyOpen ? (
        <aside className="history-panel">
          <header>
            <h2>Dialogue Log</h2>
            <button className="icon-button" onClick={() => setHistoryOpen(false)} title="Close dialogue log">
              <X size={18} />
            </button>
          </header>
          <div className="history-list">
            {visibleTranscript.length === 0 ? (
              <p>No dialogue yet.</p>
            ) : (
              visibleTranscript.map((entry, index) => (
                <button
                  key={entry.id}
                  className={`history-item ${index === safeViewEntryIndex ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setViewEntryIndex(index);
                    setPlaybackPageIndex(0);
                    setShowFullOutput(false);
                    setHistoryOpen(false);
                  }}
                >
                  <strong>
                    {entry.speaker === "user" ? "You" : entry.speaker === "agent" ? selectedAgent?.characterName : "System"}
                  </strong>
                  <span>{entry.text.replace(/\s+/g, " ").trim()}</span>
                </button>
              ))
            )}
          </div>
        </aside>
      ) : null}

      {rawOpen ? (
        <aside className="raw-panel">
          <header>
            <h2>Raw Log</h2>
            <button className="icon-button" onClick={() => setRawOpen(false)} title="Close log">
              <X size={18} />
            </button>
          </header>
          <pre>{rawLog[sessionId] || "No output."}</pre>
        </aside>
      ) : null}

      <input
        ref={backgroundInputRef}
        className="asset-file-input"
        type="file"
        accept="image/*"
        onChange={handleBackgroundFile}
      />
      <input
        ref={portraitInputRef}
        className="asset-file-input"
        type="file"
        accept="image/*"
        onChange={handlePortraitFile}
      />
    </main>
  );
}

function localBridgeUnavailableEntry(agent: AgentConfig): TranscriptEntry {
  return {
    id: uid(),
    agentId: agent.id,
    speaker: "system",
    text: "Desktop Local Bridge is not connected.",
    at: now()
  };
}

export default App;
