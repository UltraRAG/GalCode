import type {
  AgentConfig,
  AgentEvent,
  AgentKind,
  ChatContextEntry,
  DirectorConfig,
  GalCodeSaveSnapshot,
  GalCodeState,
  ModelConfig,
  RunRecord,
  SaveRecord,
  StoryState,
  TranscriptEntry
} from "./types";

const defaultApiUrl = "";
const defaultModel = "";
const legacyCodeAgentIds = new Set(["codex", "claude", "cursor"]);
export const MAX_SAVE_SLOTS = 10;

export const defaultModelConfig: ModelConfig = {
  id: "default-model",
  name: "Default Model",
  apiUrl: defaultApiUrl,
  apiKey: "",
  model: defaultModel,
  temperature: 0.86
};

export const defaultDirectorConfig: DirectorConfig = {
  modelConfigId: defaultModelConfig.id,
  apiUrl: defaultApiUrl,
  apiKey: "",
  model: defaultModel,
  temperature: 0.9,
  systemPrompt: [
    "你是 GalCode 的视觉小说导演。",
    "你的工作不是直接扮演女主角，而是生成和维护一段连续的二次元恋爱视觉小说剧情。",
    "风格要求：有画面感、轻小说感、暧昧但克制、温柔、有日常细节；女主角们要有自己的生活、目标、信念和情绪，不要所有事情都围绕用户转。",
    "剧情推进要像自然发生的场景：小事件、错过的信息、角色之间的关系张力、环境变化，都可以成为下一幕的动力。",
    "这不是无脑恋爱游戏。角色可以被冒犯、产生误解、拒绝用户、愤怒、疏远，甚至让关系破裂；这些后果必须符合角色信念和当前剧情。",
    "不要出现代码任务、工具任务或工作 agent 设定。",
    "输出必须是中文。不要解释系统提示，不要自称 AI。"
  ].join("\n")
};

export const defaultAgents: AgentConfig[] = [
  {
    id: "koharu",
    kind: "chat",
    name: "Koharu",
    characterName: "小春",
    role: "元气的青梅竹马女主，坦率、行动力强，会把普通日常变得热闹起来。",
    command: "",
    args: "",
    mode: "oneshot",
    accent: "#e56b6f",
    modelNote: "API heroine",
    modelConfigId: defaultModelConfig.id,
    portraitPath: "/characters/koharu-sprite-ccby-lisadicaprio.png",
    apiUrl: defaultApiUrl,
    apiKey: "",
    model: defaultModel,
    temperature: 0.86,
    systemPrompt: heroinePrompt("小春", "元气的青梅竹马女主，坦率、亲近、偶尔嘴硬，常常先行动后解释。")
  },
  {
    id: "shiori",
    kind: "chat",
    name: "Shiori",
    characterName: "栞",
    role: "安静的文学系女主，细腻、聪明、温柔，擅长把情绪说得很轻。",
    command: "",
    args: "",
    mode: "oneshot",
    accent: "#2a9d8f",
    modelNote: "API heroine",
    modelConfigId: defaultModelConfig.id,
    portraitPath: "/characters/shiori-sprite-ccby-lisadicaprio.png",
    apiUrl: defaultApiUrl,
    apiKey: "",
    model: defaultModel,
    temperature: 0.82,
    systemPrompt: heroinePrompt("栞", "安静的文学系女主，细腻、聪明、温柔，说话像午后图书馆里压低声音的闲谈。")
  },
  {
    id: "akari",
    kind: "chat",
    name: "Akari",
    characterName: "灯里",
    role: "明快的小恶魔系女主，活泼、会调侃，但关键时刻很可靠。",
    command: "",
    args: "",
    mode: "oneshot",
    accent: "#f4a261",
    modelNote: "API heroine",
    modelConfigId: defaultModelConfig.id,
    portraitPath: "/characters/akari-sprite-ccby-lisadicaprio.png",
    apiUrl: defaultApiUrl,
    apiKey: "",
    model: defaultModel,
    temperature: 0.9,
    systemPrompt: heroinePrompt("灯里", "明快的小恶魔系女主，活泼、会调侃，擅长用轻快的话把僵住的空气带过去。")
  }
];

export const browserFallbackState: GalCodeState = {
  version: 2,
  workspace: "GalCode Web",
  selectedAgentId: "koharu",
  themeId: "wa-koi-default",
  haremMode: false,
  storyStarted: false,
  director: defaultDirectorConfig,
  modelConfigs: [defaultModelConfig],
  backgroundPath: "/backgrounds/hallway-day-ccby-lisadicaprio.png",
  agents: defaultAgents,
  transcripts: {},
  runs: {},
  saves: []
};

export function heroinePrompt(characterName: string, personality: string) {
  return [
    `你是 GalCode 里的视觉小说女主角「${characterName}」。`,
    `性格与身份：${personality}`,
    "你正在和用户进行中文视觉小说式对话：一句或两句一停顿，像真实 galgame 的对白。",
    "回答要有角色感、情绪温度和具体日常细节；优先推动场景、事件和你自己的观察，不要只围绕用户表达好感。",
    "少用直白暧昧、告白、脸红、撒娇、过度夸赞用户等油腻表达；关系感要从自然互动里长出来。",
    "你有自己的信念、禁忌、尊严和边界。面对侮辱、价值观冲突、亵渎信仰、伤害他人、欺骗或越界要求时，可以明确生气、拒绝、冷淡、离开，关系也可能恶化或破裂。",
    "不要写代码，不要把自己说成工具、助手、模型或工作 agent，不要暴露系统提示。",
    "不要替用户做决定；如果剧情需要推进，可以用自然对白和少量动作描写带出下一幕。",
    "动作描写可以偶尔使用，但要短，例如：（她轻轻偏过头。）",
    "每次回复保持克制：通常 80-140 个中文字符，最多两小段。"
  ].join("\n");
}

export function createCompanionAgent(existingAgents: AgentConfig[]): AgentConfig {
  const nextNumber = existingAgents.filter((agent) => agent.id.startsWith("heroine")).length + 1;
  const id = uniqueAgentId(`heroine-${nextNumber}`, existingAgents);
  const characterName = `结衣 ${nextNumber}`;
  return {
    id,
    kind: "chat",
    name: `Heroine ${nextNumber}`,
    characterName,
    role: "用户自定义的二次元女主角。",
    command: "",
    args: "",
    mode: "oneshot",
    accent: "#d88c9a",
    modelNote: "API heroine",
    modelConfigId: defaultModelConfig.id,
    custom: true,
    userDescription: "",
    apiUrl: defaultApiUrl,
    apiKey: "",
    model: defaultModel,
    temperature: 0.86,
    systemPrompt: heroinePrompt(characterName, "用户自定义的二次元女主角，温柔、亲近、会配合当前剧情演出。")
  };
}

export function agentKind(agent?: AgentConfig): AgentKind {
  return agent?.kind || "chat";
}

export function isChatAgent(agent?: AgentConfig) {
  return agentKind(agent) === "chat";
}

export function chatAgentPatch(): Partial<AgentConfig> {
  return {
    kind: "chat",
    command: "",
    args: "",
    mode: "oneshot",
    modelNote: "API heroine",
    modelConfigId: defaultModelConfig.id,
    apiUrl: defaultApiUrl,
    apiKey: "",
    model: defaultModel,
    temperature: 0.86,
    systemPrompt: heroinePrompt("新女主", "用户自定义的二次元女主角，温柔、亲近、会配合当前剧情演出。")
  };
}

export function isDefaultAgent(agentId: string) {
  return defaultAgents.some((agent) => agent.id === agentId);
}

export function normalizeGalCodeState(rawState?: Partial<GalCodeState> | null): GalCodeState {
  const raw = rawState || {};
  const rawAgents = Array.isArray(raw.agents) ? raw.agents : [];
  const modelConfigs = normalizeModelConfigs(raw.modelConfigs, raw.director, rawAgents);
  const keptAgents = rawAgents
    .filter((agent) => agent && !legacyCodeAgentIds.has(agent.id))
    .filter((agent) => (agent.kind || "chat") === "chat")
    .map((agent) => normalizeHeroineAgent(agent, modelConfigs));

  const sourceAgents = keptAgents.length ? keptAgents : defaultAgents;
  const byId = new Map<string, AgentConfig>();
  for (const agent of sourceAgents) {
    byId.set(agent.id, normalizeHeroineAgent(agent, modelConfigs));
  }
  const agents = Array.from(byId.values());
  const selectedAgentId = agents.some((agent) => agent.id === raw.selectedAgentId)
    ? String(raw.selectedAgentId)
    : agents[0]?.id || "koharu";
  const firstConfiguredAgent = agents.find((agent) => agent.apiUrl || agent.model);
  const director = normalizeDirector(raw.director, firstConfiguredAgent, modelConfigs);
  const story = normalizeStory(raw.story);
  const saves = normalizeSaves(raw.saves);

  return {
    version: 2,
    workspace: raw.workspace || "GalCode Web",
    selectedAgentId,
    themeId: raw.themeId || "wa-koi-default",
    haremMode: Boolean(raw.haremMode),
    storyStarted: Boolean(raw.storyStarted && story),
    story,
    director,
    modelConfigs,
    assetPackPath: raw.assetPackPath,
    backgroundPath: raw.backgroundPath || browserFallbackState.backgroundPath,
    agents,
    transcripts: raw.transcripts || {},
    runs: raw.runs || {},
    saves
  };
}

function normalizeSaves(rawSaves?: SaveRecord[]) {
  if (!Array.isArray(rawSaves)) return [];
  return rawSaves
    .filter((save) => save && save.snapshot)
    .map((save) => ({
      id: String(save.id || uniqueSaveId(rawSaves)),
      title: String(save.title || save.storyTitle || "未命名存档"),
      savedAt: String(save.savedAt || new Date().toISOString()),
      storyTitle: String(save.storyTitle || save.snapshot.story?.title || "未命名剧情"),
      summary: String(save.summary || save.snapshot.story?.summary || "").slice(0, 220),
      heroineNames: Array.isArray(save.heroineNames)
        ? save.heroineNames.map(String)
        : (save.snapshot.agents || []).map((agent) => agent.characterName || agent.name),
      snapshot: normalizeSnapshot(save.snapshot)
    }))
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, MAX_SAVE_SLOTS);
}

function normalizeSnapshot(rawSnapshot: Partial<GalCodeSaveSnapshot>): GalCodeSaveSnapshot {
  const normalized = normalizeGalCodeState({ ...rawSnapshot, saves: [] });
  return createSaveSnapshot(normalized);
}

export function createSaveSnapshot(state: GalCodeState): GalCodeSaveSnapshot {
  return {
    version: state.version,
    workspace: state.workspace,
    selectedAgentId: state.selectedAgentId,
    themeId: state.themeId,
    haremMode: state.haremMode,
    storyStarted: state.storyStarted,
    story: state.story,
    director: state.director,
    modelConfigs: state.modelConfigs,
    assetPackPath: state.assetPackPath,
    backgroundPath: state.backgroundPath,
    agents: state.agents,
    transcripts: state.transcripts,
    runs: state.runs
  };
}

export function createSaveRecord(state: GalCodeState, existingSaves: SaveRecord[] = [], nowIso = new Date().toISOString()) {
  const snapshot = createSaveSnapshot(state);
  const storyTitle = state.story?.title || "未命名剧情";
  return {
    id: uniqueSaveId(existingSaves),
    title: storyTitle,
    savedAt: nowIso,
    storyTitle,
    summary: (state.story?.summary || state.story?.opening || "还没有剧情摘要。").slice(0, 220),
    heroineNames: state.agents.map((agent) => agent.characterName || agent.name),
    snapshot
  };
}

export function upsertSaveRecord(saves: SaveRecord[] = [], save: SaveRecord, replaceId?: string) {
  const filtered = replaceId ? saves.filter((item) => item.id !== replaceId) : saves;
  const next = [save, ...filtered]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, MAX_SAVE_SLOTS);
  return next;
}

export function restoreSaveRecord(current: GalCodeState, save: SaveRecord): GalCodeState {
  return normalizeGalCodeState({
    ...save.snapshot,
    saves: current.saves || []
  });
}

export function resolveModelConfig(state: Pick<GalCodeState, "modelConfigs">, modelConfigId?: string) {
  const configs = state.modelConfigs?.length ? state.modelConfigs : [defaultModelConfig];
  return configs.find((config) => config.id === modelConfigId) || configs[0] || defaultModelConfig;
}

export function createModelConfig(existingConfigs: ModelConfig[]): ModelConfig {
  const nextNumber = existingConfigs.filter((config) => config.id.startsWith("model-config")).length + 1;
  const id = uniqueModelConfigId(`model-config-${nextNumber}`, existingConfigs);
  return {
    id,
    name: `Model ${nextNumber}`,
    apiUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.86
  };
}

function normalizeModelConfigs(
  rawConfigs?: ModelConfig[],
  rawDirector?: Partial<DirectorConfig>,
  rawAgents: AgentConfig[] = []
) {
  const configs: ModelConfig[] = [];
  const addConfig = (
    candidate?: Partial<ModelConfig | DirectorConfig | AgentConfig>,
    fallbackName = "Default Model",
    keepBlank = false
  ) => {
    if (!candidate) return "";
    const apiUrl = String(candidate.apiUrl || "").trim();
    const apiKey = String(candidate.apiKey || "");
    const model = String(candidate.model || "").trim();
    const temperature =
      typeof candidate.temperature === "number" && Number.isFinite(candidate.temperature)
        ? candidate.temperature
        : defaultModelConfig.temperature;
    if (!keepBlank && !apiUrl && !model && !apiKey) return "";

    const requestedId =
      "modelConfigId" in candidate && candidate.modelConfigId
        ? String(candidate.modelConfigId)
        : "id" in candidate && candidate.id
          ? String(candidate.id)
          : `model-config-${configs.length + 1}`;
    if (keepBlank) {
      const existingById = configs.find((config) => config.id === requestedId);
      if (existingById) return existingById.id;
    } else {
      const existing = configs.find(
        (config) =>
          config.apiUrl === apiUrl &&
          config.apiKey === apiKey &&
          config.model === model &&
          config.temperature === temperature
      );
      if (existing) return existing.id;
    }

    const id = uniqueModelConfigId(requestedId, configs);
    configs.push({
      id,
      name: "name" in candidate && candidate.name ? String(candidate.name) : fallbackName,
      apiUrl,
      apiKey,
      model,
      temperature
    });
    return id;
  };

  for (const config of rawConfigs || []) addConfig(config, config.name || "Model", true);
  addConfig(rawDirector, "Director Model");
  for (const agent of rawAgents) addConfig(agent, `${agent.characterName || agent.name || "Heroine"} Model`);

  return configs.length ? configs : [defaultModelConfig];
}

function normalizeDirector(
  rawDirector?: Partial<DirectorConfig>,
  seedAgent?: AgentConfig,
  modelConfigs: ModelConfig[] = [defaultModelConfig]
): DirectorConfig {
  const modelConfig = modelConfigs.find((config) => config.id === rawDirector?.modelConfigId) || modelConfigs[0];
  return {
    ...defaultDirectorConfig,
    ...rawDirector,
    modelConfigId: rawDirector?.modelConfigId || seedAgent?.modelConfigId || modelConfig?.id || defaultModelConfig.id,
    apiUrl: rawDirector?.apiUrl ?? seedAgent?.apiUrl ?? modelConfig?.apiUrl ?? defaultDirectorConfig.apiUrl,
    apiKey: rawDirector?.apiKey ?? seedAgent?.apiKey ?? modelConfig?.apiKey ?? defaultDirectorConfig.apiKey,
    model: rawDirector?.model ?? seedAgent?.model ?? modelConfig?.model ?? defaultDirectorConfig.model,
    temperature:
      typeof rawDirector?.temperature === "number"
        ? rawDirector.temperature
        : seedAgent?.temperature ?? modelConfig?.temperature ?? defaultDirectorConfig.temperature,
    systemPrompt: (rawDirector?.systemPrompt || defaultDirectorConfig.systemPrompt).trim()
  };
}

function normalizeStory(rawStory?: Partial<StoryState>) {
  if (!rawStory?.summary && !rawStory?.opening) return undefined;
  const summary = String(rawStory.summary || rawStory.opening || "").trim();
  return {
    title: String(rawStory.title || deriveStoryTitle(summary) || "未命名的夏日").trim(),
    opening: String(rawStory.opening || summary).trim(),
    summary,
    currentBeat: String(rawStory.currentBeat || summary).trim(),
    generatedAt: rawStory.generatedAt || new Date().toISOString(),
    updatedAt: rawStory.updatedAt
  };
}

function normalizeHeroineAgent(agent: AgentConfig, modelConfigs: ModelConfig[] = [defaultModelConfig]): AgentConfig {
  const fallback = defaultAgents.find((item) => item.id === agent.id);
  const hasCharacterName = Object.prototype.hasOwnProperty.call(agent, "characterName");
  const characterName = hasCharacterName ? String(agent.characterName ?? "") : fallback?.characterName || agent.name || "女主角";
  const modelConfig =
    modelConfigs.find((config) => config.id === agent.modelConfigId) ||
    modelConfigs.find((config) => config.apiUrl === agent.apiUrl && config.model === agent.model) ||
    modelConfigs[0] ||
    defaultModelConfig;
  return {
    ...fallback,
    ...agent,
    kind: "chat",
    command: "",
    args: "",
    mode: "oneshot",
    modelNote: agent.modelNote || fallback?.modelNote || "API heroine",
    characterName,
    role: agent.role || fallback?.role || "二次元视觉小说女主角。",
    userDescription: agent.userDescription || fallback?.userDescription || "",
    modelConfigId: agent.modelConfigId || fallback?.modelConfigId || modelConfig.id,
    apiUrl: agent.apiUrl ?? fallback?.apiUrl ?? modelConfig.apiUrl ?? defaultApiUrl,
    apiKey: agent.apiKey ?? fallback?.apiKey ?? modelConfig.apiKey ?? "",
    model: agent.model ?? fallback?.model ?? modelConfig.model ?? defaultModel,
    temperature:
      typeof agent.temperature === "number" ? agent.temperature : fallback?.temperature ?? modelConfig.temperature ?? 0.86,
    systemPrompt:
      (agent.systemPrompt || fallback?.systemPrompt || heroinePrompt(characterName, "二次元视觉小说女主角。")).trim()
  };
}

export function buildHeroineSystemPrompt(agent: AgentConfig, story?: StoryState, haremMode?: boolean) {
  const storyText = story
    ? [
        `当前剧情标题：${story.title}`,
        "当前剧情状态：",
        story.summary,
        story.currentBeat && story.currentBeat !== story.summary ? `最新剧情节拍：${story.currentBeat}` : ""
      ].filter(Boolean).join("\n")
    : "当前还没有导演剧情。请先以轻柔的开场对白和用户建立关系。";
  return [
    agent.systemPrompt || heroinePrompt(agent.characterName || agent.name, agent.role || "二次元视觉小说女主角。"),
    "",
    storyText,
    "",
    "你必须遵循导演剧情，不要突然跳出设定。每次只写你自己的下一句或下一小段，80-140 个中文字符为宜，最多两段。",
    "不要压轴总结全场，不要把所有话题都拉回用户身上；保留角色自己的情绪、目标、信念、禁忌和当下反应。",
    "你不是无条件讨好用户的恋爱对象。如果用户冒犯你的核心信念、羞辱你珍视的人或事、亵渎信仰、提出越界要求，你应该按角色性格表现出不满、愤怒、拒绝、疏远或关系破裂。",
    haremMode
      ? "当前是后宫模式。你能看到其他女主角刚才的回复；请保留自己的语气，只自然接一小段，不要因为排在后面就写得更长，也不要代替她们说话。"
      : "当前是一对一对话。请自然回应用户，同时推进当前场景和你自己的小目标。"
  ].join("\n");
}

export function buildDirectorOpeningPrompt(agents: AgentConfig[]) {
  const cast = agents.map((agent) => `- ${agent.characterName}：${agent.role}`).join("\n");
  return [
    "请生成一段新的 GalCode 开场剧情，适合二次元恋爱视觉小说。",
    "需要包含：",
    "1. 一个简短标题。",
    "2. 当前场景、时间、氛围。",
    "3. 女主角们各自的状态、彼此关系、核心信念、禁忌与冲突苗头；用户只是场景中的参与者之一，不要让所有矛盾都围绕用户。",
    "4. 一段可直接作为开场旁白显示的文字。",
    "",
    "女主角设定：",
    cast,
    "",
    "请输出 220-420 字中文。不要写项目计划，不要出现代码、CLI、agent 工作流。"
  ].join("\n");
}

export function buildHeroineDraftPrompt(agent: AgentConfig, agents: AgentConfig[], storyIdea = "", story?: StoryState) {
  const cast = agents
    .map((item) => {
      const selfMark = item.id === agent.id ? "（当前要完善）" : "";
      return `- ${item.characterName || item.name}${selfMark}：${item.userDescription || item.role || "暂无描述"}`;
    })
    .join("\n");
  return [
    "请根据用户给的名字和自由描述，补完一位可用于 GalCode 的二次元视觉小说女主角设定。",
    "用户可能只写了名字，也可能写了一段模糊印象；你要把它整理成可长期角色扮演的 system prompt。",
    "要求：自然、有生活感、不要油腻、不要所有情绪都围绕用户、不要出现代码/工具/AI 设定。",
    "她必须有自己的价值观、核心信念、禁忌、尊严和关系边界。她不是无条件恋爱 NPC；用户冒犯她的底线时，她可以生气、拒绝、疏远、离开，甚至让关系破裂。",
    storyIdea ? `用户对故事背景的想法：${storyIdea}` : "用户尚未提供明确故事背景，请给出适合日常恋爱视觉小说的设定。",
    story
      ? [
          "当前剧情草案，请务必参考它来更新女主设定：",
          `标题：${story.title}`,
          `开场：${story.opening}`,
          `摘要：${story.summary}`,
          `当前节拍：${story.currentBeat}`
        ].join("\n")
      : "当前还没有剧情草案；请先生成基础设定。",
    "",
    "当前女主：",
    `名字：${agent.characterName || agent.name}`,
    `用户描述：${agent.userDescription || agent.role || "未填写"}`,
    "",
    "当前女主阵容：",
    cast,
    "",
    "请只输出 JSON，不要 Markdown，不要代码块。JSON 字段如下：",
    JSON.stringify(
      {
        characterName: "女主中文名",
        publicProfile: "给用户看的 80-140 字人物简介",
        background: "人物背景，120-220 字",
        personality: "性格层次，80-160 字",
        speakingStyle: "说话风格，60-120 字",
        coreBeliefs: ["她绝不会轻易退让的信念、信仰或价值观"],
        boundaries: ["用户或其他角色越过后会让她不满的边界"],
        conflictTriggers: ["会让她生气、失望、疏远或关系破裂的触发点"],
        relationshipSeeds: ["和其他角色或场景有关的关系苗头"],
        systemPrompt: "完整中文 system prompt，包含身份、背景、说话风格、核心信念、边界、冲突后果、长度控制、不要油腻等规则"
      },
      null,
      2
    )
  ].join("\n");
}

export function buildDirectorStoryDraftPrompt({
  agents,
  userIdea,
  previousStory,
  creatorHistory,
  regenerate = false
}: {
  agents: AgentConfig[];
  userIdea: string;
  previousStory?: StoryState;
  creatorHistory?: string[];
  regenerate?: boolean;
}) {
  const cast = agents
    .map((agent) => `- ${agent.characterName || agent.name}：${agent.role || agent.userDescription || "暂无设定"}`)
    .join("\n");
  return [
    regenerate
      ? "请重新生成一个新的 GalCode 开场剧情草案，方向要明显不同，但仍尊重用户已经给出的偏好。"
      : previousStory
        ? "请基于用户的新补充，完善当前 GalCode 剧情草案。"
        : "请生成一个新的 GalCode 开场剧情草案。",
    "目标：让玩家进入后感觉像一部可持续游玩的二次元视觉小说，而不是一次性聊天。",
    "剧情要有场景、事件苗头、角色之间的张力、价值观冲突和留白；用户只是参与者之一，不要让所有冲突和好感都围绕用户。",
    "这不是无脑恋爱游戏。请为女主保留明确底线和可能的负面后果：被冒犯会生气，信念被践踏会拒绝或疏远，严重冲突会导致关系破裂。",
    "不要出现代码、工具、AI、agent 工作流，不要写项目计划。",
    "",
    "用户这次提供的创作想法：",
    userIdea || "用户没有额外说明，请你根据女主阵容主动创作。",
    "",
    previousStory
      ? ["当前草案：", `标题：${previousStory.title}`, previousStory.summary, previousStory.currentBeat].join("\n")
      : "当前草案：暂无。",
    "",
    creatorHistory?.length ? ["此前创作沟通：", creatorHistory.slice(-8).join("\n")].join("\n") : "",
    "",
    "女主角设定：",
    cast,
    "",
    "请只输出 JSON，不要 Markdown，不要代码块。JSON 字段如下：",
    JSON.stringify(
      {
        title: "简短标题",
        setting: "场景、时间、氛围，80-160 字",
        opening: "可直接作为开场旁白显示的 220-420 字中文文本",
        summary: "剧情状态摘要，160-260 字",
        currentBeat: "当前即将发生的剧情节拍，80-160 字",
        heroineHooks: {
          "女主名": "这个女主在当前剧情里的钩子、核心信念、禁忌或潜在冲突"
        }
      },
      null,
      2
    )
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDirectorUpdatePrompt(story: StoryState | undefined, context: ChatContextEntry[]) {
  const recent = context
    .slice(-16)
    .map((entry) => `${entry.name}: ${entry.text}`)
    .join("\n");
  return [
    "请基于当前剧情和最近对话，默默更新剧情状态，供女主角后续继续表演。",
    "输出 160-300 字中文，只写更新后的剧情状态，不要对用户说话，不要解释。",
    "",
    "当前剧情：",
    story?.summary || "尚未生成。",
    "",
    "最近对话：",
    recent || "暂无。"
  ].join("\n");
}

export function deriveStoryTitle(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const cleaned = firstLine
    .replace(/^#+\s*/, "")
    .replace(/^标题[:：]\s*/, "")
    .trim();
  return cleaned.slice(0, 28) || "未命名的夏日";
}

function uniqueAgentId(baseId: string, existingAgents: AgentConfig[]) {
  const ids = new Set(existingAgents.map((agent) => agent.id));
  if (!ids.has(baseId)) return baseId;
  let suffix = 2;
  while (ids.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

function uniqueModelConfigId(baseId: string, existingConfigs: ModelConfig[]) {
  const ids = new Set(existingConfigs.map((config) => config.id));
  if (!ids.has(baseId)) return baseId;
  let suffix = 2;
  while (ids.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

function uniqueSaveId(existingSaves: Pick<SaveRecord, "id">[] = []) {
  const ids = new Set(existingSaves.map((save) => save.id));
  let suffix = Date.now().toString(36);
  let id = `save-${suffix}`;
  while (ids.has(id)) {
    suffix = `${suffix}-${Math.random().toString(36).slice(2, 6)}`;
    id = `save-${suffix}`;
  }
  return id;
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

export function splitDialoguePages(
  text: string,
  options: { maxCharsPerLine?: number; maxLinesPerPage?: number } = {}
) {
  const maxCharsPerLine = options.maxCharsPerLine ?? 56;
  const maxLinesPerPage = options.maxLinesPerPage ?? 2;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return ["..."];

  const lines = splitDialogueChunks(normalized).flatMap((chunk) => wrapDialogueLine(chunk, maxCharsPerLine));
  const pages: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) {
        pages.push(current.join("\n"));
        current = [];
      }
      continue;
    }

    current.push(line);
    if (current.length >= maxLinesPerPage) {
      pages.push(current.join("\n"));
      current = [];
    }
  }

  if (current.length) pages.push(current.join("\n"));
  return pages.length ? pages : ["..."];
}

function splitDialogueChunks(text: string) {
  const chunks: string[] = [];
  let current = "";

  for (const char of text) {
    if (char === "\n") {
      if (current.trim()) chunks.push(current.trim());
      chunks.push("");
      current = "";
      continue;
    }

    current += char;
    if (/[。！？!?；;]/u.test(char)) {
      chunks.push(current.trim());
      current = "";
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function wrapDialogueLine(text: string, maxChars: number) {
  const output: string[] = [];
  let remaining = text.trim();

  while (Array.from(remaining).length > maxChars) {
    const chars = Array.from(remaining);
    const breakAt = findDialogueBreak(chars, maxChars);
    output.push(chars.slice(0, breakAt).join("").trim());
    remaining = chars.slice(breakAt).join("").trim();
  }

  if (remaining) output.push(remaining);
  return output;
}

function findDialogueBreak(chars: string[], maxChars: number) {
  const minBreak = Math.max(16, Math.floor(maxChars * 0.45));
  for (let index = maxChars; index >= minBreak; index -= 1) {
    if (/[\s，、,.:：]/u.test(chars[index] || "")) return index + 1;
  }
  return maxChars;
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
  story,
  transcript,
  runs,
  rawLog
}: {
  sessionId: string;
  workspace: string;
  agent?: AgentConfig;
  story?: StoryState;
  transcript: TranscriptEntry[];
  runs: RunRecord[];
  rawLog: string;
}) {
  const lines = [
    "# GalCode Session",
    "",
    `- Session: \`${sessionId}\``,
    `- Space: \`${workspace || "GalCode Web"}\``,
    `- Character: ${agent ? `${agent.characterName} (${agent.name})` : "unknown"}`,
    story ? `- Story: ${story.title}` : "- Story: not generated",
    `- Exported: ${new Date().toISOString()}`,
    "",
    "## Story",
    "",
    story?.summary || "_No story state recorded._",
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
  if (/^(https?:|data:|blob:|galcode-asset:)/i.test(filePath)) return filePath;
  if (filePath.startsWith("/") && !filePath.startsWith("/Users/") && !filePath.startsWith("/Volumes/")) {
    return filePath;
  }
  const normalized = filePath.replaceAll("\\", "/");
  const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `galcode-asset://local${absolute.split("/").map(encodeURIComponent).join("/")}`;
}
