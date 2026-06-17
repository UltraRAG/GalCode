const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("galcode", {
  loadState: () => ipcRenderer.invoke("state:load"),
  saveState: (state) => ipcRenderer.invoke("state:save", state),
  chooseWorkspace: () => ipcRenderer.invoke("workspace:choose"),
  chooseImageAsset: () => ipcRenderer.invoke("asset:choose-image"),
  importThemeFolder: (agents) => ipcRenderer.invoke("asset:import-theme-folder", agents),
  checkAgent: (agent) => ipcRenderer.invoke("agent:check", agent),
  loginAgent: (payload) => ipcRenderer.invoke("agent:login", payload),
  exportMarkdown: (payload) => ipcRenderer.invoke("export:markdown", payload),
  startAgent: (payload) => ipcRenderer.invoke("agent:start", payload),
  sendToAgent: (payload) => ipcRenderer.invoke("agent:send", payload),
  stopAgent: (sessionId) => ipcRenderer.invoke("agent:stop", sessionId),
  onAgentEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("agent:event", handler);
    return () => ipcRenderer.off("agent:event", handler);
  }
});
