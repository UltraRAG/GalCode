import {
  Bot,
  Code2,
  Eraser,
  FolderOpen,
  HelpCircle,
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
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AgentConfig, AgentEvent, GalCodeState, RunRecord, TranscriptEntry } from "./types";
import {
  browserFallbackState,
  createCustomAgent,
  defaultAgents,
  echoAgentPatch,
  filePathToAssetUrl,
  formatRawEvent,
  isDefaultAgent,
  makeSessionMarkdown,
  mergeTranscriptEntry
} from "./core";

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

function App() {
  const [state, setState] = useState<GalCodeState>(browserFallbackState);
  const [prompt, setPrompt] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [runningSessions, setRunningSessions] = useState<Record<string, boolean>>({});
  const [rawLog, setRawLog] = useState<Record<string, string>>({});
  const [agentChecks, setAgentChecks] = useState<Record<string, { ok: boolean; message: string }>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selectedAgent = useMemo(
    () => state.agents.find((agent) => agent.id === state.selectedAgentId) || state.agents[0],
    [state.agents, state.selectedAgentId]
  );
  const sessionId = useMemo(
    () => `${selectedAgent?.id || "agent"}:${state.workspace || "browser"}`,
    [selectedAgent?.id, state.workspace]
  );
  const transcript = state.transcripts[sessionId] || [];
  const visibleTranscript = useMemo(
    () => transcript.filter((entry) => entry.speaker !== "system"),
    [transcript]
  );

  useEffect(() => {
    const load = async () => {
      if (window.galcode) {
        setState(await window.galcode.loadState());
        return;
      }
      const saved = localStorage.getItem("galcode-preview-state");
      if (saved) setState(JSON.parse(saved));
    };
    load();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript.length, transcript.at(-1)?.text]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setSettingsOpen(false);
      setHelpOpen(false);
      setRawOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

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
      localStorage.setItem("galcode-preview-state", JSON.stringify(nextState));
    }
  };

  const persistStateUpdate = (updater: (current: GalCodeState) => GalCodeState) => {
    setState((current) => {
      const next = updater(current);
      if (window.galcode) window.galcode.saveState(next);
      else localStorage.setItem("galcode-preview-state", JSON.stringify(next));
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
      else localStorage.setItem("galcode-preview-state", JSON.stringify(next));
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
    if (!window.galcode) return;
    const workspace = await window.galcode.chooseWorkspace();
    if (workspace) await saveState({ ...state, workspace });
  };

  const chooseBackgroundAsset = async () => {
    if (!window.galcode) return;
    const backgroundPath = await window.galcode.chooseImageAsset();
    if (backgroundPath) await saveState({ ...state, backgroundPath });
  };

  const choosePortraitAsset = async () => {
    if (!window.galcode || !selectedAgent) return;
    const portraitPath = await window.galcode.chooseImageAsset();
    if (portraitPath) updateAgent(selectedAgent.id, { portraitPath });
  };

  const importThemeFolder = async () => {
    if (!window.galcode) return;
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
        [agent.id]: { ok: false, message: "Open the Electron app to check local commands." }
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
      appendEntry(sessionId, previewEntry(selectedAgent));
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

  const sendPrompt = async (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || !selectedAgent) return;
    setPrompt("");
    const runId = uid();

    appendEntry(sessionId, {
      id: uid(),
      agentId: selectedAgent.id,
      speaker: "user",
      text,
      at: now(),
      runId
    });

    if (text === "/login") {
      if (!window.galcode) {
        appendEntry(sessionId, {
          id: uid(),
          agentId: selectedAgent.id,
          speaker: "agent",
          text: "Open the Electron app to launch CLI login.",
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
          text: "Preview mode is showing the GalCode interface. Run the Electron app to connect this character to a local CLI agent.",
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
    <main className="app-shell" style={{ "--agent-accent": selectedAgent?.accent } as React.CSSProperties}>
      <section className="stage">
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
                  <small>{state.workspace || "Browser preview"}</small>
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
          {selectedAgent?.portraitPath ? (
            <img
              className="character-image"
              src={filePathToAssetUrl(selectedAgent.portraitPath)}
              alt={selectedAgent.characterName}
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
            <strong>{selectedAgent?.characterName}</strong>
            <span>{selectedAgent?.role}</span>
          </div>
        </section>

        <section className="dialogue-surface">
          <header className="scene-toolbar">
            <div>
              <span className="status-dot" data-running={runningSessions[sessionId] ? "true" : "false"} />
              <strong>{selectedAgent?.characterName}</strong>
              <small>
                {selectedAgent?.name} / {selectedAgent?.modelNote}
              </small>
            </div>
          </header>

          <div className="transcript" ref={scrollRef}>
            {visibleTranscript.length === 0 ? (
              <div className="empty-line">
                <span>{selectedAgent?.characterName}</span>
                <p>Ready.</p>
              </div>
            ) : (
              visibleTranscript.map((entry) => (
                <article key={entry.id} className={`line ${entry.speaker} ${entry.stream || ""}`}>
                  <div className="speaker">
                    {entry.speaker === "user"
                      ? "You"
                      : entry.speaker === "system"
                        ? "System"
                        : selectedAgent?.characterName}
                  </div>
                  <pre>{entry.text}</pre>
                </article>
              ))
            )}
          </div>

          <form className="prompt-bar" onSubmit={sendPrompt}>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={`Message ${selectedAgent?.characterName}`}
            />
            <button className="send-button" type="submit">
              <Send size={18} />
              Send
            </button>
          </form>
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
            Add Agent
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
    </main>
  );
}

function previewEntry(agent: AgentConfig): TranscriptEntry {
  return {
    id: uid(),
    agentId: agent.id,
    speaker: "system",
    text: "Desktop bridge is not available in browser preview.",
    at: now()
  };
}

export default App;
