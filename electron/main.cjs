const { app, BrowserWindow, dialog, ipcMain, net, protocol } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { buildCommand, listImages, pickBestImage } = require("./agent-runtime.cjs");

let mainWindow;
const runningAgents = new Map();

protocol.registerSchemesAsPrivileged([
  {
    scheme: "galcode-asset",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

const DEFAULT_AGENTS = [
  {
    id: "codex",
    name: "Codex",
    characterName: "Koharu",
    role: "Reliable engineering heroine",
    command: "codex",
    args: "exec --json --color never --skip-git-repo-check \"{prompt}\"",
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
    args: "-p --output-format text \"{prompt}\"",
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
    args: "--print --output-format text --trust \"{prompt}\"",
    mode: "oneshot",
    accent: "#f4a261",
    modelNote: "Cursor CLI agent"
  }
];

function defaultState() {
  return withSampleThemeAssets({
    version: 1,
    workspace: os.homedir(),
    selectedAgentId: "codex",
    themeId: "wa-koi-default",
    agents: DEFAULT_AGENTS,
    transcripts: {},
    runs: {}
  });
}

function statePath() {
  return path.join(app.getPath("userData"), "galcode-state.json");
}

function readState() {
  try {
    const raw = fs.readFileSync(statePath(), "utf8");
    const parsed = JSON.parse(raw);
    return withSampleThemeAssets(withDefaultAgentRuntimeConfig({ ...defaultState(), ...parsed }));
  } catch {
    return defaultState();
  }
}

function withDefaultAgentRuntimeConfig(state) {
  const defaultsById = Object.fromEntries(DEFAULT_AGENTS.map((agent) => [agent.id, agent]));
  return {
    ...state,
    agents: (state.agents || DEFAULT_AGENTS).map((agent) => {
      const defaultAgent = defaultsById[agent.id];
      if (!defaultAgent || agent.custom) return agent;

      const hasBlankInteractiveConfig = agent.mode === "interactive" && !agent.args;
      const usesOlderDefaultArgs =
        agent.args === "exec \"{prompt}\"" ||
        agent.args === "exec --color never --skip-git-repo-check \"{prompt}\"" ||
        agent.args === "-p \"{prompt}\"" ||
        agent.args === "--print --output-format text \"{prompt}\"";

      if (!hasBlankInteractiveConfig && !usesOlderDefaultArgs) return agent;
      return {
        ...agent,
        command: defaultAgent.command,
        args: defaultAgent.args,
        mode: defaultAgent.mode,
        modelNote: defaultAgent.modelNote
      };
    })
  };
}

function agentEnv() {
  const extraPaths = [
    path.join(os.homedir(), ".local", "bin"),
    path.join(os.homedir(), ".local", "share", "node-v24.14.0-darwin-arm64", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/Applications/Codex.app/Contents/Resources"
  ];
  const currentPaths = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  return {
    ...process.env,
    TERM: "xterm-256color",
    GALCODE: "1",
    PATH: [...extraPaths, ...currentPaths].join(path.delimiter)
  };
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function appleScriptString(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function loginCommandForAgent(agent) {
  if (agent.id === "codex" || agent.command === "codex") return "codex login";
  if (agent.id === "claude" || agent.command === "claude") return "claude auth login";
  if (agent.id === "cursor" || agent.command === "cursor-agent" || agent.command === "agent") {
    return "cursor-agent login";
  }
  return null;
}

function openLoginTerminal(agent, workspace) {
  const loginCommand = loginCommandForAgent(agent);
  if (!loginCommand) {
    return { ok: false, message: `${agent.name} does not have a known login command.` };
  }

  const cwd = workspace || os.homedir();
  const env = agentEnv();
  const command = [
    `cd ${shellQuote(cwd)}`,
    `export PATH=${shellQuote(env.PATH)}`,
    "clear",
    `echo ${shellQuote(`GalCode login for ${agent.name}`)}`,
    loginCommand,
    "echo",
    `echo ${shellQuote("Login flow finished. Return to GalCode and send your message again.")}`,
    `printf ${shellQuote("Press Enter to close this window... ")}`,
    "read -r _"
  ].join("; ");

  const child = spawn("osascript", [
    "-e",
    'tell application "Terminal" to activate',
    "-e",
    `tell application "Terminal" to do script ${appleScriptString(command)}`
  ], {
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.on("error", () => {});
  return { ok: true, message: `Opened Terminal to sign in to ${agent.name}.`, command: loginCommand };
}

function sampleThemeRoot() {
  const candidates = [
    path.join(app.getAppPath(), "sample-assets"),
    path.join(__dirname, "..", "sample-assets")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function withSampleThemeAssets(state) {
  const root = sampleThemeRoot();
  if (!root) return state;

  const backgroundCandidates = [
    path.join(root, "backgrounds", "hallway-day-ccby-lisadicaprio.png"),
    path.join(root, "backgrounds", "hallway-night-ccby-lisadicaprio.png")
  ];
  const backgroundPath = backgroundCandidates.find((candidate) => fs.existsSync(candidate));
  const portraitByAgent = {
    codex: path.join(root, "characters", "codex-codel-sprite-ccby-lisadicaprio.png"),
    claude: path.join(root, "characters", "claude-codel-sprite-ccby-lisadicaprio.png"),
    cursor: path.join(root, "characters", "cursor-codel-sprite-ccby-lisadicaprio.png")
  };

  return {
    ...state,
    assetPackPath: state.assetPackPath || root,
    backgroundPath: state.backgroundPath || backgroundPath,
    agents: (state.agents || DEFAULT_AGENTS).map((agent) => {
      const portraitPath = portraitByAgent[agent.id];
      if (agent.portraitPath || !portraitPath || !fs.existsSync(portraitPath)) return agent;
      return { ...agent, portraitPath };
    })
  };
}

function writeState(state) {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2), "utf8");
  return state;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 700,
    center: true,
    backgroundColor: "#201818",
    title: "GalCode",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.center();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function sendEvent(sessionId, event) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("agent:event", {
    sessionId,
    at: new Date().toISOString(),
    ...event
  });
}

function currentRunId(sessionId, fallbackRunId) {
  return runningAgents.get(sessionId)?.runId || fallbackRunId;
}

function stopSession(sessionId) {
  const entry = runningAgents.get(sessionId);
  if (!entry) return false;
  if (entry.process && !entry.process.killed) {
    entry.process.kill();
  }
  runningAgents.delete(sessionId);
  return true;
}

function isCodexJsonAgent(agent) {
  return agent?.command === "codex" && (agent.args || "").includes("--json");
}

function sendAgentOutput(sessionId, stream, text, hidden = false) {
  const entry = runningAgents.get(sessionId);
  sendEvent(sessionId, {
    runId: currentRunId(sessionId),
    type: "output",
    stream,
    text,
    hidden
  });
  return entry;
}

function handleCodexJsonLine(sessionId, stream, line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  if (!trimmed.startsWith("{")) {
    sendAgentOutput(sessionId, stream, `${line}\n`, true);
    return;
  }

  try {
    const event = JSON.parse(trimmed);
    if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
      sendAgentOutput(sessionId, "stdout", `${event.item.text.trimEnd()}\n`);
      return;
    }
    sendAgentOutput(sessionId, stream, `${line}\n`, true);
  } catch {
    sendAgentOutput(sessionId, stream, `${line}\n`, true);
  }
}

function handleAgentOutput(sessionId, stream, data) {
  const entry = runningAgents.get(sessionId);
  const text = data.toString();
  if (!entry || !isCodexJsonAgent(entry.agent)) {
    sendAgentOutput(sessionId, stream, text);
    return;
  }

  entry.outputBuffers[stream] = `${entry.outputBuffers[stream] || ""}${text}`;
  const lines = entry.outputBuffers[stream].split(/\r?\n/);
  entry.outputBuffers[stream] = lines.pop() || "";
  for (const line of lines) handleCodexJsonLine(sessionId, stream, line);
}

function flushAgentOutput(sessionId) {
  const entry = runningAgents.get(sessionId);
  if (!entry || !isCodexJsonAgent(entry.agent)) return;
  for (const stream of ["stdout", "stderr"]) {
    const line = entry.outputBuffers[stream];
    entry.outputBuffers[stream] = "";
    if (line) handleCodexJsonLine(sessionId, stream, line);
  }
}

function launchAgent({ sessionId, runId, agent, workspace, prompt }) {
  stopSession(sessionId);

  const cwd = workspace || os.homedir();
  const { command, args } = buildCommand(agent, prompt || "");

  sendEvent(sessionId, {
    runId,
    type: "status",
    level: "info",
    message: `Starting ${agent.name}: ${command} ${args.join(" ")}`.trim()
  });

  const child = spawn(command, args, {
    cwd,
    env: agentEnv(),
    shell: false,
    stdio: [agent.mode === "interactive" ? "pipe" : "ignore", "pipe", "pipe"]
  });

  runningAgents.set(sessionId, { process: child, runId, agent, workspace: cwd, outputBuffers: { stdout: "", stderr: "" } });

  child.stdout.on("data", (data) => {
    handleAgentOutput(sessionId, "stdout", data);
  });

  child.stderr.on("data", (data) => {
    handleAgentOutput(sessionId, "stderr", data);
  });

  child.on("error", (error) => {
    sendEvent(sessionId, {
      runId: currentRunId(sessionId, runId),
      type: "error",
      message: error.message
    });
    runningAgents.delete(sessionId);
  });

  child.on("close", (code, signal) => {
    flushAgentOutput(sessionId);
    sendEvent(sessionId, {
      runId: currentRunId(sessionId, runId),
      type: "exit",
      code,
      signal,
      message: `${agent.name} exited${code === null ? "" : ` with code ${code}`}.`
    });
    runningAgents.delete(sessionId);
  });

  if (agent.mode === "interactive" && prompt) {
    child.stdin.write(`${prompt}\n`);
  }

  return { ok: true };
}

app.whenReady().then(() => {
  protocol.handle("galcode-asset", (request) => {
    const assetUrl = new URL(request.url);
    const filePath = decodeURIComponent(assetUrl.pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  for (const sessionId of runningAgents.keys()) stopSession(sessionId);
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("state:load", () => readState());
ipcMain.handle("state:save", (_event, state) => writeState(state));

ipcMain.handle("workspace:choose", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Choose GalCode Workspace"
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("asset:choose-image", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    title: "Choose GalCode Image Asset",
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif"] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("asset:import-theme-folder", async (_event, agents) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Choose GalCode Theme Folder"
  });
  if (result.canceled) return null;

  const root = result.filePaths[0];
  const images = listImages(root);
  const backgroundPath =
    pickBestImage(images, ["background", "back", "bg", "scene", "room", "stage"]) || images[0];
  const portraits = {};

  for (const agent of agents || []) {
    const portrait = pickBestImage(images, [
      agent.id,
      agent.name,
      agent.characterName,
      "portrait",
      "sprite",
      "standing",
      "tachie"
    ]);
    if (portrait) portraits[agent.id] = portrait;
  }

  return {
    root,
    imageCount: images.length,
    backgroundPath,
    portraits
  };
});

ipcMain.handle("agent:check", async (_event, agent) => {
  return new Promise((resolve) => {
    const checker = spawn("sh", ["-lc", `command -v ${JSON.stringify(agent.command)}`], {
      env: agentEnv(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    checker.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    checker.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    checker.on("error", (error) => {
      resolve({ ok: false, message: error.message });
    });
    checker.on("close", (code) => {
      const commandPath = stdout.trim();
      resolve({
        ok: code === 0 && Boolean(commandPath),
        path: commandPath || undefined,
        message: commandPath || stderr.trim() || `${agent.command} was not found in PATH.`
      });
    });
  });
});

ipcMain.handle("agent:login", (_event, payload) => {
  return openLoginTerminal(payload.agent, payload.workspace);
});

ipcMain.handle("export:markdown", async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export GalCode Session",
    defaultPath: payload.defaultName,
    filters: [{ name: "Markdown", extensions: ["md"] }]
  });
  if (result.canceled || !result.filePath) return { ok: false };
  fs.writeFileSync(result.filePath, payload.markdown, "utf8");
  return { ok: true, path: result.filePath };
});

ipcMain.handle("agent:start", (_event, payload) => {
  return launchAgent(payload);
});

ipcMain.handle("agent:send", (_event, payload) => {
  const entry = runningAgents.get(payload.sessionId);
  if (!entry) {
    return launchAgent(payload);
  }
  try {
    entry.runId = payload.runId || entry.runId;
    entry.process.stdin.write(`${payload.prompt}\n`);
    sendEvent(payload.sessionId, {
      runId: payload.runId || entry.runId,
      type: "status",
      level: "info",
      message: "Prompt sent."
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("agent:stop", (_event, sessionId) => {
  const stopped = stopSession(sessionId);
  sendEvent(sessionId, {
    type: "status",
    level: stopped ? "warn" : "info",
    message: stopped ? "Agent stopped." : "No running agent."
  });
  return { ok: true, stopped };
});
