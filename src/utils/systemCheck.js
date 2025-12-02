/**
 * System check utilities for detecting local services and configurations
 */

import { DEFAULT_VALUES } from "@utils/constants";

/**
 * Check if Ollama is running locally
 * @returns {Promise<{found: boolean, url: string, models: Array}>}
 */
export const checkOllamaInstalled = async () => {
  const ollamaUrl = DEFAULT_VALUES.DEFAULT_OLLAMA_URL;

  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return { found: false, url: null, models: [] };
    }

    const json = await response.json();
    const models = (json.models || []).map((model) => ({
      id: model.name,
      text: model.name,
    }));

    return {
      found: true,
      url: ollamaUrl,
      models,
    };
  } catch {
    return { found: false, url: null, models: [] };
  }
};

/**
 * Check if LM Studio is running locally
 * @returns {Promise<{found: boolean, url: string, models: Array}>}
 */
export const checkLMStudioInstalled = async () => {
  const lmstudioUrl = DEFAULT_VALUES.DEFAULT_LMSTUDIO_URL;

  try {
    const response = await fetch(`${lmstudioUrl}/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return { found: false, url: null, models: [] };
    }

    const json = await response.json();
    const models = (json.data || []).map((model) => ({
      id: model.id,
      text: model.id,
    }));

    return {
      found: true,
      url: lmstudioUrl,
      models,
    };
  } catch {
    return { found: false, url: null, models: [] };
  }
};
