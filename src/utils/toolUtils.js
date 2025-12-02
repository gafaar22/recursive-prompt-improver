import { STORAGE } from "@core/STORAGE";
import { jsonrepair } from "jsonrepair";
import { executeMCPTool } from "@core/MCP";
import { runInSandbox } from "@utils/sandboxUtils";

const emptyFn = `// Environment variables defined in Settings are available as: env.VARIABLE_NAME
// TODO: Implement your tool logic here
return true;`;

/**
 * Parse and extract request from various argument formats
 * Handles: string args, JSON strings, objects with/without 'request' field, malformed JSON
 * @param {string|Object} args - The arguments to parse
 * @returns {string} - The extracted request string
 */
export const extractRequestFromArgs = (args) => {
  let request = "";

  if (typeof args === "string") {
    // If args is a string, try to parse it as JSON first
    try {
      const parsed = JSON.parse(jsonrepair(args));
      if (parsed.request !== undefined) {
        request = parsed.request;
      } else if (typeof parsed === "object" && parsed !== null && Object.keys(parsed).length > 0) {
        // If it's an object without 'request' key, check if there's a single string value
        const values = Object.values(parsed);
        if (values.length === 1 && typeof values[0] === "string") {
          // Single string value (e.g., {"someKey": "actual content"})
          request = values[0];
        } else {
          // Multiple values or non-string, stringify the object
          request = JSON.stringify(parsed);
        }
      } else if (typeof parsed === "string") {
        // jsonrepair might return a plain string
        request = parsed;
      } else {
        // Fallback to original string
        request = args;
      }
    } catch {
      // Not valid JSON, use string directly
      request = args;
    }
  } else if (args && typeof args === "object") {
    if (args.request !== undefined) {
      request = args.request;
    } else {
      // Check if it's an object with a single string value (malformed args)
      const values = Object.values(args);
      if (values.length === 1 && typeof values[0] === "string") {
        request = values[0];
      } else {
        // If no 'request' field, stringify the entire args object
        request = JSON.stringify(args);
      }
    }
  }

  return request;
};

/**
 * Extract function name from function code
 * @param {string} functionCode - The function code
 * @returns {string|null} - The function name or null if not found
 */
const extractFunctionName = (functionCode) => {
  const match = functionCode.match(/(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
  return match ? match[1] : null;
};

/**
 * Validate function code syntax without executing it
 * @param {string} functionCode - The JavaScript function code as a string
 * @returns {Object} - Returns { valid: boolean, error: string }
 */
export const validateFunctionCode = (functionCode) => {
  if (!functionCode || typeof functionCode !== "string") {
    return {
      valid: false,
      error: "Function code must be a non-empty string",
    };
  }

  // Check if code contains a function definition
  const functionRegex = /^\s*(async\s+)?function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/m;
  if (!functionRegex.test(functionCode)) {
    return {
      valid: false,
      error:
        "Code must contain a named function definition (e.g., 'function myFunction()' or 'async function myFunction()')",
    };
  }

  try {
    // Try to parse the code by wrapping it in a function body
    // This validates the syntax without executing it
    new Function(functionCode);
    return {
      valid: true,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Syntax error: ${error.message}`,
    };
  }
};

/**
 * Load environment variables from storage and return as an object
 * @returns {Promise<Object>} - Environment variables as key-value pairs
 */
const loadEnvObject = async () => {
  const environmentVariables = await STORAGE.getEnvironmentVariables();
  const envObject = {};
  environmentVariables.forEach((envVar) => {
    envObject[envVar.key] = envVar.value;
  });
  return envObject;
};

/**
 * Execute a complete function definition with given parameters in a sandboxed environment
 * Used for testing full function definitions (e.g., "function myFunc(a, b) { return a + b; }")
 *
 * @param {string} functionCode - The complete JavaScript function code as a string
 * @param {Object} parameters - The parameters to pass to the function
 * @param {number} timeout - Maximum execution time in milliseconds (default: 5000ms)
 * @returns {Promise<Object>} - Returns { success: boolean, result: any, error: string }
 */
export const executeSandboxedFunction = async (functionCode, parameters = {}, timeout = 5000) => {
  // Validate inputs
  if (!functionCode || typeof functionCode !== "string") {
    return {
      success: false,
      result: null,
      error: "Invalid function code provided",
    };
  }

  const functionName = extractFunctionName(functionCode);
  if (!functionName) {
    return {
      success: false,
      result: null,
      error: "Could not extract function name from code",
    };
  }

  // Validate function code before execution
  const validation = validateFunctionCode(functionCode);
  if (!validation.valid) {
    return {
      success: false,
      result: null,
      error: validation.error,
    };
  }

  // Load environment variables from storage
  const envObject = await loadEnvObject();

  // Create the code that defines and calls the function
  const wrappedCode = `
    ${functionCode}
    return ${functionName}(${Object.keys(parameters).join(", ")});
  `;

  // Execute in sandbox with timeout
  return runInSandbox(wrappedCode, parameters, envObject, timeout);
};

/**
 * Extracts function body from various function formats
 * Handles regular functions, arrow functions, async functions, and method syntax
 * Also removes markdown code blocks if present
 *
 * @param {string} functionCode - The complete function code
 * @returns {string} - The extracted function body with proper indentation
 */
export const extractFunctionBody = (functionCode) => {
  if (!functionCode || typeof functionCode !== "string") {
    return emptyFn;
  }

  try {
    // Remove markdown code blocks if present
    let code = functionCode.trim();
    code = code.replace(/^```(?:javascript|js)?\s*/gm, "");
    code = code.replace(/```\s*$/gm, "");
    code = code.trim();

    // Find the function body by looking for the opening brace after the parameter list
    // This handles:
    // - Regular functions: function name(...) { body }
    // - Arrow functions: (...) => { body }
    // - Async functions: async function name(...) { body }
    // - Method syntax: name(...) { body }
    // - Destructured params: function name({ a, b }) { body }

    // Find the position of the opening brace of the function body
    // We need to find the brace that comes after the closing parenthesis of parameters
    // or after the => in arrow functions
    let bodyStartIndex = -1;
    let braceCount = 0;
    let inParams = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];

      if (char === "(") {
        inParams = true;
        braceCount++;
      } else if (char === ")" && inParams) {
        braceCount--;
        if (braceCount === 0) {
          inParams = false;
        }
      } else if (char === "{" && !inParams) {
        // Found the opening brace of the function body
        bodyStartIndex = i;
        break;
      }
    }

    if (bodyStartIndex === -1) {
      return emptyFn;
    }

    // Now find the matching closing brace
    braceCount = 1;
    let bodyEndIndex = -1;

    for (let i = bodyStartIndex + 1; i < code.length; i++) {
      const char = code[i];

      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          bodyEndIndex = i;
          break;
        }
      }
    }

    if (bodyEndIndex === -1) {
      return emptyFn;
    }

    // Extract the body content (between the braces)
    let body = code.substring(bodyStartIndex + 1, bodyEndIndex).trim();

    // If body is empty or too short, return default
    if (!body || body.length < 3) {
      return emptyFn;
    }

    // Add proper indentation (2 spaces)
    const lines = body.split("\n");
    const indentedBody = lines
      .map((line) => {
        // Skip empty lines
        if (!line.trim()) {
          return "";
        }
        // Add 2 spaces indentation if not already indented
        return line.startsWith("  ") ? line : `  ${line}`;
      })
      .join("\n")
      .trim();

    return indentedBody;
  } catch (error) {
    console.error("Error extracting function body:", error);
    return emptyFn;
  }
};

/**
 * Generates a function signature based on tool name and parameter schema
 *
 * @param {string} toolName - The name of the tool
 * @param {string|object} parametersSchema - JSON Schema object or string
 * @returns {string} - The function signature (e.g., "async function myTool(param1, param2) {")
 */
export const generateFunctionSignature = (toolName, parametersSchema) => {
  try {
    // Validate tool name to prevent code injection
    const nameRegex = /^[a-zA-Z]+[a-zA-Z0-9-_]*$/;
    if (!toolName || !nameRegex.test(toolName)) {
      toolName = "myTool";
    }

    // Parse the schema if it's a string
    let schema = parametersSchema;
    if (typeof parametersSchema === "string") {
      // Trim and check if it's valid JSON
      const trimmed = parametersSchema.trim();
      if (trimmed) {
        schema = JSON.parse(trimmed);
      }
    }

    // Extract parameter names from schema properties
    let params = [];
    if (
      schema &&
      typeof schema === "object" &&
      schema.properties &&
      typeof schema.properties === "object"
    ) {
      params = Object.keys(schema.properties);
    }

    const paramString = params.join(", ");

    return `async function ${toolName}(${paramString}) {`;
  } catch (error) {
    // If parsing fails, return signature without parameters
    const nameRegex = /^[a-zA-Z]+[a-zA-Z0-9-_]*$/;
    const validName = toolName && nameRegex.test(toolName) ? toolName : "myTool";
    return `async function ${validName}() {`;
  }
};

/**
 * Gets the default function body template
 *
 * @returns {string} - The default function body
 */
export const getDefaultFunctionBody = () => {
  return emptyFn;
};

/**
 * Validate function body syntax without executing it
 * @param {string} functionBody - The JavaScript function body (without function declaration)
 * @returns {Object} - Returns { valid: boolean, error: string }
 */
export const validateFunctionBody = (functionBody) => {
  if (!functionBody || typeof functionBody !== "string") {
    return {
      valid: false,
      error: "Function body must be a non-empty string",
    };
  }

  try {
    // Try to create an async function to validate the syntax
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    new AsyncFunction(`"use strict";\n${functionBody}`);
    return {
      valid: true,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Syntax error: ${error.message}`,
    };
  }
};

/**
 * Execute a function body with given arguments in a sandboxed environment
 * Creates an async function from the function body and executes it safely
 *
 * @param {string} functionBody - The JavaScript function body (without function declaration)
 * @param {Object} args - Arguments object with key-value pairs
 * @param {number} timeout - Maximum execution time in milliseconds (default: 5000ms)
 * @returns {Promise<Object>} - Returns { success: boolean, result: any, error: string }
 */
export const executeFunctionBody = async (functionBody, args = {}, timeout = 5000) => {
  // Validate inputs
  if (!functionBody || typeof functionBody !== "string") {
    return {
      success: false,
      result: null,
      error: "Invalid function body provided",
    };
  }

  // Load environment variables from storage
  const envObject = await loadEnvObject();

  // Execute in sandbox with timeout
  return runInSandbox(functionBody, args, envObject, timeout);
};

/**
 * Convert an agent to a tool format for API calls
 * Agents are represented as simple tools that take a natural language string as input
 *
 * @param {Object} agent - The agent object to convert
 * @returns {Object} - Tool definition compatible with API
 */
export const convertAgentToTool = (agent) => {
  return {
    type: "function",
    function: {
      name: agent.name,
      description: agent.instructions || `Agent: ${agent.name}`,
      parameters: {
        type: "object",
        properties: {
          request: {
            type: "string",
            description: "Natural language request or question for the agent",
          },
        },
        required: ["request"],
      },
    },
  };
};

/**
 * Executes a tool function based on a tool call from the AI
 * Finds the tool definition, creates an async function from its body, and executes it safely
 * Also handles agent tools by executing the full conversational flow
 *
 * @param {Object} toolCall - The tool call object from the AI response
 * @param {Array} availableTools - Array of available tool definitions (tools + agents)
 * @param {number} timeout - Maximum execution time in milliseconds (default: 5000ms)
 * @param {Object} options - Optional parameters
 * @param {Function} options.executeAgent - Function to execute an agent (for agent tools)
 * @param {Function} options.onChunk - Optional callback for streaming progress (chunk) => void
 * @returns {Promise<string>} - The tool execution result as a string
 */
export const executeTool = async (toolCall, availableTools, timeout = 60000, options = {}) => {
  const toolName = toolCall.function?.name;
  const toolArgs = toolCall.function?.arguments;

  // Find the tool definition
  const toolDef = availableTools.find((t) => t.name === toolName);
  if (!toolDef) {
    return `Error: Tool '${toolName}' not found`;
  }

  // Debug logging
  console.log("[executeTool] Tool found:", {
    name: toolName,
    isAgent: toolDef.isAgent,
    isMCP: toolDef.isMCP,
    hasExecuteAgent: !!options.executeAgent,
    hasFunctionCode: !!toolDef.functionCode,
    toolArgs: toolArgs,
    toolArgsType: typeof toolArgs,
  });

  try {
    // Parse arguments - handle empty or invalid JSON
    let args = {};
    if (toolArgs) {
      if (typeof toolArgs === "string") {
        // Handle empty string or whitespace-only strings
        const trimmedArgs = toolArgs.trim();
        if (trimmedArgs === "" || trimmedArgs === "{}") {
          args = {};
        } else {
          try {
            args = JSON.parse(trimmedArgs);
          } catch (parseError) {
            console.error(`[executeTool] Failed to parse arguments for ${toolName}:`, parseError);
            return `Error: Invalid JSON arguments for tool '${toolName}': ${parseError.message}`;
          }
        }
      } else {
        args = toolArgs;
      }
    }

    // Check if this is an MCP tool (has isMCP flag)
    if (toolDef.isMCP) {
      // Execute via MCP server with streaming support
      const execution = await executeMCPTool(
        toolDef.mcpServerId,
        toolName,
        args,
        timeout, // Use the same timeout for MCP tools (default 30s)
        options.onChunk // Pass streaming callback for MCP tools that support it
      );

      if (!execution.success) {
        return `Error: ${execution.error}`;
      }

      // Return result as string
      const result = execution.result;
      return typeof result === "string" ? result : JSON.stringify(result);
    }

    // Check if this is an agent tool (has isAgent flag)
    if (toolDef.isAgent && options.executeAgent) {
      // Execute the agent's conversational flow
      const agentResult = await options.executeAgent(toolDef, args);
      return agentResult;
    }

    // Regular tool execution
    // Extract function body from functionCode
    const functionBody = extractFunctionBody(toolDef.functionCode || "");

    if (!functionBody || functionBody === emptyFn) {
      return `Error: Tool '${toolName}' has no valid function implementation`;
    }

    // Execute the function body in sandboxed environment
    const execution = await executeFunctionBody(functionBody, args, timeout);

    if (!execution.success) {
      return `Error: ${execution.error}`;
    }

    // Return result as string
    const result = execution.result;
    return typeof result === "string" ? result : JSON.stringify(result);
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return `Error executing tool: ${error.message}`;
  }
};
