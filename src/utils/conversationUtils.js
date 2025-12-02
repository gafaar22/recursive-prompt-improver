/**
 * Utility functions for conversational flows with agent and tool execution
 */

import { CORE } from "@core/MAIN";
import { executeTool, extractRequestFromArgs } from "@utils/toolUtils";
import { convertAgentsToTools } from "@utils/uiUtils";

/**
 * Execute an agent as a tool
 * Runs the agent's conversational flow with the provided request
 *
 * @param {Object} agentTool - The agent tool definition
 * @param {Object} args - Arguments with request parameter
 * @param {Array} availableAgents - Array of available agent objects
 * @param {Array} availableTools - Array of available tool objects
 * @param {Object} ROLES - Role constants
 * @param {Object} settings - Settings object with maxToolIterations
 * @param {Function} onMessageUpdate - Optional callback for UI updates during nested execution
 * @param {Function} onStreamChunk - Optional callback for streaming text chunks (textDelta) => void
 * @param {AbortSignal} abortSignal - Abort signal for cancellation
 * @returns {Promise<string>} - The agent execution result
 */
export const executeAgent = async (
  agentTool,
  args,
  availableAgents,
  availableTools,
  ROLES,
  settings,
  onMessageUpdate = null,
  onStreamChunk = null,
  abortSignal = null
) => {
  try {
    // Find the full agent object
    const agent = availableAgents.find((a) => a.id === agentTool.id);
    if (!agent) {
      return `Error: Agent '${agentTool.name}' not found`;
    }
    // Extract request from args using utility function
    const request = extractRequestFromArgs(args);
    // Execute the agent's conversational loop with initialRole: ROLES.TOOL
    const result = await CORE.executeConversationalLoop({
      systemPrompt: agent.instructions,
      userMessage: request,
      modelId: agent.coreModel?.id,
      providerId: agent.coreModel?.providerId,
      initialMessages: [], // Agents start with empty message history for tool execution
      tools: agent.selectedTools || [],
      availableTools: [...availableTools, ...convertAgentsToTools(availableAgents, agent.id)], // Include nested agents converted to tool format
      ROLES,
      maxIterations: settings.maxToolIterations || 5,
      jsonSchema: agent.useJsonSchema ? agent.jsonSchema : undefined,
      jsonStrict: agent.jsonSchemaStrict,
      onMessageUpdate: onMessageUpdate || (() => {}), // Pass through or use no-op
      onStreamChunk: onStreamChunk || undefined, // Pass streaming callback if available
      executeToolFn: (toolCall, tools, timeout) =>
        executeTool(toolCall, tools, timeout, {
          onChunk: onStreamChunk, // Pass streaming callback for MCP tools
          executeAgent: (nestedAgentTool, nestedArgs) =>
            executeAgent(
              nestedAgentTool,
              nestedArgs,
              availableAgents,
              availableTools,
              ROLES,
              settings,
              onMessageUpdate,
              onStreamChunk, // Pass through for nested agents
              abortSignal
            ),
        }),
      timeLimit: settings.time_limit || 60000,
      //initialRole: ROLES.TOOL, //is not always tool, because if i call a tool that is an agent it must have user role
      abortSignal,
    });

    if (!result.success) {
      //TODO: check max iteration here
      return `Error: Agent execution failed - ${result.error}`;
    }

    // Return the last assistant message as the result
    const lastAssistantMessage = result.messages
      .filter((m) => m.role === ROLES.ASSISTANT && m.content)
      .pop();

    return lastAssistantMessage?.content || "Agent completed with no output";
  } catch (error) {
    console.error(`Error executing agent ${agentTool.name}:`, error);
    return `Error executing agent: ${error.message}`;
  }
};

/**
 * Execute a conversational loop with tool and agent support
 * Wrapper around CORE.executeConversationalLoop with agent execution capability
 *
 * @param {Object} params - Parameters for the conversational loop
 * @param {string} params.systemPrompt - System instructions
 * @param {string} params.userMessage - User message
 * @param {Array} params.images - Optional array of image objects with dataUrl and mimeType
 * @param {string} params.modelId - Model ID
 * @param {string} params.providerId - Provider ID
 * @param {Array} params.initialMessages - Previous messages
 * @param {Array} params.tools - Selected tools/agents
 * @param {Array} params.availableTools - Available tool objects
 * @param {Array} params.availableAgents - Available agent objects
 * @param {Object} params.ROLES - Role constants
 * @param {number} params.maxIterations - Max tool iterations
 * @param {string} params.jsonSchema - Optional JSON schema
 * @param {boolean} params.jsonStrict - Strict JSON mode
 * @param {Function} params.onMessageUpdate - Callback for message updates
 * @param {Function} params.onStreamChunk - Callback for streaming text chunks (textDelta) => void
 * @param {Object} params.settings - Settings object
 * @param {AbortSignal} params.abortSignal - Abort signal for cancellation
 * @returns {Promise<Object>} - Result with success, messages, and error
 */
export const executeConversationalLoopWithAgents = async ({
  systemPrompt,
  userMessage,
  images,
  modelId,
  providerId,
  initialMessages,
  tools,
  availableTools,
  availableAgents,
  ROLES,
  maxIterations,
  jsonSchema,
  jsonStrict,
  onMessageUpdate,
  onStreamChunk,
  settings,
  abortSignal,
}) => {
  // Combine tools and agents for execution
  // Convert agents to tool format with isAgent flag
  const convertedAgents = convertAgentsToTools(availableAgents);
  const combinedAvailableTools = [...availableTools, ...convertedAgents];
  // Execute conversational loop with tool support
  return await CORE.executeConversationalLoop({
    systemPrompt,
    userMessage,
    images,
    modelId,
    providerId,
    initialMessages,
    tools,
    availableTools: combinedAvailableTools,
    ROLES,
    maxIterations,
    jsonSchema,
    jsonStrict,
    onMessageUpdate,
    onStreamChunk, // Pass streaming callback through
    executeToolFn: (toolCall, tools, timeout) =>
      executeTool(toolCall, tools, timeout, {
        onChunk: (delta) => onStreamChunk && onStreamChunk(delta, ROLES.TOOL), // Pass streaming callback for MCP tools
        executeAgent: (agentTool, args) =>
          executeAgent(
            agentTool,
            args,
            availableAgents,
            availableTools,
            ROLES,
            settings,
            () => {}, //onMessageUpdate,
            (delta) => onStreamChunk && onStreamChunk(delta, ROLES.TOOL), //onStreamChunk
            abortSignal
          ),
      }),
    timeLimit: settings.time_limit || 60000,
    abortSignal,
  });
};
