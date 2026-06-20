import {
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Eraser,
  FastForward,
  FileText,
  FolderOpen,
  HelpCircle,
  List,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent, MouseEvent } from "react";
import type {
  AgentConfig,
  ChatContextEntry,
  DirectorConfig,
  GalCodeState,
  ModelConfig,
  RunRecord,
  StoryState,
  TranscriptEntry
} from "./types";
import {
  browserFallbackState,
  buildDirectorOpeningPrompt,
  buildDirectorStoryDraftPrompt,
  buildDirectorUpdatePrompt,
  buildHeroineDraftPrompt,
  buildHeroineSystemPrompt,
  createCompanionAgent,
  createModelConfig,
  createSaveRecord,
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
  resolveModelConfig,
  splitDialoguePages,
  upsertSaveRecord
} from "./core";

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);
const WEB_STORAGE_KEY = "galcode-web-state";
const LEGACY_PREVIEW_STORAGE_KEY = "galcode-preview-state";

type ChatResult = { ok: boolean; text?: string; error?: string };
type CreatorMessage = { id: string; speaker: "user" | "director"; text: string; at: string };
type CreatorBusy = "heroine" | "story" | null;

function App() {
  const [state, setState] = useState<GalCodeState>(browserFallbackState);
  const [screen, setScreen] = useState<"title" | "creator" | "load" | "game">("title");
  const [prompt, setPrompt] = useState("");
  const [storyIdea, setStoryIdea] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [runningSessions, setRunningSessions] = useState<Record<string, boolean>>({});
  const [rawLog, setRawLog] = useState<Record<string, string>>({});
  const [viewEntryIndex, setViewEntryIndex] = useState(0);
  const [playbackPageIndex, setPlaybackPageIndex] = useState(0);
  const [completedPlaybackIds, setCompletedPlaybackIds] = useState<Record<string, true>>({});
  const [showFullOutput, setShowFullOutput] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [storyGenerating, setStoryGenerating] = useState(false);
  const [storyError, setStoryError] = useState("");
  const [creatorMessages, setCreatorMessages] = useState<CreatorMessage[]>([]);
  const [creatorBusy, setCreatorBusy] = useState<CreatorBusy>(null);
  const [creatorError, setCreatorError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [advancedPromptOpen, setAdvancedPromptOpen] = useState<Record<string, boolean>>({});
  const [selectedModelConfigId, setSelectedModelConfigId] = useState(defaultModelConfig.id);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const portraitInputRef = useRef<HTMLInputElement | null>(null);
  const lastSessionIdRef = useRef("");

  const selectedAgent = useMemo(
    () => state.agents.find((agent) => agent.id === state.selectedAgentId) || state.agents[0],
    [state.agents, state.selectedAgentId]
  );
  const companionAgents = useMemo(() => state.agents.filter((agent) => isChatAgent(agent)), [state.agents]);
  const modelConfigs = state.modelConfigs?.length ? state.modelConfigs : [defaultModelConfig];
  const selectedModelConfig =
    modelConfigs.find((config) => config.id === selectedModelConfigId) || modelConfigs[0] || defaultModelConfig;
  const saveSlots = state.saves || [];
  const sessionId = useMemo(
    () => `${state.haremMode ? "harem" : selectedAgent?.id || "heroine"}:story`,
    [selectedAgent?.id, state.haremMode]
  );
  const transcript = state.transcripts[sessionId] || [];
  const visibleTranscript = useMemo(() => transcript.filter((entry) => entry.speaker !== "system"), [transcript]);
  const latestVisibleIndex = visibleTranscript.length - 1;
  const safeViewEntryIndex =
    latestVisibleIndex < 0 ? -1 : Math.min(Math.max(viewEntryIndex, 0), latestVisibleIndex);
  const activeEntry = safeViewEntryIndex >= 0 ? visibleTranscript[safeViewEntryIndex] : undefined;
  const latestEntry = visibleTranscript[latestVisibleIndex];
  const activeAgent =
    activeEntry?.speaker === "agent"
      ? state.agents.find((agent) => agent.id === activeEntry.agentId)
      : selectedAgent;
  const stageAgent = activeAgent || selectedAgent || defaultAgents[0];
  const stageCharacters = useMemo(() => {
    if (screen !== "game") return [];
    return getStageCharactersForEntry(activeEntry, state.agents);
  }, [activeEntry, screen, state.agents]);
  const isViewingLatest = safeViewEntryIndex === latestVisibleIndex;
  const activePages = useMemo(
    () => splitDialoguePages(activeEntry?.text || ""),
    [activeEntry?.id, activeEntry?.text]
  );
  const safePlaybackPageIndex = Math.min(playbackPageIndex, Math.max(activePages.length - 1, 0));
  const agentIsRunning = Boolean(runningSessions[sessionId]);
  const latestPlaybackPending =
    Boolean(latestEntry && latestEntry.speaker === "agent" && !completedPlaybackIds[latestEntry.id]) &&
    !agentIsRunning;
  const playbackPending =
    Boolean(activeEntry && activeEntry.speaker === "agent" && isViewingLatest && !completedPlaybackIds[activeEntry.id]) &&
    !agentIsRunning;
  const activeSpeakerLabel =
    activeEntry?.speaker === "user"
      ? "You"
      : activeEntry?.speaker === "agent"
        ? getEntrySpeakerName(activeEntry, state.agents)
        : "旁白";
  const currentDialogueText = activeEntry
    ? showFullOutput
      ? activeEntry.text.trimEnd()
      : activePages[safePlaybackPageIndex] || ""
    : state.storyStarted
      ? "故事已经开始。输入第一句话，看看她会怎么接住这个夏天。"
      : "先生成一段剧情。";
  const promptIsAvailable =
    screen === "game" &&
    Boolean(state.storyStarted) &&
    !agentIsRunning &&
    !latestPlaybackPending &&
    (latestVisibleIndex < 0 || isViewingLatest);
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
        setState(normalizeGalCodeState(await window.galcode.loadState()));
        return;
      }
      const saved = localStorage.getItem(WEB_STORAGE_KEY) || localStorage.getItem(LEGACY_PREVIEW_STORAGE_KEY);
      if (saved) {
        const normalized = normalizeGalCodeState(JSON.parse(saved));
        setState(normalized);
        localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(normalized));
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (modelConfigs.some((config) => config.id === selectedModelConfigId)) return;
    setSelectedModelConfigId(modelConfigs[0]?.id || defaultModelConfig.id);
  }, [modelConfigs, selectedModelConfigId]);

  useEffect(() => {
    if (lastSessionIdRef.current === sessionId) return;
    lastSessionIdRef.current = sessionId;
    setViewEntryIndex(Math.max(latestVisibleIndex, 0));
    setPlaybackPageIndex(0);
    setShowFullOutput(false);
  }, [latestVisibleIndex, sessionId]);

  useEffect(() => {
    if (latestVisibleIndex < 0) {
      setViewEntryIndex(0);
      return;
    }
    setViewEntryIndex((current) => Math.min(current, latestVisibleIndex));
  }, [latestVisibleIndex]);

  useEffect(() => {
    setPlaybackPageIndex((current) => Math.min(current, Math.max(activePages.length - 1, 0)));
  }, [activePages.length]);

  const saveState = async (nextState: GalCodeState) => {
    const normalized = normalizeGalCodeState(nextState);
    setState(normalized);
    if (window.galcode) {
      await window.galcode.saveState(normalized);
    } else {
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(normalized));
    }
  };

  const persistStateUpdate = (updater: (current: GalCodeState) => GalCodeState) => {
    setState((current) => {
      const next = normalizeGalCodeState(updater(current));
      if (window.galcode) void window.galcode.saveState(next);
      else localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const appendEntry = useCallback((targetSessionId: string, entry: TranscriptEntry, mergeOutput = false) => {
    setState((current) => {
      const currentTranscript = current.transcripts[targetSessionId] || [];
      const nextTranscript = mergeTranscriptEntry(currentTranscript, entry, mergeOutput);
      const next = normalizeGalCodeState({
        ...current,
        transcripts: {
          ...current.transcripts,
          [targetSessionId]: nextTranscript
        }
      });
      if (window.galcode) void window.galcode.saveState(next);
      else localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

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
    if (
      screen !== "game" ||
      !autoPlay ||
      !activeEntry ||
      !canGoForward ||
      agentIsRunning ||
      showFullOutput ||
      menuOpen ||
      settingsOpen ||
      helpOpen ||
      historyOpen ||
      rawOpen
    ) {
      return;
    }
    const delay =
      activeEntry.speaker === "user" ? 520 : Math.min(2800, Math.max(1050, currentDialogueText.length * 36));
    const timer = window.setTimeout(() => {
      advanceDialogue();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    activeEntry,
    advanceDialogue,
    agentIsRunning,
    autoPlay,
    canGoForward,
    currentDialogueText.length,
    helpOpen,
    historyOpen,
    menuOpen,
    rawOpen,
    screen,
    settingsOpen,
    showFullOutput
  ]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menuOpen || settingsOpen || helpOpen || historyOpen || rawOpen) {
        setMenuOpen(false);
        setSettingsOpen(false);
        setHelpOpen(false);
        setHistoryOpen(false);
        setRawOpen(false);
        return;
      }
      if (screen === "game" || screen === "creator" || screen === "load") {
        setScreen("title");
        return;
      }
      setMenuOpen(false);
      setSettingsOpen(false);
      setHelpOpen(false);
      setHistoryOpen(false);
      setRawOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen, historyOpen, menuOpen, rawOpen, screen, settingsOpen]);

  useEffect(() => {
    const advanceOnKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      if (screen !== "game" || menuOpen || settingsOpen || helpOpen || historyOpen || rawOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button")) return;
      if (!canGoForward) return;
      event.preventDefault();
      advanceDialogue();
    };
    window.addEventListener("keydown", advanceOnKey);
    return () => window.removeEventListener("keydown", advanceOnKey);
  }, [advanceDialogue, canGoForward, helpOpen, historyOpen, menuOpen, rawOpen, screen, settingsOpen]);

  useEffect(() => {
    if (!window.galcode) return;
    return window.galcode.onAgentEvent((event) => {
      setRawLog((current) => ({
        ...current,
        [event.sessionId]: `${current[event.sessionId] || ""}${formatRawEvent(event)}`
      }));
    });
  }, []);

  const handleStageClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (screen !== "game") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, input, textarea, select, a, .settings-panel, .help-panel, .raw-panel, .history-panel, .vn-menu-panel, .vn-menu-toggle, .story-gate, .title-screen"
        )
      ) {
        return;
      }
      advanceDialogue();
    },
    [advanceDialogue, screen]
  );

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
    await saveState({ ...state, backgroundPath: await fileToDataUrl(file) });
  };

  const handlePortraitFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedAgent) return;
    updateAgent(selectedAgent.id, { portraitPath: await fileToDataUrl(file) });
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

  const normalizeChatApiUrl = (apiUrl?: string) => {
    const raw = (apiUrl || "").trim();
    if (!raw) return "";
    const trimmed = raw.replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
    if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
    return `${trimmed}/v1/chat/completions`;
  };

  const callChatCompletion = async (
    config: Pick<ModelConfig, "apiUrl" | "apiKey" | "model" | "temperature">,
    messages: { role: string; content: string }[]
  ): Promise<ChatResult> => {
    const apiUrl = normalizeChatApiUrl(config.apiUrl);
    if (!apiUrl) return { ok: false, error: "需要先配置 API URL。" };
    if (!config.model) return { ok: false, error: "需要先配置模型名。" };

    try {
      const response = await fetch("/api/galcode/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          apiUrl,
          apiKey: config.apiKey || "",
          model: config.model,
          messages,
          temperature: Number.isFinite(config.temperature) ? config.temperature : 0.86
        })
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.text) return { ok: true, text: String(payload.text).trim() };
      return { ok: false, error: payload?.error || `API 代理返回 HTTP ${response.status}` };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? `${error.message}（请确认 npm run dev 的本地代理在运行）` : "API 请求失败。"
      };
    }
  };

  const parseDirectorJson = (text: string) => {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced || trimmed;
    try {
      return JSON.parse(candidate);
    } catch {
      const first = candidate.indexOf("{");
      const last = candidate.lastIndexOf("}");
      if (first >= 0 && last > first) {
        return JSON.parse(candidate.slice(first, last + 1));
      }
      throw new Error("导演没有返回可解析的 JSON。");
    }
  };

  const directorModelReady = () => {
    const directorModel = resolveModelConfig(state, state.director?.modelConfigId);
    if (!directorModel.apiUrl || !directorModel.model) {
      setSettingsOpen(true);
      setCreatorError("请先在 Settings 里配置一个模型，并让导演选择它。");
      return undefined;
    }
    return directorModel;
  };

  const buildChatContext = (entries: TranscriptEntry[]): ChatContextEntry[] =>
    entries
      .filter((entry) => entry.speaker === "user" || entry.speaker === "agent")
      .slice(-24)
      .map((entry) => ({
        speaker: entry.speaker === "agent" ? "agent" : "user",
        name: entry.speaker === "agent" ? getEntrySpeakerName(entry, state.agents) : "You",
        text: entry.text
      }));

  const buildChatMessages = (agent: AgentConfig, context: ChatContextEntry[], userText: string, haremMode?: boolean) => {
    const historyText = context
      .slice(-24)
      .map((entry) => `${entry.name}: ${entry.text}`)
      .join("\n");
    const promptText = [
      historyText ? `此前剧情对话记录：\n${historyText}` : "",
      haremMode
        ? "请注意：如果记录中有其他女主刚刚说过的话，你可以自然接话，但不要替她们发言，不要总结全场，也不要写得比前面角色明显更长。"
        : "",
      "本次只写你自己的下一句或下一小段，保持 80-140 个中文字符左右。少用直白暧昧和过度夸赞，优先让场景自然往前走。",
      `用户现在对你说：${userText}`
    ]
      .filter(Boolean)
      .join("\n\n");

    return [
      { role: "system", content: buildHeroineSystemPrompt(agent, state.story, haremMode) },
      { role: "user", content: promptText }
    ];
  };

  const appendChatRawLog = (targetSessionId: string, label: string, message: string) => {
    setRawLog((current) => ({
      ...current,
      [targetSessionId]: `${current[targetSessionId] || ""}\n[${label}] ${message}\n`
    }));
  };

  const generateStory = async (startAfterGeneration = false) => {
    setStoryError("");
    const directorModel = resolveModelConfig(state, state.director?.modelConfigId);
    if (!directorModel.apiUrl || !directorModel.model) {
      setSettingsOpen(true);
      setStoryError("请先在 Settings 里配置一个模型，并让导演选择它。");
      return;
    }

    setStoryGenerating(true);
    const result = await callChatCompletion(directorModel, [
      { role: "system", content: state.director?.systemPrompt || defaultDirectorConfig.systemPrompt },
      { role: "user", content: buildDirectorOpeningPrompt(state.agents) }
    ]);
    setStoryGenerating(false);

    if (!result.ok || !result.text) {
      setStoryError(`导演生成失败：${result.error || "empty response"}`);
      return;
    }
    const storyText = result.text.trim();

    const story: StoryState = {
      title: deriveStoryTitle(storyText),
      opening: storyText,
      summary: storyText,
      currentBeat: storyText,
      generatedAt: now(),
      updatedAt: now()
    };
    const openingEntry = makeStoryOpeningEntry(story);
    const nextTranscripts = startAfterGeneration
      ? { ...state.transcripts, [sessionId]: [openingEntry] }
      : state.transcripts;
    const nextRuns = startAfterGeneration ? { ...state.runs, [sessionId]: [] } : state.runs;

    await saveState({
      ...state,
      story,
      storyStarted: startAfterGeneration,
      transcripts: nextTranscripts,
      runs: nextRuns
    });
    setCompletedPlaybackIds({});
    setViewEntryIndex(0);
    setPlaybackPageIndex(0);
    setShowFullOutput(false);
  };

  const updateAgentSimple = (agentId: string, patch: Partial<AgentConfig>) => {
    void saveState({
      ...state,
      agents: state.agents.map((agent) => (agent.id === agentId ? { ...agent, ...patch } : agent))
    });
  };

  const applyHeroineDraft = (agent: AgentConfig, draft: Record<string, unknown>): AgentConfig => {
    const characterName = String(draft.characterName || agent.characterName || agent.name).trim();
    const publicProfile = String(draft.publicProfile || draft.role || agent.role || "").trim();
    const background = String(draft.background || "").trim();
    const personality = String(draft.personality || "").trim();
    const speakingStyle = String(draft.speakingStyle || "").trim();
    const coreBeliefs = Array.isArray(draft.coreBeliefs) ? draft.coreBeliefs.map(String).filter(Boolean) : [];
    const boundaries = Array.isArray(draft.boundaries) ? draft.boundaries.map(String).filter(Boolean) : [];
    const conflictTriggers = Array.isArray(draft.conflictTriggers)
      ? draft.conflictTriggers.map(String).filter(Boolean)
      : [];
    const relationshipSeeds = Array.isArray(draft.relationshipSeeds)
      ? draft.relationshipSeeds.map(String).filter(Boolean)
      : [];
    const systemPrompt = String(draft.systemPrompt || agent.systemPrompt || "").trim();
    const modelNotes = [
      background,
      personality,
      speakingStyle,
      coreBeliefs.length ? `核心信念：${coreBeliefs.join("；")}` : "",
      boundaries.length ? `关系边界：${boundaries.join("；")}` : "",
      conflictTriggers.length ? `冲突触发：${conflictTriggers.join("；")}` : "",
      relationshipSeeds.length ? `关系苗头：${relationshipSeeds.join("；")}` : ""
    ].filter(Boolean);
    return {
      ...agent,
      characterName,
      name: agent.name || characterName,
      role: publicProfile || agent.role,
      modelNote: modelNotes.length ? modelNotes.join("\n") : agent.modelNote,
      systemPrompt: systemPrompt || agent.systemPrompt
    };
  };

  const generateHeroineDraft = async (agentId: string) => {
    setCreatorError("");
    const directorModel = directorModelReady();
    if (!directorModel) return;
    const agent = state.agents.find((item) => item.id === agentId);
    if (!agent) return;

    setCreatorBusy("heroine");
    const result = await callChatCompletion(directorModel, [
      { role: "system", content: state.director?.systemPrompt || defaultDirectorConfig.systemPrompt },
      { role: "user", content: buildHeroineDraftPrompt(agent, state.agents, storyIdea, state.story) }
    ]);
    setCreatorBusy(null);

    if (!result.ok || !result.text) {
      setCreatorError(`女主设定生成失败：${result.error || "empty response"}`);
      return;
    }

    try {
      const draft = parseDirectorJson(result.text) as Record<string, unknown>;
      const nextAgent = applyHeroineDraft(agent, draft);
      await saveState({
        ...state,
        selectedAgentId: nextAgent.id,
        agents: state.agents.map((item) => (item.id === agentId ? nextAgent : item))
      });
      setCreatorMessages((current) => [
        ...current,
        {
          id: uid(),
          speaker: "director",
          text: `已完善「${nextAgent.characterName}」：${nextAgent.role}`,
          at: now()
        }
      ]);
    } catch (error) {
      setCreatorError(error instanceof Error ? error.message : "女主设定解析失败。");
    }
  };

  const generateAllHeroineDrafts = async () => {
    setCreatorError("");
    const directorModel = directorModelReady();
    if (!directorModel) return;
    setCreatorBusy("heroine");
    let nextAgents = state.agents;

    for (const agent of state.agents) {
      const result = await callChatCompletion(directorModel, [
        { role: "system", content: state.director?.systemPrompt || defaultDirectorConfig.systemPrompt },
        { role: "user", content: buildHeroineDraftPrompt(agent, nextAgents, storyIdea, state.story) }
      ]);
      if (!result.ok || !result.text) {
        setCreatorBusy(null);
        setCreatorError(`「${agent.characterName}」设定生成失败：${result.error || "empty response"}`);
        return;
      }
      try {
        const draft = parseDirectorJson(result.text) as Record<string, unknown>;
        const nextAgent = applyHeroineDraft(agent, draft);
        nextAgents = nextAgents.map((item) => (item.id === agent.id ? nextAgent : item));
      } catch (error) {
        setCreatorBusy(null);
        setCreatorError(error instanceof Error ? error.message : `「${agent.characterName}」设定解析失败。`);
        return;
      }
    }

    await saveState({ ...state, agents: nextAgents });
    setCreatorBusy(null);
    setCreatorMessages((current) => [
      ...current,
      {
        id: uid(),
        speaker: "director",
        text: `已完善 ${nextAgents.length} 位女主角设定。`,
        at: now()
      }
    ]);
  };

  const generateStoryDraft = async (regenerate = false) => {
    setCreatorError("");
    setStoryError("");
    const directorModel = directorModelReady();
    if (!directorModel) return;
    const userText = storyIdea.trim() || (regenerate ? "请换一个新的剧情方向。" : "请生成一个开场剧情。");
    const history = [
      ...creatorMessages.map((message) => `${message.speaker === "user" ? "用户" : "导演"}：${message.text}`),
      `用户：${userText}`
    ];

    setCreatorMessages((current) => [
      ...current,
      {
        id: uid(),
        speaker: "user",
        text: userText,
        at: now()
      }
    ]);
    setStoryIdea("");
    setCreatorBusy("story");
    setStoryGenerating(true);

    const result = await callChatCompletion(directorModel, [
      { role: "system", content: state.director?.systemPrompt || defaultDirectorConfig.systemPrompt },
      {
        role: "user",
        content: buildDirectorStoryDraftPrompt({
          agents: state.agents,
          userIdea: userText,
          previousStory: regenerate ? undefined : state.story,
          creatorHistory: history,
          regenerate
        })
      }
    ]);
    setStoryGenerating(false);
    setCreatorBusy(null);

    if (!result.ok || !result.text) {
      setCreatorError(`剧情草案生成失败：${result.error || "empty response"}`);
      return;
    }

    try {
      const draft = parseDirectorJson(result.text) as Record<string, unknown>;
      const opening = String(draft.opening || result.text).trim();
      const summary = String(draft.summary || opening).trim();
      const currentBeat = String(draft.currentBeat || summary).trim();
      const story: StoryState = {
        title: String(draft.title || deriveStoryTitle(opening)).trim(),
        opening,
        summary,
        currentBeat,
        generatedAt: now(),
        updatedAt: now()
      };
      await saveState({
        ...state,
        story,
        storyStarted: false
      });
      setCreatorMessages((current) => [
        ...current,
        {
          id: uid(),
          speaker: "director",
          text: `《${story.title}》\n${story.summary}`,
          at: now()
        }
      ]);
    } catch (error) {
      setCreatorError(error instanceof Error ? error.message : "剧情草案解析失败。");
    }
  };

  const enterStory = async () => {
    if (!state.story) return;
    await saveState({
      ...state,
      storyStarted: true,
      transcripts: {
        ...state.transcripts,
        [sessionId]: [makeStoryOpeningEntry(state.story)]
      },
      runs: {
        ...state.runs,
        [sessionId]: []
      }
    });
    setCompletedPlaybackIds({});
    setViewEntryIndex(0);
    setPlaybackPageIndex(0);
    setShowFullOutput(false);
    setScreen("game");
  };

  const saveCurrentGame = async (replaceId?: string) => {
    setSaveMessage("");
    if (!state.story) {
      setSaveMessage("还没有剧情，先生成剧情后再存档。");
      return;
    }
    const save = createSaveRecord(state, saveSlots, now());
    const nextSaves = upsertSaveRecord(saveSlots, save, replaceId);
    await saveState({
      ...state,
      saves: nextSaves
    });
    setSaveMessage(replaceId ? "已覆盖存档。" : saveSlots.length >= 10 ? "已保存，并覆盖最旧存档。" : "已保存。");
  };

  const loadSave = async (saveId: string) => {
    const save = saveSlots.find((item) => item.id === saveId);
    if (!save) return;
    await saveState(restoreSaveRecord(state, save));
    setScreen(save.snapshot.storyStarted ? "game" : "creator");
    setMenuOpen(false);
    setSettingsOpen(false);
    setHelpOpen(false);
    setHistoryOpen(false);
    setRawOpen(false);
    setCompletedPlaybackIds({});
    setViewEntryIndex(0);
    setPlaybackPageIndex(0);
    setShowFullOutput(false);
    setSaveMessage(`已读取《${save.storyTitle}》。`);
  };

  const startNewGame = async () => {
    setScreen("creator");
    setMenuOpen(false);
    setSettingsOpen(false);
    setHelpOpen(false);
    setHistoryOpen(false);
    setRawOpen(false);
    await saveState({
      ...state,
      story: undefined,
      storyStarted: false,
      transcripts: {},
      runs: {}
    });
    setCreatorMessages([]);
    setCreatorError("");
    setStoryIdea("");
    setRawLog({});
    setCompletedPlaybackIds({});
    setViewEntryIndex(0);
    setPlaybackPageIndex(0);
    setShowFullOutput(false);
  };

  const loadGame = () => {
    setScreen("load");
    setMenuOpen(false);
    setSettingsOpen(false);
    setHelpOpen(false);
    setHistoryOpen(false);
    setRawOpen(false);
  };

  const updateDirectorStory = async (entries: TranscriptEntry[]) => {
    const directorModel = resolveModelConfig(state, state.director?.modelConfigId);
    if (!state.story || !directorModel.apiUrl || !directorModel.model) return;
    const context = buildChatContext(entries);
    const result = await callChatCompletion(directorModel, [
      { role: "system", content: state.director?.systemPrompt || defaultDirectorConfig.systemPrompt },
      { role: "user", content: buildDirectorUpdatePrompt(state.story, context) }
    ]);
    if (!result.ok || !result.text) {
      appendChatRawLog(sessionId, "director", `update skipped: ${result.error || "empty response"}`);
      return;
    }
    const nextStoryText = result.text.trim();
    persistStateUpdate((current) => {
      if (!current.story) return current;
      return {
        ...current,
        story: {
          ...current.story,
          summary: nextStoryText,
          currentBeat: nextStoryText,
          updatedAt: now()
        }
      };
    });
    appendChatRawLog(sessionId, "director", "story state updated");
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

    const agentModel = resolveModelConfig(state, agent.modelConfigId);
    appendChatRawLog(targetSessionId, agent.characterName, `request model=${agentModel.model || "(missing model)"}`);
    const result = await callChatCompletion(
      agentModel,
      buildChatMessages(agent, context, text, haremMode)
    );

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
      appendChatRawLog(targetSessionId, agent.characterName, result.error || "failed");
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
    appendChatRawLog(targetSessionId, agent.characterName, `response ${result.text.length} chars`);
    updateRun(targetSessionId, runId, {
      status: "completed",
      endedAt: now(),
      outputCharsDelta: result.text.length
    });
    return entry;
  };

  const sendPrompt = async (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || !selectedAgent || !promptIsAvailable) return;

    setPrompt("");
    const baseTranscript = state.transcripts[sessionId] || [];
    const userEntry: TranscriptEntry = {
      id: uid(),
      agentId: "user",
      speaker: "user",
      text,
      at: now()
    };
    appendEntry(sessionId, userEntry);
    setViewEntryIndex(baseTranscript.filter((entry) => entry.speaker !== "system").length);
    setPlaybackPageIndex(0);
    setShowFullOutput(false);

    const targetAgents = state.haremMode ? companionAgents : [selectedAgent];
    if (targetAgents.length === 0) {
      appendEntry(sessionId, {
        id: uid(),
        agentId: selectedAgent.id,
        speaker: "agent",
        text: "还没有可对话的女主角。请先在 Settings 里添加并配置一个 API 女主。",
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
    void updateDirectorStory([...baseTranscript, userEntry, ...turnEntries]);
  };

  const updateAgent = (agentId: string, patch: Partial<AgentConfig>) => {
    void saveState({
      ...state,
      agents: state.agents.map((agent) => (agent.id === agentId ? { ...agent, ...patch } : agent))
    });
  };

  const updateDirector = (patch: Partial<DirectorConfig>) => {
    void saveState({
      ...state,
      director: {
        ...(state.director || defaultDirectorConfig),
        ...patch
      }
    });
  };

  const updateModelConfig = (modelConfigId: string, patch: Partial<ModelConfig>) => {
    void saveState({
      ...state,
      modelConfigs: modelConfigs.map((config) => (config.id === modelConfigId ? { ...config, ...patch } : config))
    });
  };

  const addModelConfig = () => {
    const nextConfig = createModelConfig(modelConfigs);
    setSelectedModelConfigId(nextConfig.id);
    void saveState({
      ...state,
      modelConfigs: [...modelConfigs, nextConfig]
    });
  };

  const deleteSelectedModelConfig = () => {
    if (modelConfigs.length <= 1) return;
    const fallbackConfig = modelConfigs.find((config) => config.id !== selectedModelConfig.id) || defaultModelConfig;
    setSelectedModelConfigId(fallbackConfig.id);
    void saveState({
      ...state,
      modelConfigs: modelConfigs.filter((config) => config.id !== selectedModelConfig.id),
      director:
        state.director?.modelConfigId === selectedModelConfig.id
          ? { ...(state.director || defaultDirectorConfig), modelConfigId: fallbackConfig.id }
          : state.director,
      agents: state.agents.map((agent) =>
        agent.modelConfigId === selectedModelConfig.id ? { ...agent, modelConfigId: fallbackConfig.id } : agent
      )
    });
  };

  const clearCurrentTranscript = () => {
    void saveState({
      ...state,
      transcripts: {
        ...state.transcripts,
        [sessionId]: state.story ? [makeStoryOpeningEntry(state.story)] : []
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
      story: state.story,
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

  const addCompanionAgent = () => {
    const nextAgent = createCompanionAgent(state.agents);
    void saveState({
      ...state,
      agents: [...state.agents, nextAgent],
      selectedAgentId: nextAgent.id
    });
    setSettingsOpen(true);
  };

  const addCreatorHeroine = () => {
    const nextAgent = createCompanionAgent(state.agents);
    void saveState({
      ...state,
      agents: [...state.agents, nextAgent],
      selectedAgentId: nextAgent.id
    });
  };

  const deleteSelectedAgent = () => {
    if (!selectedAgent || state.agents.length <= 1) return;
    const nextSelectedId = state.agents.find((agent) => agent.id !== selectedAgent.id)?.id || defaultAgents[0].id;
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
  };

  const statusText = agentIsRunning
    ? `${state.haremMode ? "大家" : stageAgent?.characterName} 正在回应`
    : !activeEntry
      ? state.storyStarted
        ? "可以输入第一句"
        : "等待剧情生成"
      : !isViewingLatest
        ? `回顾 ${safeViewEntryIndex + 1}/${visibleTranscript.length}`
        : latestPlaybackPending
          ? "点击画面推进对白"
          : "可以输入下一句";

  return (
    <main className="app-shell" style={{ "--agent-accent": stageAgent?.accent } as CSSProperties}>
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
                  <small>{state.story?.title || "API galgame"}</small>
                </div>
              </div>

              <nav className="cast-strip" aria-label="Heroines">
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
                <span>后宫模式</span>
                <strong>{state.haremMode ? "ON" : "OFF"}</strong>
                <small>{companionAgents.length} 位女主会按顺序接话</small>
              </button>

              <div className="vn-actions">
                <button className="icon-button" onClick={() => void saveCurrentGame()} title="保存存档">
                  <Save size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMenuOpen(false);
                    setScreen("load");
                  }}
                  title="读取存档"
                >
                  <FolderOpen size={17} />
                </button>
                <button className="icon-button" onClick={() => void generateStory(true)} title="换一段剧情">
                  <RefreshCcw size={17} />
                </button>
                <button className="icon-button" onClick={() => void exportSession()} title="导出对话">
                  <Save size={17} />
                </button>
                <button className="icon-button" onClick={clearCurrentTranscript} title="重置当前场景">
                  <Eraser size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMenuOpen(false);
                    setHelpOpen((value) => !value);
                  }}
                  title="玩法说明"
                >
                  <HelpCircle size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen((value) => !value);
                  }}
                  title="设置"
                >
                  <Settings size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setMenuOpen(false);
                    setRawOpen((value) => !value);
                  }}
                  title="日志"
                >
                  <FileText size={17} />
                </button>
              </div>
              {saveMessage ? <div className="save-message compact">{saveMessage}</div> : null}
            </div>
          ) : null}
        </header>

        <section className="character-panel" aria-label="Heroines on stage">
          {stageCharacters.map((agent, index) => {
            const isActive = agent.id === stageAgent?.id;
            return (
              <div
                key={agent.id}
                className={`character-stand ${isActive ? "active" : ""}`}
                style={stageCharacterStyle(index, stageCharacters.length, isActive, agent.accent)}
                aria-label={agent.characterName}
              >
                {agent.portraitPath ? (
                  <img
                    className="character-image"
                    src={filePathToAssetUrl(agent.portraitPath)}
                    alt={agent.characterName}
                  />
                ) : (
                  <div className="character-sprite">
                    <div className="hair" />
                    <div className="face">
                      <span />
                    </div>
                    <div className="kimono">
                      <Sparkles size={44} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {screen === "title" ? (
          <section className="title-screen">
            <div className="title-panel">
              <div className="title-mark">
                <Sparkles size={26} />
              </div>
              <div className="title-copy">
                <span>Visual Novel Chat</span>
                <h1>GalCode</h1>
                <p>{saveSlots.length ? `${saveSlots.length}/10 个存档` : state.story?.title || "还没有载入剧情"}</p>
              </div>
              <div className="title-actions">
                <button className="title-button primary" type="button" onClick={() => void startNewGame()}>
                  <Play size={19} />
                  新游戏
                </button>
                <button className="title-button" type="button" onClick={loadGame}>
                  <FolderOpen size={19} />
                  加载游戏
                </button>
                <button className="title-button" type="button" onClick={() => setSettingsOpen(true)}>
                  <Settings size={19} />
                  设置
                </button>
              </div>
            </div>
          </section>
        ) : screen === "load" ? (
          <section className="load-screen">
            <div className="load-panel">
              <header className="load-header">
                <div>
                  <span>Load Game</span>
                  <h1>读取存档</h1>
                  <p>最多保留 10 个剧情存档；继续保存会自动覆盖最旧的槽位。</p>
                </div>
                <button className="tool-button" type="button" onClick={() => setScreen("title")}>
                  <ChevronLeft size={17} />
                  返回
                </button>
              </header>

              {saveMessage ? <div className="save-message">{saveMessage}</div> : null}

              <div className="save-slot-list">
                {saveSlots.length === 0 ? (
                  <article className="save-slot empty">
                    <strong>暂无存档</strong>
                    <span>进入剧情后，可以在 Menu 里保存当前游戏。</span>
                  </article>
                ) : (
                  saveSlots.map((save, index) => (
                    <article className="save-slot" key={save.id}>
                      <div className="save-slot-index">{String(index + 1).padStart(2, "0")}</div>
                      <div className="save-slot-body">
                        <strong>{save.storyTitle}</strong>
                        <span>{new Date(save.savedAt).toLocaleString()}</span>
                        <p>{save.summary}</p>
                        <small>{save.heroineNames.filter(Boolean).join(" / ") || "未命名女主"}</small>
                      </div>
                      <div className="save-slot-actions">
                        <button className="tool-button primary-tool" type="button" onClick={() => void loadSave(save.id)}>
                          <Play size={17} />
                          读取
                        </button>
                        <button
                          className="tool-button"
                          type="button"
                          onClick={() => void saveCurrentGame(save.id)}
                          disabled={!state.story}
                        >
                          <Save size={17} />
                          覆盖
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : screen === "creator" || !state.storyStarted ? (
          <section className="creator-room">
            <div className="creator-header">
              <div className="story-mark">
                <Wand2 size={22} />
              </div>
              <div>
                <span>New Game Studio</span>
                <h1>创作室</h1>
                <p>你只负责灵感，导演负责整理成可玩的女主设定和剧情开场。</p>
              </div>
            </div>

            <div className="creator-layout">
              <section className="creator-card heroine-lab">
                <div className="creator-section-heading">
                  <div>
                    <strong>女主角</strong>
                    <span>
                      {state.story
                        ? `当前会参考《${state.story.title}》同步信念、边界和冲突后果。`
                        : "名字和一段印象就够了，描述可以留空。"}
                    </span>
                  </div>
                  <div className="creator-mini-actions">
                    <button className="tool-button" type="button" onClick={addCreatorHeroine}>
                      <Plus size={17} />
                      添加
                    </button>
                    <button
                      className="tool-button primary-tool"
                      type="button"
                      onClick={() => void generateAllHeroineDrafts()}
                      disabled={creatorBusy !== null}
                    >
                      <Sparkles size={17} />
                      {state.story ? "全部按剧情完善" : "全部完善"}
                    </button>
                  </div>
                </div>

                <div className="heroine-draft-list">
                  {state.agents.map((agent) => (
                    <article className="heroine-draft-card" key={agent.id}>
                      <div className="heroine-draft-title">
                        <span style={{ background: agent.accent }} />
                        <input
                          value={agent.characterName}
                          onChange={(event) =>
                            updateAgentSimple(agent.id, {
                              characterName: event.target.value,
                              name: event.target.value || agent.name
                            })
                          }
                          aria-label={`${agent.characterName} name`}
                        />
                      </div>
                      <textarea
                        value={agent.userDescription || ""}
                        onChange={(event) => updateAgentSimple(agent.id, { userDescription: event.target.value })}
                        placeholder="比如：冷静的学姐，喜欢甜食测评，不太会表达关心。"
                      />
                      <p>{agent.role}</p>
                      <div className="heroine-draft-actions">
                        <button
                          className="tool-button"
                          type="button"
                          onClick={() => void generateHeroineDraft(agent.id)}
                          disabled={creatorBusy !== null}
                        >
                          <Wand2 size={17} />
                          {state.story ? "按剧情完善" : "导演完善"}
                        </button>
                        <button
                          className="tool-button"
                          type="button"
                          onClick={() =>
                            setAdvancedPromptOpen((current) => ({ ...current, [agent.id]: !current[agent.id] }))
                          }
                        >
                          <FileText size={17} />
                          高级
                        </button>
                      </div>
                      {advancedPromptOpen[agent.id] ? (
                        <textarea
                          className="advanced-prompt-editor"
                          value={agent.systemPrompt || ""}
                          onChange={(event) => updateAgentSimple(agent.id, { systemPrompt: event.target.value })}
                          placeholder="导演生成的隐藏 system prompt 会出现在这里。"
                        />
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>

              <section className="creator-card story-lab">
                <div className="creator-section-heading">
                  <div>
                    <strong>故事创作</strong>
                    <span>像和编剧聊天一样给导演补充背景、氛围和禁忌。</span>
                  </div>
                </div>

                <textarea
                  className="story-idea-input"
                  value={storyIdea}
                  onChange={(event) => setStoryIdea(event.target.value)}
                  placeholder="比如：雨天、旧书店、几位女主以前认识但失散过；不要太恋爱脑，加一点悬疑。"
                />

                <div className="story-actions">
                  <button
                    className="tool-button primary-tool"
                    type="button"
                    onClick={() => void generateStoryDraft(false)}
                    disabled={creatorBusy !== null}
                  >
                    <Wand2 size={17} />
                    {state.story ? "完善剧情" : "生成剧情"}
                  </button>
                  <button
                    className="tool-button"
                    type="button"
                    onClick={() => void generateStoryDraft(true)}
                    disabled={creatorBusy !== null}
                  >
                    <RefreshCcw size={17} />
                    重新生成
                  </button>
                  <button className="tool-button" type="button" onClick={() => setSettingsOpen(true)}>
                    <Settings size={17} />
                    模型设置
                  </button>
                  <button
                    className="tool-button primary-tool"
                    type="button"
                    onClick={() => void enterStory()}
                    disabled={!state.story || creatorBusy !== null}
                  >
                    <Play size={17} />
                    进入剧情
                  </button>
                </div>

                {creatorError || storyError ? <div className="story-error">{creatorError || storyError}</div> : null}
                {creatorBusy ? (
                  <span className="story-loading">
                    {creatorBusy === "heroine" ? "导演正在整理女主设定..." : "导演正在铺陈新的开场..."}
                  </span>
                ) : null}

                {state.story ? (
                  <article className="story-preview">
                    <strong>{state.story.title}</strong>
                    <p>{state.story.opening}</p>
                  </article>
                ) : (
                  <article className="story-preview empty">
                    <strong>还没有剧情草案</strong>
                    <p>可以先写一点背景，也可以直接让导演根据女主阵容生成。</p>
                  </article>
                )}

                <div className="creator-log">
                  {creatorMessages.length === 0 ? (
                    <p>导演会在这里记录创作过程。</p>
                  ) : (
                    creatorMessages.slice(-8).map((message) => (
                      <article key={message.id} data-speaker={message.speaker}>
                        <strong>{message.speaker === "user" ? "你" : "导演"}</strong>
                        <span>{message.text}</span>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </section>
        ) : (
          <section className="dialogue-surface">
            <header className="scene-toolbar">
              <div>
                <span className="status-dot" data-running={runningSessions[sessionId] ? "true" : "false"} />
                <strong>{state.haremMode ? "后宫模式" : stageAgent?.characterName}</strong>
                <small>
                  {state.haremMode
                    ? `${companionAgents.length} 位女主 / ${state.story?.title || "未命名剧情"}`
                    : `${stageAgent?.name} / ${state.story?.title || "未命名剧情"}`}
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
                  <span>{showFullOutput ? "全文" : `${safePlaybackPageIndex + 1}/${activePages.length}`}</span>
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
              <span>{statusText}</span>
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
                <button className="vn-command-button" type="button" onClick={skipDialogue} disabled={!playbackPending}>
                  <FastForward size={17} />
                  Skip
                </button>
              </div>
            </div>

            {promptIsAvailable ? (
              <form className="prompt-bar" onSubmit={sendPrompt}>
                <input
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={state.haremMode ? "对大家说..." : `对${stageAgent?.characterName}说...`}
                  disabled={!promptIsAvailable}
                />
                <button className="send-button" type="submit" disabled={!promptIsAvailable}>
                  <Send size={18} />
                  Send
                </button>
              </form>
            ) : null}
          </section>
        )}
      </section>

      {settingsOpen && selectedAgent ? (
        <aside className="settings-panel">
          <header>
            <h2>Settings</h2>
            <div className="panel-actions">
              <button className="icon-button" onClick={() => void saveState(state)} title="Save">
                <Save size={18} />
              </button>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} title="Close settings">
                <X size={18} />
              </button>
            </div>
          </header>

          <section className="settings-section">
            <div className="section-title">
              <Settings size={16} />
              <strong>模型配置</strong>
            </div>
            <label>
              当前模型配置
              <select value={selectedModelConfig.id} onChange={(event) => setSelectedModelConfigId(event.target.value)}>
                {modelConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name || config.model || config.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              名称
              <input
                value={selectedModelConfig.name}
                onChange={(event) => updateModelConfig(selectedModelConfig.id, { name: event.target.value })}
                placeholder="例如 Qwen 本地接口"
              />
            </label>
            <label>
              API URL
              <input
                value={selectedModelConfig.apiUrl}
                onChange={(event) => updateModelConfig(selectedModelConfig.id, { apiUrl: event.target.value })}
                placeholder="https://api.example.com/v1"
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={selectedModelConfig.apiKey}
                onChange={(event) => updateModelConfig(selectedModelConfig.id, { apiKey: event.target.value })}
                placeholder="sk-..."
              />
            </label>
            <label>
              Model
              <input
                value={selectedModelConfig.model}
                onChange={(event) => updateModelConfig(selectedModelConfig.id, { model: event.target.value })}
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
                value={selectedModelConfig.temperature}
                onChange={(event) => updateModelConfig(selectedModelConfig.id, { temperature: Number(event.target.value) })}
              />
            </label>
            <div className="asset-actions">
              <button className="tool-button" onClick={addModelConfig}>
                <Plus size={17} />
                Add Model
              </button>
              <button className="tool-button danger" onClick={deleteSelectedModelConfig} disabled={modelConfigs.length <= 1}>
                <Trash2 size={17} />
                Delete Model
              </button>
            </div>
          </section>

          <section className="settings-section">
            <div className="section-title">
              <Wand2 size={16} />
              <strong>导演 Agent</strong>
            </div>
            <label>
              使用模型
              <select
                value={state.director?.modelConfigId || selectedModelConfig.id}
                onChange={(event) => updateDirector({ modelConfigId: event.target.value })}
              >
                {modelConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name || config.model || config.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Director Prompt
              <textarea
                value={state.director?.systemPrompt || defaultDirectorConfig.systemPrompt}
                onChange={(event) => updateDirector({ systemPrompt: event.target.value })}
              />
            </label>
            <div className="asset-actions">
              <button className="tool-button" onClick={() => void generateStory(state.storyStarted)}>
                <RefreshCcw size={17} />
                生成/换剧情
              </button>
            </div>
          </section>

          <section className="settings-section">
            <div className="section-title">
              <Bot size={16} />
              <strong>女主角</strong>
            </div>
            <label>
              当前女主
              <select
                value={selectedAgent.id}
                onChange={(event) => void saveState({ ...state, selectedAgentId: event.target.value })}
              >
                {state.agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.characterName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              使用模型
              <select
                value={selectedAgent.modelConfigId || selectedModelConfig.id}
                onChange={(event) => updateAgent(selectedAgent.id, { modelConfigId: event.target.value })}
              >
                {modelConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name || config.model || config.id}
                  </option>
                ))}
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
              Display Name
              <input
                value={selectedAgent.name}
                onChange={(event) => updateAgent(selectedAgent.id, { name: event.target.value })}
              />
            </label>
            <label>
              Identity
              <input
                value={selectedAgent.role}
                onChange={(event) => updateAgent(selectedAgent.id, { role: event.target.value })}
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
            <label>
              Personality / System Prompt
              <textarea
                value={selectedAgent.systemPrompt || ""}
                onChange={(event) => updateAgent(selectedAgent.id, { systemPrompt: event.target.value })}
                placeholder="她是谁、怎么说话、和用户是什么关系。"
              />
            </label>
            <label>
              Accent
              <input
                type="color"
                value={selectedAgent.accent}
                onChange={(event) => updateAgent(selectedAgent.id, { accent: event.target.value })}
              />
            </label>
            <div className="asset-actions">
              <button className="tool-button" onClick={addCompanionAgent}>
                <Plus size={17} />
                Add Heroine
              </button>
              <button className="tool-button" onClick={resetSelectedAgent} disabled={!isDefaultAgent(selectedAgent.id)}>
                <Save size={17} />
                Reset
              </button>
              <button className="tool-button danger" onClick={deleteSelectedAgent} disabled={state.agents.length <= 1}>
                <Trash2 size={17} />
                Delete
              </button>
            </div>
          </section>
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
              <strong>配置模型。</strong>
              <span>先在模型配置里填 API URL、API Key、模型名和温度。</span>
            </li>
            <li>
              <strong>分配模型。</strong>
              <span>导演和每个女主都通过下拉菜单选择一个已配置模型。</span>
            </li>
            <li>
              <strong>进入创作室。</strong>
              <span>新游戏会先进入创作室，填写女主名字和描述后让导演完善设定。</span>
            </li>
            <li>
              <strong>创作剧情。</strong>
              <span>把故事背景讲给导演，生成、完善或重新生成开场草案。</span>
            </li>
            <li>
              <strong>打开后宫模式。</strong>
              <span>同一句话会按顺序发给所有女主，后面的女主能看到前面的回复。</span>
            </li>
          </ol>
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
                  <strong>{entry.speaker === "user" ? "You" : getEntrySpeakerName(entry, state.agents)}</strong>
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

function getEntrySpeakerName(entry: TranscriptEntry, agents: AgentConfig[]) {
  const agent = agents.find((item) => item.id === entry.agentId);
  return agent?.characterName || agent?.name || "旁白";
}

function getStageCharactersForEntry(
  activeEntry: TranscriptEntry | undefined,
  agents: AgentConfig[]
) {
  if (!activeEntry || activeEntry.speaker !== "agent") return [];
  const activeAgent = agents.find((agent) => agent.id === activeEntry.agentId);
  if (!activeAgent) return [];

  const visibleIds = Array.isArray(activeEntry.visibleAgentIds) ? activeEntry.visibleAgentIds : [];
  if (visibleIds.length <= 1) return [activeAgent];

  const byId = new Map<string, AgentConfig>([[activeAgent.id, activeAgent]]);
  for (const agentId of visibleIds) {
    const agent = agents.find((item) => item.id === agentId);
    if (agent) byId.set(agent.id, agent);
  }

  return Array.from(byId.values()).slice(0, 5);
}

function stageCharacterStyle(index: number, count: number, isActive: boolean, accent: string): CSSProperties {
  const spread = count <= 1 ? 0 : Math.min(18, 54 / count);
  const offset = index - (count - 1) / 2;
  return {
    "--character-left": `${50 + offset * spread}%`,
    "--character-scale": isActive ? 1 : 0.9,
    "--stand-accent": accent,
    zIndex: isActive ? 4 : 2 + index
  } as CSSProperties;
}

function makeStoryOpeningEntry(story: StoryState): TranscriptEntry {
  return {
    id: uid(),
    agentId: "narrator",
    speaker: "agent",
    text: story.opening,
    at: now()
  };
}

export default App;
