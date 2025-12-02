/*************** WX API **************/

import { ROLES } from "@utils/constants";

export const AI_API = {
  getDefaultHeaders: function (providerParams) {
    return {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerParams.accessToken}`,
      },
    };
  },
  fetchAvailableModels: async function (accessToken, watsonxUrl) {
    try {
      const endpoint = `${watsonxUrl}/ml/v1/foundation_model_specs?version=2024-03-13`;
      const response = await fetch(endpoint, {
        ...this.getDefaultHeaders({ accessToken }),
        method: "GET",
      });
      const json = await response.json();
      if (json.errors?.length) {
        throw new Error(json.errors[0].message);
      }
      // Transform WatsonX model list to standard format with metadata
      return (json.resources || [])
        .filter((model) => model.functions?.some((f) => f.id === "text_chat"))
        .map((model) => ({
          id: model.model_id,
          text: `${model.label}`,
          // Add model metadata from API response
          contextLength: model.model_limits?.max_sequence_length || null,
          supportsTools: model.functions?.some((f) => f.id === "function_calling") || false,
          supportsVision: model.functions?.some((f) => f.id === "vision") || false,
          supportsJsonOutput: true, // WatsonX supports JSON output for chat models
        }));
    } catch (error) {
      console.error("Failed to fetch WatsonX models:", error);
      return [];
    }
  },
  fetchAvailableEmbeddings: async function (accessToken, watsonxUrl) {
    try {
      const endpoint = `${watsonxUrl}/ml/v1/foundation_model_specs?version=2024-03-13`;
      const response = await fetch(endpoint, {
        ...this.getDefaultHeaders({ accessToken }),
        method: "GET",
      });
      const json = await response.json();
      if (json.errors?.length) {
        throw new Error(json.errors[0].message);
      }
      // Filter for embedding models (typically contain "embedding" in their ID)
      return (json.resources || [])
        .filter((model) => model.functions?.some((f) => f.id === "embedding"))
        .map((model) => ({
          id: model.model_id,
          text: `${model.label}`,
        }));
    } catch (error) {
      console.error("Failed to fetch WatsonX embeddings:", error);
      return [];
    }
  },
  generateAccessToken: async function (providerParams) {
    const response = await fetch("https://iam.cloud.ibm.com/identity/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${providerParams.apiKey}`,
    });
    const result = await response.json();
    return result?.access_token;
  },
  embeddingsGet: async function (inputs, modelId, abortSignal, providerParams) {
    const projectId = providerParams.projectId;
    const watsonxUrl = providerParams.watsonxUrl;
    const signal = abortSignal || undefined;

    const embeddingsEndpoint = `${watsonxUrl}/ml/v1/text/embeddings?version=2024-03-13`;

    const response = await fetch(embeddingsEndpoint, {
      ...this.getDefaultHeaders(providerParams),
      signal,
      body: JSON.stringify({
        model_id: modelId,
        project_id: projectId,
        inputs: inputs,
        parameters: {
          truncate_input_tokens: 512,
          return_options: { input_text: true },
        },
      }),
    });
    const json = await response.json();
    if (json.errors?.length) {
      throw json.errors[0].message;
    }
    return json;
  },
  oneShotPrompt: async function (systemPrompt, prompt, modelId, options = {}) {
    const {
      context,
      abortSignal,
      jsonSchema,
      jsonValid,
      jsonStrict,
      tools,
      providerParams,
      onChunk,
    } = options;
    const projectId = providerParams.projectId;
    const watsonxUrl = providerParams.watsonxUrl;
    const maxTokens = providerParams.maxTokens;
    const temperature = providerParams.temperature;
    const timeLimit = providerParams.timeLimit;
    const signal = abortSignal || undefined;
    const additionalParams = {};

    const chatEndpoint = `${watsonxUrl}/ml/v1/text/chat?version=2024-03-13`;
    // WatsonX uses stream parameter to enable streaming
    const streamEndpoint = `${watsonxUrl}/ml/v1/text/chat_stream?version=2024-03-13`;

    // Handle JSON schema and JSON object response formats
    if (jsonSchema) {
      additionalParams.response_format = {
        type: "json_schema",
        json_schema: {
          name: "promptschema",
          schema: jsonSchema,
          strict: !!jsonStrict, //false will allow the model to return additional fields
        },
      };
    } else if (jsonValid) {
      additionalParams.response_format = {
        type: "json_object",
      };
    }

    // Handle tools if provided (WatsonX API specification)
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

    const requestBody = {
      model_id: modelId,
      project_id: projectId,
      max_tokens: maxTokens,
      temperature: temperature,
      time_limit: timeLimit,
      ...additionalParams,
      messages: [
        {
          role: ROLES.SYSTEM,
          content: systemPrompt,
        },
        ...(context?.length
          ? context.map((c) => {
              const msg = {
                role: c?.role || ROLES.USER,
              };

              // Handle content based on role
              if (c?.role === ROLES.USER) {
                msg.content = [
                  {
                    type: "text",
                    text: c?.message || "",
                  },
                ];
              } else if (c?.role === ROLES.ASSISTANT) {
                msg.content = c?.message || "";
                // Add tool_calls for assistant messages if present
                if (c?.toolCalls?.length > 0) {
                  msg.tool_calls = c.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: tc.type || "function",
                    function: {
                      name: tc.function?.name || tc.name,
                      arguments:
                        typeof tc.function?.arguments === "string"
                          ? tc.function.arguments
                          : JSON.stringify(tc.function?.arguments || tc.arguments || {}),
                    },
                  }));
                }
              } else if (c?.role === ROLES.TOOL) {
                // Tool response message
                msg.content = c?.message || "";
                msg.tool_call_id = c?.toolId || "";
              } else {
                msg.content = c?.message || "";
              }

              return msg;
            })
          : []),
        // Only add user message if prompt is not empty
        // This allows tool messages to be the last message in context
        ...(prompt
          ? [
              {
                role: ROLES.USER,
                content: [
                  {
                    type: "text",
                    text: prompt,
                  },
                ],
              },
            ]
          : []),
      ],
    };

    // Enable streaming if onChunk callback is provided
    if (onChunk) {
      const response = await fetch(streamEndpoint, {
        ...this.getDefaultHeaders(providerParams),
        signal,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WatsonX API error: ${response.status} ${errorText}`);
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
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            try {
              const jsonStr = trimmed.slice(6); // Remove "data: " prefix
              if (jsonStr === "[DONE]") continue;

              const data = JSON.parse(jsonStr);

              if (data.errors?.length) {
                throw new Error(data.errors[0].message);
              }

              // WatsonX streaming format: check for choices array
              if (data.choices?.[0]?.delta) {
                const delta = data.choices[0].delta;

                // Handle content delta
                if (delta.content) {
                  fullContent += delta.content;
                  onChunk(delta.content);
                }

                // Handle tool calls delta
                if (delta.tool_calls) {
                  delta.tool_calls.forEach((toolCallDelta) => {
                    const index = toolCallDelta.index;
                    if (!toolCalls[index]) {
                      toolCalls[index] = {
                        id: toolCallDelta.id || "",
                        type: "function",
                        function: {
                          name: "",
                          arguments: "",
                        },
                      };
                    }
                    if (toolCallDelta.id) {
                      toolCalls[index].id = toolCallDelta.id;
                    }
                    if (toolCallDelta.function?.name) {
                      toolCalls[index].function.name += toolCallDelta.function.name;
                    }
                    if (toolCallDelta.function?.arguments) {
                      toolCalls[index].function.arguments += toolCallDelta.function.arguments;
                    }
                  });
                }
              }
            } catch (parseError) {
              console.warn("Failed to parse WatsonX chunk:", parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

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
    const response = await fetch(chatEndpoint, {
      ...this.getDefaultHeaders(providerParams),
      signal,
      body: JSON.stringify(requestBody),
    });
    const json = await response.json();
    if (json.errors?.length) throw json.errors[0].message;

    return json;
  },
};
