/*************** AI API Bridge **************/

import { STORAGE } from "./STORAGE";
import { STORAGE_KEYS } from "@utils/constants";
import { getStorageItem } from "@utils/storageUtils";

// Get provider configuration from storage by providerId
const getProviderConfig = async (providerId) => {
  const savedProviders = await getStorageItem(STORAGE_KEYS.PROVIDERS);
  if (!savedProviders) {
    throw new Error("No providers configured");
  }
  const providers = JSON.parse(savedProviders);
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }
  return provider;
};

// Get provider API by provider ID (for fetching models)
const getProviderAPIById = async (providerId) => {
  switch (providerId) {
    case "ollama":
      const { AI_API: OllamaAPI } = await import("@api/API.Ollama");
      return OllamaAPI;
    case "lmstudio":
      const { AI_API: LMStudioAPI } = await import("@api/API.LMStudio");
      return LMStudioAPI;
    case "chatgpt":
      const { AI_API: ChatGPTAPI } = await import("@api/API.ChatGPT");
      return ChatGPTAPI;
    case "azure":
      const { AI_API: AzureAPI } = await import("@api/API.Azure");
      return AzureAPI;
    case "openaicompat":
      const { AI_API: OpenAICompatAPI } = await import("@api/API.OpenAICompat");
      return OpenAICompatAPI;
    case "anthropic":
      const { AI_API: AnthropicAPI } = await import("@api/API.Anthropic");
      return AnthropicAPI;
    case "gemini":
      const { AI_API: GeminiAPI } = await import("@api/API.Gemini");
      return GeminiAPI;
    case "groq":
      const { AI_API: GroqAPI } = await import("@api/API.Groq");
      return GroqAPI;
    case "grok":
      const { AI_API: GrokAPI } = await import("@api/API.Grok");
      return GrokAPI;
    case "perplexity":
      const { AI_API: PerplexityAPI } = await import("@api/API.Perplexity");
      return PerplexityAPI;
    case "huggingface":
      const { AI_API: HuggingFaceAPI } = await import("@api/API.HuggingFace");
      return HuggingFaceAPI;
    case "mistral":
      const { AI_API: MistralAPI } = await import("@api/API.Mistral");
      return MistralAPI;
    case "watsonx":
    default:
      const { AI_API: WatsonxAPI } = await import("@api/API.Watsonx");
      return WatsonxAPI;
  }
};

// API Bridge that routes to the correct provider implementation
export const AI_API = {
  embeddingsGet: async function (inputs, modelId, abortSignal, providerId) {
    // Get providerId (use provided or default from storage)
    const targetProviderId = providerId || (await STORAGE.getProviderId());
    // Get provider API implementation
    const provider = await getProviderAPIById(targetProviderId);
    // Get provider configuration from storage
    const providerConfig = await getProviderConfig(targetProviderId);
    // If no modelId provided, use the provider's selected embedding model ID
    const effectiveModelId = modelId || providerConfig.selectedEmbeddingModel?.id;
    // login API
    const accessToken = await provider.generateAccessToken(providerConfig);
    // Prepare provider-specific parameters
    // Extract URL string from watsonxUrl object if it exists
    const watsonxUrlString = providerConfig.watsonxUrl?.url || providerConfig.watsonxUrl;
    const providerParams = {
      apiKey: providerConfig.apiKey,
      projectId: providerConfig.projectId,
      watsonxUrl: watsonxUrlString,
      ollamaUrl: providerConfig.ollamaUrl,
      lmstudioUrl: providerConfig.lmstudioUrl,
      openaiCompatUrl: providerConfig.openaiCompatUrl,
      azureEndpoint: providerConfig.azureEndpoint,
      azureApiVersion: providerConfig.azureApiVersion,
      accessToken: accessToken,
    };
    return await provider.embeddingsGet(inputs, effectiveModelId, abortSignal, providerParams);
  },
  oneShotPrompt: async function (systemPrompt, prompt, modelId, options = {}) {
    // Get providerId (use provided or default from storage)
    const targetProviderId = options.providerId || (await STORAGE.getProviderId());
    // Get provider API implementation
    const provider = await getProviderAPIById(targetProviderId);
    // Get provider configuration from storage
    const providerConfig = await getProviderConfig(targetProviderId);
    // If no modelId provided, use the provider's selected model ID
    const effectiveModelId = modelId || providerConfig.selectedModel?.id;
    // Get global settings from storage
    const maxTokens = await STORAGE.getMaxTokens();
    const temperature = await STORAGE.getTemperature();
    const timeLimit = await STORAGE.getTimeLimit();
    // login API
    const accessToken = await provider.generateAccessToken(providerConfig);
    // Prepare provider-specific parameters
    // Extract URL string from watsonxUrl object if it exists
    const watsonxUrlString = providerConfig.watsonxUrl?.url || providerConfig.watsonxUrl;
    const providerParams = {
      apiKey: providerConfig.apiKey,
      projectId: providerConfig.projectId,
      watsonxUrl: watsonxUrlString,
      ollamaUrl: providerConfig.ollamaUrl,
      lmstudioUrl: providerConfig.lmstudioUrl,
      openaiCompatUrl: providerConfig.openaiCompatUrl,
      azureEndpoint: providerConfig.azureEndpoint,
      azureApiVersion: providerConfig.azureApiVersion,
      maxTokens: maxTokens,
      temperature: temperature,
      timeLimit: timeLimit,
      accessToken: accessToken,
    };

    // Debug logging for tools passed to API
    if (options.tools?.length > 0) {
      console.log("[API.oneShotPrompt] Tools being sent to provider:", {
        provider: targetProviderId,
        toolCount: options.tools.length,
        tools: options.tools.map((t) => ({
          name: t.name,
          isAgent: t.isAgent,
          isMCP: t.isMCP,
          hasParameters: !!t.parameters,
          parametersType: typeof t.parameters,
          parameters: t.parameters,
        })),
      });
    }

    return await provider.oneShotPrompt(systemPrompt, prompt, effectiveModelId, {
      ...options,
      providerParams,
    });
  },
  fetchModels: async function (providerId, providerConfig, embeddings = false) {
    const provider = await getProviderAPIById(providerId);
    const fetchFn = embeddings ? provider.fetchAvailableEmbeddings : provider.fetchAvailableModels;
    // Prepare parameters based on provider type
    switch (providerId) {
      case "chatgpt":
      case "groq":
      case "grok":
      case "anthropic":
      case "gemini":
      case "huggingface":
      case "mistral":
      case "perplexity":
        return await fetchFn.call(provider, providerConfig.apiKey);
      case "ollama":
        return await fetchFn.call(provider, providerConfig.ollamaUrl || "http://localhost:11434");
      case "lmstudio":
        return await fetchFn.call(
          provider,
          providerConfig.lmstudioUrl || "http://localhost:1234/v1"
        );
      case "azure":
        return await fetchFn.call(
          provider,
          providerConfig.apiKey,
          providerConfig.azureEndpoint,
          providerConfig.azureApiVersion || "2024-02-15-preview"
        );
      case "openaicompat":
        return await fetchFn.call(
          provider,
          providerConfig.apiKey,
          providerConfig.openaiCompatUrl || "http://localhost:8080/v1"
        );
      case "watsonx":
        // login API - pass providerConfig so we don't read from storage
        const accessToken = await provider.generateAccessToken(providerConfig);
        return await fetchFn.call(provider, accessToken, providerConfig.watsonxUrl.url);
      default:
        return [];
    }
  },
  fetchAvailableModels: async function (providerId, providerConfig) {
    return this.fetchModels(providerId, providerConfig);
  },
  fetchAvailableEmbeddings: async function (providerId, providerConfig) {
    return this.fetchModels(providerId, providerConfig, true);
  },
};
