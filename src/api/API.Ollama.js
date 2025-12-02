/*************** Ollama Local API **************/

import { ROLES } from "@utils/constants";

export const AI_API = {
  getDefaultHeaders: function () {
    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };
  },
  fetchAvailableModels: async function (ollamaUrl) {
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const json = await response.json();
      if (json.error) {
        throw new Error(`Ollama models error: ${json.error}`);
      }
      // Map Ollama models to the expected format with metadata
      // Note: Ollama doesn't provide context length in /api/tags, would need /api/show per model
      const models = (json.models || [])
        .filter((model) => !model.name.toLowerCase().includes("embed"))
        .map((model) => ({
          id: model.name,
          text: model.name,
          // Ollama doesn't provide metadata directly, set defaults
          // Models can be queried individually with /api/show for details
          contextLength: null,
          supportsTools: true, // Most modern Ollama models support tools
          supportsVision:
            model.name.toLowerCase().includes("vision") ||
            model.name.toLowerCase().includes("llava") ||
            false,
          supportsJsonOutput: true, // Ollama supports JSON format
        }));
      return models;
    } catch (error) {
      throw new Error(`Failed to fetch Ollama models: ${error.message}`);
    }
  },
  fetchAvailableEmbeddings: async function (ollamaUrl) {
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const json = await response.json();
      if (json.error) {
        throw new Error(`Ollama embeddings error: ${json.error}`);
      }
      // Filter for embedding models (models that typically contain "embed" in name)
      const embeddingModels = (json.models || [])
        .filter((model) => model.name.toLowerCase().includes("embed"))
        .map((model) => ({
          id: model.name,
          text: model.name,
        }));
      return embeddingModels;
    } catch (error) {
      throw new Error(`Failed to fetch Ollama embeddings: ${error.message}`);
    }
  },
  generateAccessToken: async function () {
    // Ollama local API doesn't need authentication
    return Promise.resolve({ access_token: "local" });
  },
  embeddingsGet: async function (inputs, modelId, abortSignal, providerParams) {
    const ollamaUrl = providerParams.ollamaUrl || "http://localhost:11434";
    const signal = abortSignal || undefined;

    // Ollama requires sequential embedding requests
    const embeddings = await Promise.all(
      inputs.map(async (text, index) => {
        try {
          const response = await fetch(`${ollamaUrl}/api/embeddings`, {
            ...this.getDefaultHeaders(),
            signal,
            body: JSON.stringify({
              model: modelId,
              prompt: text,
            }),
          });

          const json = await response.json();
          if (json.error) {
            throw new Error(`Embeddings error for input ${index}: ${json.error}`);
          }
          return json.embedding;
        } catch (error) {
          throw new Error(`Failed to get embeddings for input ${index}: ${error.message}`);
        }
      })
    );

    // Transform Ollama response to match WatsonX format
    return {
      results: embeddings.map((embedding) => ({
        embedding: embedding,
      })),
    };
  },
  oneShotPrompt: async function (systemPrompt, prompt, modelId, options = {}) {
    const { context, abortSignal, jsonSchema, jsonValid, tools, providerParams, onChunk } = options;
    const ollamaUrl = providerParams.ollamaUrl || "http://localhost:11434";
    const maxTokens = providerParams.maxTokens;
    const temperature = providerParams.temperature;
    const signal = abortSignal || undefined;
    const additionalParams = {};

    // Handle JSON schema and JSON object response formats
    // Note: Ollama uses format parameter for structured output
    if (jsonSchema) {
      additionalParams.format = jsonSchema;
    } else if (jsonValid) {
      additionalParams.format = "json";
    }

    // Handle tools if provided
    // Note: Ollama supports tools through messages with tool definitions
    if (tools && tools.length > 0) {
      additionalParams.tools = tools.map((tool) => {
        // Parse parameters schema if it's a string
        let parametersSchema = tool.parameters || {};
        if (typeof parametersSchema === "string") {
          try {
            parametersSchema = JSON.parse(parametersSchema);
          } catch (e) {
            parametersSchema = {};
          }
        }

        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description || "",
            parameters: {
              type: "object",
              properties: parametersSchema.properties || {},
              required: parametersSchema.required || [],
            },
          },
        };
      });
    }

    // Helper function to extract base64 data from dataUrl for Ollama
    const extractImagesBase64 = (images) => {
      if (!images || images.length === 0) return undefined;
      return images
        .map((img) => {
          const dataUrl = img.dataUrl || img.url;
          if (!dataUrl) return null;
          // Extract base64 data (format: data:image/jpeg;base64,...)
          const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
          return match ? match[1] : null; // Return null if not a valid base64 dataUrl
        })
        .filter(Boolean); // Remove null entries
    };

    // Build messages array for Ollama format
    const messages = [];

    // Add system prompt if present
    if (systemPrompt) {
      messages.push({
        role: ROLES.SYSTEM,
        content: systemPrompt,
      });
    }

    // Add context messages if present
    if (context?.length) {
      context.forEach((c) => {
        const msg = {
          role: c?.role || ROLES.USER,
          content: c?.message || "",
        };
        // Add images for user messages (Ollama uses 'images' array with base64 data)
        if (c?.role === ROLES.USER && c?.images?.length > 0) {
          msg.images = extractImagesBase64(c.images);
        }
        // Add tool_calls for assistant messages
        if (c?.role === ROLES.ASSISTANT && c?.toolCalls?.length > 0) {
          // Ollama expects arguments to be an object, not a JSON string
          msg.tool_calls = c.toolCalls.map((tc) => {
            const toolCall = { ...tc };
            if (toolCall.function?.arguments) {
              // Parse arguments if they're a string
              if (typeof toolCall.function.arguments === "string") {
                try {
                  toolCall.function.arguments = JSON.parse(toolCall.function.arguments);
                } catch (e) {
                  toolCall.function.arguments = {};
                }
              }
            }
            return toolCall;
          });
        }
        // Add tool_name for tool messages (Ollama uses tool_name, not tool_call_id)
        if (c?.role === ROLES.TOOL && c?.toolName) {
          msg.tool_name = c.toolName;
        }
        messages.push(msg);
      });
    }

    // Only add user message if prompt is not empty
    // This allows tool messages to be the last message in context
    if (prompt) {
      messages.push({
        role: ROLES.USER,
        content: prompt,
      });
    }

    // Build Ollama request body
    const requestBody = {
      model: modelId,
      messages: messages,
      stream: !!onChunk, // Enable streaming if onChunk is provided
      options: {
        num_predict: maxTokens,
        temperature: temperature,
      },
      ...additionalParams,
    };

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      ...this.getDefaultHeaders(),
      signal,
      body: JSON.stringify(requestBody),
    });

    // Streaming mode
    if (onChunk) {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullContent = "";
      let toolCalls = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const data = JSON.parse(trimmed);

              if (data.error) {
                throw new Error(`Ollama chat error (model: ${modelId}): ${data.error}`);
              }

              if (data.message) {
                // Handle content
                if (data.message.content) {
                  fullContent += data.message.content;
                  onChunk(data.message.content);
                }

                // Handle tool calls
                if (data.message.tool_calls) {
                  toolCalls = data.message.tool_calls.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: {
                      name: tc.function?.name || "",
                      arguments:
                        typeof tc.function?.arguments === "string"
                          ? tc.function.arguments
                          : JSON.stringify(tc.function?.arguments || {}),
                    },
                  }));
                }
              }
            } catch (parseError) {
              console.warn("Failed to parse Ollama chunk:", parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Return complete response in standard format
      return {
        choices: [
          {
            message: {
              content: fullContent,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            },
          },
        ],
      };
    }

    // Non-streaming mode (original behavior)
    const json = await response.json();
    if (json.error) {
      throw new Error(`Ollama chat error (model: ${requestBody.model}): ${json.error}`);
    }

    // Transform Ollama response to match WatsonX format
    return {
      choices: [
        {
          message: {
            content: json.message.content || "",
            tool_calls: json.message.tool_calls
              ? json.message.tool_calls.map((tc) => ({
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.function?.name || "",
                    arguments:
                      typeof tc.function?.arguments === "string"
                        ? tc.function.arguments
                        : JSON.stringify(tc.function?.arguments || {}),
                  },
                }))
              : [],
          },
        },
      ],
    };
  },
};
