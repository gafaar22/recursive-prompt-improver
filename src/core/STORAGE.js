/*************** BE STORAGE **************/

import { STORAGE_KEYS, DEFAULT_VALUES, API_ENDPOINTS, API_VERSION } from "@utils/constants";
import { getStorageItem, setStorageItem } from "@utils/storageUtils";

export const STORAGE = {
  getMaxTokens: async function () {
    const value = await getStorageItem(STORAGE_KEYS.MAX_TOKENS);
    return value ? parseInt(value) : DEFAULT_VALUES.MAX_TOKENS;
  },
  getTimeLimit: async function () {
    const value = await getStorageItem(STORAGE_KEYS.TIME_LIMIT);
    return value ? parseInt(value) : DEFAULT_VALUES.TIME_LIMIT;
  },
  getTemperature: async function () {
    const value = await getStorageItem(STORAGE_KEYS.TEMPERATURE);
    return value ? parseFloat(value) : DEFAULT_VALUES.TEMPERATURE;
  },
  getProviderId: async function () {
    const savedProviders = await getStorageItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await getStorageItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);

    if (savedProviders) {
      const providers = JSON.parse(savedProviders);
      if (savedDefaultProviderId && providers.length > 0) {
        return savedDefaultProviderId;
      }
      // Return first provider id if no default set
      if (providers.length > 0) {
        return providers[0].id;
      }
    }
    return DEFAULT_VALUES.DEFAULT_PROVIDER.id;
  },
  getModelId: async function () {
    const savedProviders = await getStorageItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await getStorageItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);

    if (savedProviders) {
      const providers = JSON.parse(savedProviders);
      const defaultProvider = providers.find((p) => p.id === savedDefaultProviderId);
      if (defaultProvider?.selectedModel) {
        return defaultProvider.selectedModel.id;
      }
      // Return first provider's model if no default set
      if (providers.length > 0 && providers[0].selectedModel) {
        return providers[0].selectedModel.id;
      }
    }
    return DEFAULT_VALUES.DEFAULT_MODEL.id;
  },
  getEmbeddingsModelId: async function () {
    const savedProviders = await getStorageItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await getStorageItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);

    if (savedProviders) {
      const providers = JSON.parse(savedProviders);
      const defaultProvider = providers.find((p) => p.id === savedDefaultProviderId);
      if (defaultProvider?.selectedEmbeddingModel) {
        return defaultProvider.selectedEmbeddingModel.id;
      }
      // Return first provider's embedding model if no default set
      if (providers.length > 0 && providers[0].selectedEmbeddingModel) {
        return providers[0].selectedEmbeddingModel.id;
      }
    }
    return DEFAULT_VALUES.DEFAULT_EMBEDDING_MODEL.id;
  },
  getProjectId: async function () {
    const savedProviders = await getStorageItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await getStorageItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);

    if (savedProviders) {
      const providers = JSON.parse(savedProviders);
      const defaultProvider = providers.find((p) => p.id === savedDefaultProviderId);
      if (defaultProvider) {
        return defaultProvider.projectId || "";
      }
    }
    return "";
  },
  getApiToken: async function () {
    const savedProviders = await getStorageItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await getStorageItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);

    if (savedProviders) {
      const providers = JSON.parse(savedProviders);
      const defaultProvider = providers.find((p) => p.id === savedDefaultProviderId);
      if (defaultProvider) {
        return defaultProvider.apiKey || "";
      }
    }
    return "";
  },
  getAccessToken: async function () {
    return await getStorageItem(STORAGE_KEYS.ACCESS_TOKEN);
  },
  putAccessToken: async function (tk) {
    return await setStorageItem(STORAGE_KEYS.ACCESS_TOKEN, tk);
  },
  getWatsonxUrl: async function () {
    const savedProviders = await getStorageItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await getStorageItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);

    if (savedProviders) {
      const providers = JSON.parse(savedProviders);
      const defaultProvider = providers.find((p) => p.id === savedDefaultProviderId);
      if (defaultProvider?.watsonxUrl) {
        return defaultProvider.watsonxUrl.url;
      }
    }
    return DEFAULT_VALUES.DEFAULT_WATSONX_URL.url;
  },
  getOllamaUrl: async function () {
    const savedProviders = await getStorageItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await getStorageItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);

    if (savedProviders) {
      const providers = JSON.parse(savedProviders);
      const defaultProvider = providers.find((p) => p.id === savedDefaultProviderId);
      if (defaultProvider?.ollamaUrl) {
        return defaultProvider.ollamaUrl;
      }
    }
    return DEFAULT_VALUES.DEFAULT_OLLAMA_URL;
  },
  getEnvironmentVariables: async function () {
    const savedEnvVars = await getStorageItem(STORAGE_KEYS.ENVIRONMENT_VARIABLES);
    if (savedEnvVars) {
      try {
        return JSON.parse(savedEnvVars);
      } catch (error) {
        console.error("Error parsing environment variables:", error);
        return [];
      }
    }
    return [];
  },
  getAccessEndpoint: function () {
    return API_ENDPOINTS.ACCESS_TOKEN;
  },
  getEndpoint: async function () {
    const baseUrl = await this.getWatsonxUrl();
    return `${baseUrl}/ml/v1/text/chat?version=${API_VERSION}`;
  },
  getEmbeddingsEndpoint: async function () {
    const baseUrl = await this.getWatsonxUrl();
    return `${baseUrl}/ml/v1/text/embeddings?version=${API_VERSION}`;
  },
};
