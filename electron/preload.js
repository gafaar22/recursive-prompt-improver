// Preload script — keep minimal. Expose a safe API surface here if needed later.
const { contextBridge, ipcRenderer } = require("electron");

// Expose platform info and storage APIs
contextBridge.exposeInMainWorld("__RPI_ELECTRON__", {
  platform: process.platform,
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
    clear: () => localStorage.clear(),
    key: (index) => localStorage.key(index),
    length: () => localStorage.length,
  },
  saveFile: (options) => ipcRenderer.invoke("save-file", options),
});

// Expose Electron API for MCP server control
contextBridge.exposeInMainWorld("electronAPI", {
  // MCP Server controls
  startMCPServer: (config) => ipcRenderer.invoke("mcp-server-start", config),
  stopMCPServer: () => ipcRenderer.invoke("mcp-server-stop"),
  getMCPServerStatus: () => ipcRenderer.invoke("mcp-server-status"),

  // HTML Preview - open sandboxed browser window
  openHtmlPreview: (htmlContent, options) =>
    ipcRenderer.invoke("open-html-preview", { htmlContent, options }),

  // Tool execution callback - renderer registers a handler
  onToolExecutionRequest: (callback) => {
    ipcRenderer.on("mcp-execute-tool", (event, data) => {
      callback(data);
    });
  },
  // Send streaming chunk during tool execution
  sendToolExecutionChunk: (requestId, chunk) => {
    ipcRenderer.send("mcp-tool-chunk", { requestId, chunk });
  },
  // Send tool execution result back to main
  sendToolExecutionResult: (requestId, result) => {
    ipcRenderer.send("mcp-tool-result", { requestId, result });
  },
});
