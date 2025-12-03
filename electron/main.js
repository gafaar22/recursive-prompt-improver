const {
  app,
  BrowserWindow,
  protocol,
  session,
  ipcMain,
  dialog,
  Tray,
  nativeImage,
  Menu,
} = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = process.env.NODE_ENV === "development";

// Tray icon for MCP server
let tray = null;

// Enable more detailed logging for debugging
const log = (...args) => {
  console.log(new Date().toISOString(), ...args);
};

// Handle any uncaught errors
process.on("uncaughtException", (error) => {
  log("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  log("Unhandled Rejection:", error);
});

// Set application name
app.setName("RPI");

// Configure permissions for the session
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow all permissions
    callback(true);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    // Allow all permission checks
    return true;
  });
});

// Register protocol for serving local files
app.whenReady().then(() => {
  protocol.registerFileProtocol("file", (request, callback) => {
    const filePath = decodeURI(request.url.replace("file://", ""));
    try {
      return callback(filePath);
    } catch (error) {
      console.error("Protocol error:", error);
      return callback({ error: -2 /* net::ERR_FAILED */ });
    }
  });
});

// Log important paths for debugging
console.log("App paths:", {
  exe: app.getPath("exe"),
  appPath: app.getAppPath(),
  userData: app.getPath("userData"),
  cwd: process.cwd(),
  __dirname: __dirname,
});

function createWindow() {
  // Resolve the preload script path relative to app path for production
  const preloadPath = isDev
    ? path.join(__dirname, "preload.js")
    : path.join(app.getAppPath(), "electron", "preload.js");

  console.log("Loading preload script from:", preloadPath);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "RPI",
    icon: isDev
      ? path.join(__dirname, "..", "public", "android-chrome-512x512.png")
      : path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "build",
          "android-chrome-512x512.png",
        ),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      defaultEncoding: "UTF-8",
    },
  });
  win.setBackgroundColor("#262626");

  // Disable security warnings
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

  // Enable web content permissions
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ["media", "microphone", "localStorage", "notifications"];
    callback(allowedPermissions.includes(permission));
  });

  // Set CSP headers - allowing access to all domains with necessary security directives
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: file: ws:; " +
            "script-src * 'unsafe-inline' 'unsafe-eval' data: blob: file:; " +
            "style-src * 'unsafe-inline' data: blob: file:; " +
            "img-src * data: blob: file:; " +
            "font-src * data: blob: file:; " +
            "media-src * data: blob: file:; " +
            "connect-src * ws: wss: data: blob:; " +
            "child-src * blob: data:; " +
            "worker-src * blob: data:; " +
            "frame-src *;",
        ],
      },
    });
  });

  // Clear only cache-related storage, keeping user data (localStorage & indexeddb) intact
  win.webContents.session
    .clearStorageData({
      storages: ["appcache", "serviceworkers", "cachestorage"],
    })
    .then(() => {
      console.log("Cache storage cleared, user data preserved");
    });

  const devUrl = "http://localhost:3000";
  const prodPath = path.join(__dirname, "..", "build", "index.html");

  console.log("Loading paths:", {
    isDev,
    devUrl,
    prodPath,
    buildExists: fs.existsSync(prodPath),
  });

  // Helper to show a minimal error page when loading fails
  const showLoadError = (reason) => {
    const message = `Failed to load renderer: ${reason}`;
    console.error(message);
    win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`<h2>${message}</h2><p>Check the dev server or build files.</p>`)}`,
    );
  };

  if (isDev) {
    console.log(`Loading dev URL: ${devUrl}`);
    win.loadURL(devUrl).catch((err) => showLoadError(err?.message || err));
  } else {
    console.log(`Loading production file: ${prodPath}`);
    win.loadFile(prodPath).catch((err) => showLoadError(err?.message || err));
  }

  // Open devtools when developing or when ELECTRON_DEBUG is enabled
  if (isDev || process.env.ELECTRON_DEBUG === "true") {
    win.webContents.openDevTools();
  }

  // Listen for load failures and log useful details
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error("did-fail-load", { errorCode, errorDescription, validatedURL });
    showLoadError(`${errorDescription} (code ${errorCode})`);
  });

  //deprecato
  // Forward renderer console messages to main process console (useful for debugging)
  // win.webContents.on('console-message', (e, level, message, line, sourceId) => {
  //   console.log(`Renderer console (${level}) ${sourceId}:${line} - ${message}`);
  // });
}

// Handle IPC for save dialog and file writing
ipcMain.handle("save-file", async (event, options) => {
  const { defaultPath, filters, data } = options;
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: filters || [{ name: "JSON Files", extensions: ["json"] }],
    properties: ["createDirectory", "showOverwriteConfirmation"],
  });

  if (!result.canceled && result.filePath) {
    try {
      await fs.promises.writeFile(result.filePath, data, "utf-8");
      return { success: true, filePath: result.filePath };
    } catch (error) {
      log("Error writing file:", error);
      return { success: false, error: error.message };
    }
  }

  return { success: false, canceled: true };
});

// Handle IPC for opening HTML preview in sandboxed window
ipcMain.handle("open-html-preview", async (event, { htmlContent, options }) => {
  const { title = "HTML Preview", width = 800, height = 600 } = options || {};

  const previewWindow = new BrowserWindow({
    width,
    height,
    title,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: false, // Disable JavaScript for security
      webSecurity: true,
    },
  });

  // Load HTML content via data URL (sandboxed, no scripts)
  // Include charset=utf-8 to properly handle special characters (accents, etc.)
  const base64Html = Buffer.from(htmlContent, "utf-8").toString("base64");
  await previewWindow.loadURL(`data:text/html;charset=utf-8;base64,${base64Html}`);

  return { success: true };
});

/*************** MCP SERVER EXPOSURE **************/

// MCP server state
let mcpServer = null;
let mcpServerPort = null;
let sseClients = new Map(); // Map of sessionId -> response object
let mcpServerTools = []; // Original tools for execution
let mcpServerAgents = []; // Original agents for execution
let pendingToolCalls = new Map(); // Map of requestId -> { resolve, reject, sseRes, jsonRpcId }

// Create a green circle icon for the tray (cross-platform compatible)
function createTrayIcon() {
  // For macOS retina displays, we create a larger image and scale it down
  // macOS menu bar icons should be 22x22 points (44x44 pixels for @2x retina)
  // Windows/Linux: 32x32 works well

  const isMac = process.platform === "darwin";
  const size = isMac ? 44 : 32; // 44 for macOS retina (@2x), 32 for others
  const padding = Math.floor(size * 0.25); // 25% padding on each side
  const circleRadius = (size - padding * 2) / 2; // Circle fits within padded area
  const centerX = size / 2;
  const centerY = size / 2;

  // Create raw RGBA pixel data for a green circle with smooth anti-aliasing
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - centerX + 0.5;
      const dy = y - centerY + 0.5;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Smooth anti-aliasing with 1.5px feather
      const feather = 1.5;
      if (distance <= circleRadius - feather) {
        // Fully inside the circle - solid green #24a148
        pixels[idx] = 0x24; // R
        pixels[idx + 1] = 0xa1; // G
        pixels[idx + 2] = 0x48; // B
        pixels[idx + 3] = 255; // A
      } else if (distance <= circleRadius + feather) {
        // Anti-aliased edge with smooth gradient
        const t = (circleRadius + feather - distance) / (feather * 2);
        const alpha = Math.round(t * t * (3 - 2 * t) * 255); // Smooth step function
        pixels[idx] = 0x24; // R
        pixels[idx + 1] = 0xa1; // G
        pixels[idx + 2] = 0x48; // B
        pixels[idx + 3] = alpha;
      } else {
        // Outside - transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  const icon = nativeImage.createFromBuffer(pixels, {
    width: size,
    height: size,
    scaleFactor: isMac ? 2.0 : 1.0, // Tell macOS this is a @2x retina image
  });

  return icon;
}

// Show tray icon with MCP server info
function showTrayIcon(port, toolCount) {
  if (tray) {
    // Update existing tray tooltip
    const tooltip = `MCP Server on port ${port} (${toolCount} tool${toolCount !== 1 ? "s" : ""})`;
    tray.setToolTip(tooltip);
    return;
  }

  try {
    const icon = createTrayIcon();
    tray = new Tray(icon);

    const tooltip = `MCP Server on port ${port} (${toolCount} tool${toolCount !== 1 ? "s" : ""})`;
    tray.setToolTip(tooltip);

    // Create a simple context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: tooltip,
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Show RPI",
        click: () => {
          const mainWindow = BrowserWindow.getAllWindows()[0];
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    log(`Tray icon created for MCP server on port ${port}`);
  } catch (error) {
    log("Error creating tray icon:", error);
  }
}

// Hide/destroy tray icon
function hideTrayIcon() {
  if (tray) {
    tray.destroy();
    tray = null;
    log("Tray icon destroyed");
  }
}

// Convert tool to MCP format
function toolToMCPFormat(tool) {
  return {
    name: tool.name,
    description: tool.description || "",
    inputSchema: tool.parameters || {
      type: "object",
      properties: {},
    },
  };
}

// Convert agent to MCP tool format
function agentToMCPFormat(agent) {
  return {
    name: agent.name,
    description: agent.description || agent.instructions?.substring(0, 200) || "",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "The request or task to send to the agent",
        },
      },
      required: ["request"],
    },
  };
}

// Generate unique session ID
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Generate unique request ID for tool calls
function generateRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Handle streaming chunks from tool execution
ipcMain.on("mcp-tool-chunk", (event, { requestId, chunk }) => {
  const pending = pendingToolCalls.get(requestId);
  if (pending && pending.sseRes) {
    // Send progress notification via SSE
    // Using a custom notification for streaming progress
    const notification = {
      jsonrpc: "2.0",
      method: "notifications/tools/progress",
      params: {
        requestId,
        chunk: typeof chunk === "string" ? chunk : JSON.stringify(chunk),
      },
    };
    pending.sseRes.write(`event: message\n`);
    pending.sseRes.write(`data: ${JSON.stringify(notification)}\n\n`);
  }
});

// Handle tool execution result from renderer
ipcMain.on("mcp-tool-result", (event, { requestId, result }) => {
  const pending = pendingToolCalls.get(requestId);
  if (pending) {
    const { sseRes, jsonRpcId } = pending;
    pendingToolCalls.delete(requestId);

    // Send response via SSE
    const response = {
      jsonrpc: "2.0",
      id: jsonRpcId,
      result: {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result),
          },
        ],
      },
    };

    sseRes.write(`event: message\n`);
    sseRes.write(`data: ${JSON.stringify(response)}\n\n`);
  }
});

// Start MCP server
ipcMain.handle("mcp-server-start", async (event, config) => {
  try {
    const { port, tools, agents } = config;

    // Stop existing server if running
    if (mcpServer) {
      await stopMCPServerInternal();
    }

    // Store original tools and agents for execution
    mcpServerTools = tools || [];
    mcpServerAgents = agents || [];

    // Dynamic import for ES modules
    const http = require("http");
    const url = require("url");

    // Convert tools and agents to MCP format
    const mcpTools = [
      ...(tools || []).map(toolToMCPFormat),
      ...(agents || []).map(agentToMCPFormat),
    ];

    // Create a simple SSE-based MCP server
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;

      // Enable CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // SSE endpoint - establishes SSE connection and provides message endpoint
      if (pathname === "/sse" && req.method === "GET") {
        const sessionId = generateSessionId();
        log(`SSE client connected with session: ${sessionId}`);

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        // Store the SSE response object for this session
        sseClients.set(sessionId, res);

        // Helper to send SSE events
        const sendSSE = (eventType, data) => {
          res.write(`event: ${eventType}\n`);
          // For endpoint event, data should be a plain string (the URL)
          // For message events, data should be JSON stringified
          if (typeof data === "string") {
            res.write(`data: ${data}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          }
        };

        // According to MCP SDK SSEClientTransport, the server must send an "endpoint" event
        // that tells the client where to POST messages
        // The endpoint includes the sessionId so responses go to the correct SSE stream
        sendSSE("endpoint", `/message?sessionId=${sessionId}`);

        // Handle client disconnect
        req.on("close", () => {
          log(`SSE client disconnected: ${sessionId}`);
          sseClients.delete(sessionId);
        });

        return;
      }

      // Message endpoint for JSON-RPC - receives messages and sends responses via SSE
      if (pathname === "/message" && req.method === "POST") {
        const sessionId = parsedUrl.query.sessionId;
        const sseRes = sseClients.get(sessionId);

        if (!sseRes) {
          log(`No SSE connection found for session: ${sessionId}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No SSE connection for this session" }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const message = JSON.parse(body);
            const { method, id, params } = message;

            log(`MCP message received: ${method} (id: ${id})`);

            let response;

            // Handle MCP methods
            switch (method) {
              case "initialize":
                response = {
                  jsonrpc: "2.0",
                  id,
                  result: {
                    protocolVersion: "2024-11-05",
                    capabilities: {
                      tools: {},
                    },
                    serverInfo: {
                      name: "RPI-MCP-Server",
                      version: "1.0.0",
                    },
                  },
                };
                break;

              case "notifications/initialized":
                // This is a notification (no response expected)
                res.writeHead(202);
                res.end();
                return;

              case "tools/list":
                response = {
                  jsonrpc: "2.0",
                  id,
                  result: {
                    tools: mcpTools,
                  },
                };
                break;

              case "tools/call":
                // Execute tool via renderer process
                const toolName = params?.name;
                const toolArgs = params?.arguments || {};

                // Find if it's a tool or agent
                const tool = mcpServerTools.find((t) => t.name === toolName);
                const agent = mcpServerAgents.find((a) => a.name === toolName);

                if (!tool && !agent) {
                  response = {
                    jsonrpc: "2.0",
                    id,
                    error: {
                      code: -32602,
                      message: `Tool not found: ${toolName}`,
                    },
                  };
                  break;
                }

                // Generate request ID and store pending call
                const requestId = generateRequestId();
                pendingToolCalls.set(requestId, {
                  sseRes,
                  jsonRpcId: id,
                });

                // Send execution request to renderer
                const mainWindow = BrowserWindow.getAllWindows()[0];
                if (mainWindow) {
                  mainWindow.webContents.send("mcp-execute-tool", {
                    requestId,
                    toolName,
                    arguments: toolArgs,
                    isAgent: !!agent,
                    toolDefinition: tool || agent,
                  });

                  // Acknowledge POST, response will come via SSE when tool completes
                  res.writeHead(202);
                  res.end();
                  return;
                } else {
                  // No window available
                  pendingToolCalls.delete(requestId);
                  response = {
                    jsonrpc: "2.0",
                    id,
                    error: {
                      code: -32603,
                      message: "Application window not available for tool execution",
                    },
                  };
                }
                break;

              default:
                // Handle unknown methods - could be notifications
                if (!id) {
                  // Notifications don't need responses
                  res.writeHead(202);
                  res.end();
                  return;
                }
                response = {
                  jsonrpc: "2.0",
                  id,
                  error: {
                    code: -32601,
                    message: `Method not found: ${method}`,
                  },
                };
            }

            // Send response via SSE stream
            sseRes.write(`event: message\n`);
            sseRes.write(`data: ${JSON.stringify(response)}\n\n`);

            // Acknowledge the POST request
            res.writeHead(202);
            res.end();
          } catch (error) {
            log("Error processing MCP message:", error);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: {
                  code: -32700,
                  message: "Parse error",
                },
              }),
            );
          }
        });

        return;
      }

      // Health check endpoint
      if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ status: "ok", tools: mcpTools.length, sessions: sseClients.size }),
        );
        return;
      }

      // Not found
      res.writeHead(404);
      res.end("Not Found");
    });

    // Start listening
    await new Promise((resolve, reject) => {
      server.listen(port, "localhost", () => {
        log(`MCP server started on port ${port}`);
        resolve();
      });
      server.on("error", reject);
    });

    mcpServer = server;
    mcpServerPort = port;

    // Show tray icon with server info
    const toolCount = mcpTools.length;
    showTrayIcon(port, toolCount);

    return { success: true, port };
  } catch (error) {
    log("Error starting MCP server:", error);
    return { success: false, error: error.message };
  }
});

// Stop MCP server internal helper
async function stopMCPServerInternal() {
  if (mcpServer) {
    // Close all SSE client connections
    for (const [sessionId, res] of sseClients) {
      try {
        res.end();
      } catch (e) {
        // Ignore errors on close
      }
    }
    sseClients.clear();
    pendingToolCalls.clear();
    mcpServerTools = [];
    mcpServerAgents = [];

    await new Promise((resolve) => {
      mcpServer.close(() => {
        log("MCP server stopped");
        resolve();
      });
    });
    mcpServer = null;
    mcpServerPort = null;

    // Hide tray icon
    hideTrayIcon();
  }
}

// Stop MCP server
ipcMain.handle("mcp-server-stop", async () => {
  try {
    await stopMCPServerInternal();
    return { success: true };
  } catch (error) {
    log("Error stopping MCP server:", error);
    return { success: false, error: error.message };
  }
});

// Get MCP server status
ipcMain.handle("mcp-server-status", async () => {
  return {
    isRunning: mcpServer !== null,
    port: mcpServerPort,
  };
});

app.whenReady().then(() => {
  // Set dock icon on macOS
  if (process.platform === "darwin") {
    const iconPath = isDev
      ? path.join(__dirname, "..", "public", "android-chrome-512x512.png")
      : path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "build",
          "android-chrome-512x512.png",
        );
    app.dock.setIcon(iconPath);
  }

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// Clean up tray icon on quit
app.on("before-quit", () => {
  hideTrayIcon();
});
