/*************** Perplexity AI API **************/
// Perplexity AI API with web search capabilities
// API endpoint: https://api.perplexity.ai

import { ROLES } from "@utils/constants";

export const AI_API = {
  getDefaultHeaders: function (providerParams) {
    const apiKey = providerParams.apiKey;
    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    };
  },
  fetchAvailableModels: async function () {
    // Perplexity doesn't have a models endpoint, return predefined list with metadata
    return [
      {
        id: "sonar-pro",
        text: "Sonar Pro",
        contextLength: 200000,
        supportsTools: false,
        supportsVision: false,
        supportsJsonOutput: true,
      },
      {
        id: "sonar",
        text: "Sonar",
        contextLength: 128000,
        supportsTools: false,
        supportsVision: false,
        supportsJsonOutput: true,
      },
      {
        id: "sonar-reasoning-pro",
        text: "Sonar Reasoning Pro",
        contextLength: 128000,
        supportsTools: false,
        supportsVision: false,
        supportsJsonOutput: true,
      },
      {
        id: "sonar-reasoning",
        text: "Sonar Reasoning",
        contextLength: 128000,
        supportsTools: false,
        supportsVision: false,
        supportsJsonOutput: true,
      },
      {
        id: "sonar-deep-research",
        text: "Sonar Deep Research",
        contextLength: 128000,
        supportsTools: false,
        supportsVision: false,
        supportsJsonOutput: true,
      },
      {
        id: "r1-1776",
        text: "R1-1776",
        contextLength: 128000,
        supportsTools: false,
        supportsVision: false,
        supportsJsonOutput: true,
      },
    ];
  },
  fetchAvailableEmbeddings: async function () {
    // Perplexity doesn't support embeddings API
    return [];
  },
  generateAccessToken: async function () {
    // Perplexity uses API key directly, no token generation needed
    return Promise.resolve({ access_token: "not-needed" });
  },
  embeddingsGet: async function () {
    throw new Error("Embeddings API not available with Perplexity");
  },
  oneShotPrompt: async function (systemPrompt, prompt, modelId, options = {}) {
    const { context, abortSignal, jsonValid, providerParams, onChunk } = options;
    const maxTokens = providerParams.maxTokens;
    const temperature = providerParams.temperature;
    const signal = abortSignal || undefined;
    const additionalParams = {};

    // Handle JSON response format (Perplexity has limited JSON support)
    if (jsonValid) {
      additionalParams.response_format = {
        type: "json_object",
      };
    }

    // Note: Perplexity doesn't support JSON schema or tools/function calling
    // These features are simply omitted

    const requestBody = {
      model: modelId,
      max_tokens: maxTokens,
      temperature: temperature,
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
                content: c?.message || "",
              };
              return msg;
            })
          : []),
        // Only add user message if prompt is not empty
        ...(prompt
          ? [
              {
                role: ROLES.USER,
                content: prompt,
              },
            ]
          : []),
      ],
    };

    // Enable streaming if onChunk callback is provided
    if (onChunk) {
      requestBody.stream = true;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        ...this.getDefaultHeaders(providerParams),
        signal,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
      }

      // Process streaming response (Perplexity uses OpenAI-compatible SSE format)
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const jsonStr = trimmed.slice(6); // Remove "data: " prefix
              const data = JSON.parse(jsonStr);

              if (data.choices?.[0]?.delta) {
                const delta = data.choices[0].delta;

                // Handle content delta
                if (delta.content) {
                  fullContent += delta.content;
                  onChunk(delta.content);
                }
              }
            } catch (parseError) {
              console.warn("Failed to parse SSE chunk:", parseError);
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
            },
          },
        ],
      };
    }

    // Non-streaming mode
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      ...this.getDefaultHeaders(providerParams),
      signal,
      body: JSON.stringify(requestBody),
    });

    const json = await response.json();
    if (json.error) {
      throw new Error(`Perplexity error (model: ${modelId}): ${json.error.message || json.error}`);
    }

    // Return response (Perplexity's response is OpenAI-compatible)
    return json;
  },
};
