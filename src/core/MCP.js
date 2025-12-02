/**
 * MCP (Model Context Protocol) Client Integration
 * Handles connections to MCP servers and tool fetching
 * Also provides MCP server exposure functionality
 */

import { Client } from "@moinfra/mcp-client-sdk/client/index.js";
import { SSEClientTransport } from "@moinfra/mcp-client-sdk/client/sse.js";
import { STORAGE } from "./STORAGE";
import { loadMCPServers, loadTools, loadAgents } from "@utils/storageUtils";
import { STORAGE_KEYS, ROLES } from "@utils/constants";
import { getStorageItem, setStorageItem } from "@utils/storageUtils";

const CONNECTION_TIMEOUT = 15 * 1000;

/**
 * Enable streaming for MCP tool execution
 * When true, sends progress notifications via SSE during agent execution
 * Set to false to disable streaming and only send final results
 */
const ENABLE_MCP_STREAMING = true;

/**
 * Connection status enum
 */
export const CONNECTION_STATUS = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
};

/**
 * Create and test MCP connection
 * @param {Object} config - Connection configuration
 * @param {string} config.url - MCP server URL
 * @param {Object} config.headers - Optional headers
 * @param {Object} config.auth - Optional auth configuration
 * @returns {Promise<Object>} Connection result with tools or error
 */
export async function testConnection(config) {
  const { url, headers = {} } = config;

  let transport = null;

  try {
    // Replace environment variables in URL and headers
    const processedUrl = await replaceEnvVars(url);
    const processedHeaders = await replaceEnvVarsInObject(headers);

    // Create transport
    transport = new SSEClientTransport(new URL(processedUrl), {
      requestInit: {
        headers: processedHeaders,
      },
    });

    // Create client
    const client = new Client(
      {
        name: "RPI-MCP-Client",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Connect to server with timeout
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timeout")), CONNECTION_TIMEOUT)
    );
    await Promise.race([connectPromise, timeoutPromise]);

    // Fetch tools to test connection with timeout
    const listToolsPromise = client.listTools();
    const listToolsTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("List tools timeout")), CONNECTION_TIMEOUT)
    );
    const result = await Promise.race([listToolsPromise, listToolsTimeout]);
    const tools = result.tools || [];

    // Close connection
    await transport.close();

    return {
      success: true,
      tools,
      toolCount: tools.length,
    };
  } catch (error) {
    // Always close transport on error to prevent connection retries
    if (transport) {
      try {
        await transport.close();
      } catch (closeError) {
        console.error("Error closing transport:", closeError);
      }
    }
    console.error("MCP connection test failed:", error);
    return {
      success: false,
      error: error.message || "Connection failed",
      toolCount: 0,
    };
  }
}

/**
 * Fetch tools from MCP server
 * @param {Object} config - Connection configuration
 * @returns {Promise<Object>} Tools result
 */
export async function fetchTools(config) {
  return testConnection(config);
}

/**
 * Replace environment variables in a string
 * Supports env.VAR_NAME syntax
 * @param {string} str - String with potential env var placeholders
 * @returns {Promise<string>} String with env vars replaced
 */
async function replaceEnvVars(str) {
  if (!str || typeof str !== "string") return str;

  const envVars = await STORAGE.getEnvironmentVariables();
  const envMap = {};
  envVars.forEach((envVar) => {
    envMap[envVar.key] = envVar.value;
  });

  // Replace env.VAR_NAME pattern
  return str.replace(/env\.([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(envMap, key)) {
      return envMap[key];
    }
    // Return original placeholder if no value found
    return match;
  });
}

/**
 * Replace environment variables in all string values of an object
 * @param {Object} obj - Object with potential env var placeholders
 * @returns {Promise<Object>} Object with env vars replaced
 */
async function replaceEnvVarsInObject(obj) {
  if (!obj || typeof obj !== "object") return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = await replaceEnvVars(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Keep connection alive and monitor status
 * @param {Object} config - Connection configuration
 * @param {Function} onStatusChange - Callback when status changes
 * @returns {Object} Connection handle with close method
 */
export async function createConnection(config, onStatusChange) {
  let status = CONNECTION_STATUS.DISCONNECTED;
  let client = null;
  let transport = null;
  let closed = false;

  const updateStatus = (newStatus, data = {}) => {
    status = newStatus;
    if (onStatusChange) {
      onStatusChange({ status, ...data });
    }
  };

  const connect = async () => {
    if (closed) return;

    try {
      updateStatus(CONNECTION_STATUS.CONNECTING);

      const processedUrl = await replaceEnvVars(config.url);
      const processedHeaders = await replaceEnvVarsInObject(config.headers || {});

      transport = new SSEClientTransport(new URL(processedUrl), {
        requestInit: {
          headers: processedHeaders,
        },
      });

      client = new Client(
        {
          name: "RPI-MCP-Client",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Connect with timeout
      const connectPromise = client.connect(transport);
      const connectTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout after 10 seconds")), 10000)
      );
      await Promise.race([connectPromise, connectTimeout]);

      // Fetch tools to verify connection with timeout
      const listToolsPromise = client.listTools();
      const listToolsTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("List tools timeout after 10 seconds")), 10000)
      );
      const result = await Promise.race([listToolsPromise, listToolsTimeout]);
      const tools = result.tools || [];

      updateStatus(CONNECTION_STATUS.CONNECTED, {
        toolCount: tools.length,
        tools,
      });
    } catch (error) {
      console.error("MCP connection failed:", error);
      updateStatus(CONNECTION_STATUS.ERROR, {
        error: error.message || "Connection failed",
      });

      // Try to reconnect after 5 seconds
      if (!closed) {
        setTimeout(() => connect(), 5000);
      }
    }
  };

  // Start initial connection
  connect();

  // Return handle to close connection
  return {
    close: async () => {
      closed = true;
      if (transport) {
        try {
          await transport.close();
        } catch (error) {
          console.error("Error closing MCP transport:", error);
        }
      }
      updateStatus(CONNECTION_STATUS.DISCONNECTED);
    },
    refresh: async () => {
      if (transport) {
        try {
          await transport.close();
        } catch (error) {
          console.error("Error closing MCP transport:", error);
        }
      }
      await connect();
    },
    getStatus: () => status,
  };
}

/**
 * Execute an MCP tool by calling the server
 * @param {number} serverId - The MCP server ID
 * @param {string} toolName - The tool name to execute
 * @param {Object} args - The arguments to pass to the tool
 * @param {number} timeout - Maximum execution time in milliseconds
 * @param {Function} onChunk - Optional callback for streaming progress (chunk) => void
 * @returns {Promise<Object>} - Result with { success: boolean, result: any, error: string }
 */
export async function executeMCPTool(
  serverId,
  toolName,
  args = {},
  timeout = 60000,
  onChunk = null
) {
  let transport = null;

  try {
    // Load server configuration from storage
    const servers = await loadMCPServers();
    const server = servers.find((s) => s.id === serverId);

    if (!server) {
      return {
        success: false,
        error: `MCP server with ID ${serverId} not found`,
      };
    }

    // Replace environment variables
    const processedUrl = await replaceEnvVars(server.url);
    const processedHeaders = await replaceEnvVarsInObject(server.headers || {});

    // Create transport
    transport = new SSEClientTransport(new URL(processedUrl), {
      requestInit: {
        headers: processedHeaders,
      },
    });

    // Create client
    const client = new Client(
      {
        name: "RPI-MCP-Client",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Connect with timeout
    const connectPromise = client.connect(transport);
    const connectTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timeout")), timeout)
    );
    await Promise.race([connectPromise, connectTimeout]);

    // Set up notification handler for streaming progress (if callback provided and streaming enabled)
    // Must be set after connection is established
    if (onChunk && ENABLE_MCP_STREAMING) {
      try {
        // Try to set notification handler - API may vary by SDK version
        if (typeof client.setNotificationHandler === "function") {
          client.setNotificationHandler("notifications/tools/progress", (notification) => {
            const chunk = notification.params?.chunk;
            if (chunk) {
              onChunk(chunk);
            }
          });
        }
      } catch (e) {
        console.warn("[MCP] Could not set notification handler for streaming:", e.message);
      }
    }

    // Call the tool with timeout
    const callToolPromise = client.callTool({
      name: toolName,
      arguments: args,
    });
    const callToolTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Tool execution timeout")), timeout)
    );
    const result = await Promise.race([callToolPromise, callToolTimeout]);

    // Close connection
    await transport.close();

    // MCP returns result in content array
    if (result && result.content && Array.isArray(result.content)) {
      // Combine all content items (may include text, images, etc.)
      const textContent = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");

      return {
        success: true,
        result: textContent || JSON.stringify(result.content),
      };
    }

    return {
      success: true,
      result: JSON.stringify(result),
    };
  } catch (error) {
    // Always close transport on error to prevent connection retries
    if (transport) {
      try {
        await transport.close();
      } catch (closeError) {
        console.error("Error closing transport:", closeError);
      }
    }
    console.error("MCP tool execution failed:", error);
    return {
      success: false,
      error: error.message || "MCP tool execution failed",
    };
  }
}

/*************** EXPOSED MCP SERVER **************/

/**
 * Default port for the exposed MCP server
 */
export const DEFAULT_MCP_SERVER_PORT = 8787;

/**
 * Get the exposed MCP server configuration from storage
 * @returns {Promise<Object>} - Server config with isActive, port, selectedItems
 */
export async function getExposedServerConfig() {
  try {
    const configJson = await getStorageItem(STORAGE_KEYS.MCP_SERVER_CONFIG);
    if (!configJson) {
      return {
        isActive: false,
        port: DEFAULT_MCP_SERVER_PORT,
        selectedItems: [],
      };
    }
    const config = JSON.parse(configJson);
    // Migrate old format (selectedTools + selectedAgents) to new format (selectedItems)
    if (!config.selectedItems && (config.selectedTools || config.selectedAgents)) {
      config.selectedItems = [...(config.selectedTools || []), ...(config.selectedAgents || [])];
      delete config.selectedTools;
      delete config.selectedAgents;
    }
    return {
      isActive: config.isActive || false,
      port: config.port || DEFAULT_MCP_SERVER_PORT,
      selectedItems: config.selectedItems || [],
    };
  } catch (error) {
    console.error("Error loading exposed server config:", error);
    return {
      isActive: false,
      port: DEFAULT_MCP_SERVER_PORT,
      selectedItems: [],
    };
  }
}

/**
 * Save the exposed MCP server configuration to storage
 * @param {Object} config - Server config with isActive, port, selectedItems
 * @returns {Promise<boolean>} - True if saved successfully
 */
export async function saveExposedServerConfig(config) {
  try {
    await setStorageItem(STORAGE_KEYS.MCP_SERVER_CONFIG, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error("Error saving exposed server config:", error);
    return false;
  }
}

/**
 * Get the URL of the exposed MCP server
 * @param {number} port - The port number
 * @returns {string} - The server URL
 */
export function getExposedServerUrl(port = DEFAULT_MCP_SERVER_PORT) {
  return `http://localhost:${port}/sse`;
}

/**
 * Get the list of tools and agents that can be exposed (combined)
 * Returns fresh data from storage with proper formatting
 * @returns {Promise<Array>} - Combined array of tools and agents with type indicator
 */
export async function getExposableItems() {
  try {
    const [tools, agents] = await Promise.all([loadTools(), loadAgents()]);

    // Format tools for exposure
    const formattedTools = tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description || "",
      type: "tool",
      parameters: tool.parameters || {},
    }));

    // Format agents for exposure (agents can be called as tools)
    const formattedAgents = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description || agent.instructions?.substring(0, 100) || "",
      type: "agent",
      // Agents take a single "request" parameter when used as tools
      parameters: {
        type: "object",
        properties: {
          request: {
            type: "string",
            description: "The request or task to send to the agent",
          },
        },
        required: ["request"],
      },
    }));

    // Return combined array
    return [...formattedTools, ...formattedAgents];
  } catch (error) {
    console.error("Error getting exposable items:", error);
    return [];
  }
}

/**
 * Start the exposed MCP server (Electron only)
 * This function sends a message to the main process to start the server
 * @param {Object} config - Server configuration
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
export async function startExposedServer(config) {
  try {
    // Check if running in Electron
    if (!window.electronAPI) {
      return {
        success: false,
        error: "MCP server exposure is only available in the desktop app",
      };
    }

    // Load full tool/agent data for the selected items
    const [allTools, allAgents] = await Promise.all([loadTools(), loadAgents()]);

    // Separate selected items by type
    const selectedItems = config.selectedItems || [];
    const selectedToolIds = new Set(
      selectedItems.filter((item) => item.type === "tool").map((t) => t.id)
    );
    const selectedAgentIds = new Set(
      selectedItems.filter((item) => item.type === "agent").map((a) => a.id)
    );

    // Get selected tools with full data
    const toolsToExpose = allTools.filter((t) => selectedToolIds.has(t.id));

    // Get selected agents with full data
    const agentsToExpose = allAgents.filter((a) => selectedAgentIds.has(a.id));

    // Send to Electron main process
    const result = await window.electronAPI.startMCPServer({
      port: config.port || DEFAULT_MCP_SERVER_PORT,
      tools: toolsToExpose,
      agents: agentsToExpose,
    });

    return result;
  } catch (error) {
    console.error("Error starting exposed server:", error);
    return {
      success: false,
      error: error.message || "Failed to start MCP server",
    };
  }
}

/**
 * Stop the exposed MCP server (Electron only)
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
export async function stopExposedServer() {
  try {
    // Check if running in Electron
    if (!window.electronAPI) {
      return {
        success: false,
        error: "MCP server exposure is only available in the desktop app",
      };
    }

    const result = await window.electronAPI.stopMCPServer();
    return result;
  } catch (error) {
    console.error("Error stopping exposed server:", error);
    return {
      success: false,
      error: error.message || "Failed to stop MCP server",
    };
  }
}

/**
 * Check if the exposed MCP server is running (Electron only)
 * @returns {Promise<Object>} - { isRunning: boolean, port?: number }
 */
export async function getExposedServerStatus() {
  try {
    // Check if running in Electron
    if (!window.electronAPI) {
      return {
        isRunning: false,
        isElectron: false,
      };
    }

    const result = await window.electronAPI.getMCPServerStatus();
    return {
      ...result,
      isElectron: true,
    };
  } catch (error) {
    console.error("Error getting exposed server status:", error);
    return {
      isRunning: false,
      isElectron: true,
    };
  }
}

/**
 * Toggle the exposed MCP server on/off
 * @param {boolean} activate - Whether to activate or deactivate
 * @param {Object} config - Server configuration
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
export async function toggleExposedServer(activate, config) {
  if (activate) {
    return await startExposedServer(config);
  } else {
    return await stopExposedServer();
  }
}

/**
 * Register handler for tool execution requests from the MCP server
 * This should be called once when the app initializes in Electron
 * Supports both regular tools and agent execution
 */
export function registerToolExecutionHandler() {
  // Only works in Electron
  if (!window.electronAPI || !window.electronAPI.onToolExecutionRequest) {
    console.log("[MCP] Not in Electron, skipping tool execution handler registration");
    return;
  }

  // Import required modules dynamically to avoid circular dependencies
  Promise.all([
    import("@utils/toolUtils"),
    import("@utils/conversationUtils"),
    import("@utils/storageUtils"),
  ]).then(([toolUtils, conversationUtils, storageUtils]) => {
    const { executeTool } = toolUtils;
    const { executeAgent } = conversationUtils;
    const { loadTools, loadAgents, loadSettings } = storageUtils;

    window.electronAPI.onToolExecutionRequest(async (data) => {
      const { requestId, toolName, arguments: args, isAgent, toolDefinition } = data;

      console.log("[MCP] Tool execution request received:", { requestId, toolName, isAgent });

      // Helper to send streaming chunks (only if streaming is enabled)
      const sendChunk = ENABLE_MCP_STREAMING
        ? (chunk) => {
            if (window.electronAPI.sendToolExecutionChunk) {
              window.electronAPI.sendToolExecutionChunk(requestId, chunk);
            }
          }
        : null;

      try {
        // Load settings from storage
        const storedSettings = await loadSettings();
        const settings = {
          maxToolIterations: storedSettings.maxToolIterations || 5,
          time_limit: storedSettings.time_limit || 60000,
        };

        let result;

        if (isAgent) {
          // Execute as agent
          // Load all agents and tools for potential nested execution
          const allAgents = await loadAgents();
          const allTools = await loadTools();

          // Find the full agent object (toolDefinition may not have all fields)
          const agent = allAgents.find((a) => a.name === toolName);
          if (!agent) {
            throw new Error(`Agent '${toolName}' not found`);
          }

          // Create agent tool format
          const agentTool = {
            id: agent.id,
            name: agent.name,
            isAgent: true,
          };

          // Execute the agent with streaming support (if enabled)
          result = await executeAgent(
            agentTool,
            args,
            allAgents,
            allTools,
            ROLES,
            settings,
            null, // onMessageUpdate - not needed for MCP server
            sendChunk, // onStreamChunk - stream to MCP client (null if disabled)
            null // abortSignal - not supported via MCP
          );
        } else {
          // Execute as regular tool
          const toolCall = {
            function: {
              name: toolName,
              arguments: args,
            },
          };

          // Load all agents and tools for potential agent tool execution
          const allAgents = await loadAgents();
          const allTools = await loadTools();

          // Execute the tool with agent support and streaming (if enabled)
          result = await executeTool(toolCall, [toolDefinition], settings.time_limit, {
            executeAgent: (agentTool, nestedArgs) =>
              executeAgent(
                agentTool,
                nestedArgs,
                allAgents,
                allTools,
                ROLES,
                settings,
                null,
                sendChunk, // Stream nested agent output (null if disabled)
                null
              ),
          });
        }

        console.log("[MCP] Tool execution completed:", { requestId, resultLength: result?.length });

        // Send result back to main process
        window.electronAPI.sendToolExecutionResult(requestId, result);
      } catch (error) {
        console.error("[MCP] Tool execution error:", error);
        window.electronAPI.sendToolExecutionResult(requestId, `Error: ${error.message}`);
      }
    });

    console.log("[MCP] Tool execution handler registered with full agent support");
  });
}
