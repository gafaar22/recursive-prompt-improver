import moment from "moment/moment";
import {
  WATSONX_MODELS,
  CHATGPT_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  GROQ_MODELS,
  GROK_MODELS,
  AZURE_MODELS,
  OLLAMA_MODELS,
  LMSTUDIO_MODELS,
  PERPLEXITY_MODELS,
  MISTRAL_MODELS,
  OPENAI_COMPAT_MODELS,
  WATSONX_EMBEDDINGS,
  OPENAI_EMBEDDINGS,
  OLLAMA_EMBEDDINGS,
  LMSTUDIO_EMBEDDINGS,
  PERPLEXITY_EMBEDDINGS,
  AZURE_EMBEDDINGS,
  MISTRAL_EMBEDDINGS,
  OPENAI_COMPAT_EMBEDDINGS,
  API_PROVIDERS,
  DEFAULT_VALUES,
} from "./constants";
import { CORE } from "@core/MAIN";

// Simple hash function for generating string hashes
export const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

// Helper function to check if JSON schema is valid
export const isJsonSchemaValid = (schema) => {
  if (!schema?.trim()?.length) return false;
  try {
    JSON.parse(schema);
    return true;
  } catch (e) {
    return false;
  }
};

// Validate agent name (same rules as tool name)
export const validateAgentName = (name, existingAgents = [], currentAgentId = null) => {
  // Check if name is empty
  if (!name || !name.trim()) {
    return "Agent name is required";
  }

  // Check length: 1 ≤ length ≤ 64
  if (name.length < 1 || name.length > 64) {
    return "Agent name must be between 1 and 64 characters";
  }

  // Check regex: ^[a-zA-Z]+[a-zA-Z0-9-_]*$
  const nameRegex = /^[a-zA-Z]+[a-zA-Z0-9-_]*$/;
  if (!nameRegex.test(name)) {
    return "Agent name must start with a letter and contain only letters, numbers, hyphens, and underscores";
  }

  // Check uniqueness
  const isDuplicate = existingAgents.some(
    (agent) => agent.name === name && agent.id !== currentAgentId
  );
  if (isDuplicate) {
    return "An agent with this name already exists";
  }

  return null;
};

// Form validation function to check if the form is valid for submission
export const isFormValid = (settings, formData) => {
  return (
    settings.providers &&
    settings.providers.length > 0 &&
    formData.instructions.trim() &&
    formData.inOutPairs.some((pair) => pair.in.trim())
  );
};

// Helper function to check if improve mode is disabled
export const isImproveDisabled = (improveMode) => {
  return improveMode === false || improveMode === "false";
};

/**
 * Get paginated data from an array
 * @param {Array} items - The array of items to paginate
 * @param {number} currentPage - Current page number (1-based)
 * @param {number} pageSize - Number of items per page
 * @returns {Array} - Paginated subset of items
 */
export const getPaginatedData = (items, currentPage, pageSize) => {
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return items.slice(startIndex, endIndex);
};

/**
 * Filter items based on a search term
 * @param {Array} items - The array of items to filter
 * @param {string} searchTerm - The search term
 * @param {Function} filterFn - Custom filter function that takes (item, lowercaseTerm) and returns boolean
 * @returns {Array} - Filtered items
 */
export const filterItemsBySearchTerm = (items, searchTerm, filterFn) => {
  if (!searchTerm.trim()) {
    return items;
  }

  const lowercaseTerm = searchTerm.toLowerCase();
  return items.filter((item) => filterFn(item, lowercaseTerm));
};

/**
 * Handle URL hash for search term
 * @param {string} searchTerm - Current search term
 */
export const updateUrlHashFromSearchTerm = (searchTerm) => {
  // Skip hash updates in Electron to avoid routing issues
  if (window.__RPI_ELECTRON__) {
    return;
  }

  if (searchTerm) {
    window.location.hash = `search=${encodeURIComponent(searchTerm)}`;
  } else if (window.location.hash.startsWith("#search=")) {
    window.location.hash = "";
  }
};

/**
 * Get search term from URL hash
 * @returns {string} - Search term from URL hash or empty string
 */
export const getSearchTermFromUrlHash = () => {
  // Skip hash reading in Electron
  if (window.__RPI_ELECTRON__) {
    return "";
  }

  const hash = window.location.hash;
  if (hash && hash.startsWith("#search=")) {
    return decodeURIComponent(hash.substring(8));
  }
  return "";
};

/**
 * Export data as a JSON file
 * @param {Object} data - The data to export
 * @param {string} filename - The filename without extension
 */
export const exportToJsonFile = async (data, filename) => {
  // Create a JSON string
  const jsonData = JSON.stringify(data, null, 2);

  // Check if running in Electron
  if (window.__RPI_ELECTRON__ && window.__RPI_ELECTRON__.saveFile) {
    try {
      // Use Electron's save dialog and file writing
      const result = await window.__RPI_ELECTRON__.saveFile({
        defaultPath: `${filename}.json`,
        filters: [{ name: "JSON Files", extensions: ["json"] }],
        data: jsonData,
      });

      if (result.success) {
        return true; // Success
      } else if (result.canceled) {
        return false; // User canceled
      } else {
        console.error("Error saving file:", result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error in Electron save:", error);
      // Fall back to regular download
    }
  }

  // Regular browser download (fallback or when not in Electron)
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.json`;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true; // Success
};

/**
 * Import data from a JSON file
 * @param {Function} onSuccess - Callback function when import is successful
 * @param {Function} onError - Callback function when import fails
 * @param {Array} requiredFields - Array of field names that must exist in the imported data
 */
export const importFromJsonFile = (onSuccess, onError, requiredFields = []) => {
  // Create file input element
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);

        // Clean up provider settings - convert old format to new multi-provider format
        if (importedData.selectedProvider) {
          // Old format detected - convert to new providers array format
          const availableProvider = API_PROVIDERS.find(
            (p) => p.id === importedData.selectedProvider.id
          );

          if (availableProvider) {
            // Create a provider config from old format
            const provider = {
              id: availableProvider.id,
              name: importedData.selectedProvider.text || availableProvider.text,
              apiKey: importedData.apiKey || "",
              selectedModel: importedData.selectedModel || getAvailableModels(availableProvider)[0],
              selectedEmbeddingModel:
                importedData.selectedEmbeddingModel || getAvailableEmbeddings(availableProvider)[0],
              projectId: importedData.projectId || "",
              watsonxUrl: importedData.watsonxUrl || DEFAULT_VALUES.DEFAULT_WATSONX_URL,
              ollamaUrl: importedData.ollamaUrl || DEFAULT_VALUES.DEFAULT_OLLAMA_URL,
            };

            importedData.providers = [provider];
            importedData.defaultProviderId = provider.id;

            // Clean up old keys
            delete importedData.selectedProvider;
            delete importedData.selectedModel;
            delete importedData.selectedEmbeddingModel;
            delete importedData.apiKey;
            delete importedData.projectId;
            delete importedData.watsonxUrl;
            delete importedData.ollamaUrl;
          } else {
            // If provider not found, create default provider
            const defaultProvider = {
              id: DEFAULT_VALUES.DEFAULT_PROVIDER.id,
              name: DEFAULT_VALUES.DEFAULT_PROVIDER.text,
              apiKey: "",
              selectedModel: DEFAULT_VALUES.DEFAULT_MODEL,
              selectedEmbeddingModel: DEFAULT_VALUES.DEFAULT_EMBEDDING_MODEL,
              projectId: "",
              watsonxUrl: DEFAULT_VALUES.DEFAULT_WATSONX_URL,
              ollamaUrl: DEFAULT_VALUES.DEFAULT_OLLAMA_URL,
            };
            importedData.providers = [defaultProvider];
            importedData.defaultProviderId = defaultProvider.id;
          }
        }

        // Validate imported data has required fields
        const missingFields = requiredFields.filter((field) => !importedData[field]);

        if (missingFields.length > 0) {
          onError("Import Error", `Invalid format. Missing fields: ${missingFields.join(", ")}`);
          return;
        }

        onSuccess(importedData);
      } catch (error) {
        onError("Import Error", "Failed to parse JSON file");
      }
    };

    reader.readAsText(file);
  };

  fileInput.click();
};

/**
 * Truncate text with ellipsis if it exceeds maxLength
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} - Truncated text with ellipsis or original text
 */
export const truncateText = (text, maxLength) => {
  if (!text) {
    return "";
  }
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

/**
 * Format date for display using moment's fromNow
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string (e.g., "2 hours ago")
 */
export const formatDate = (dateString) => {
  return moment(dateString).fromNow();
};

/**
 * Format date for display with full details
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string with full details
 */
export const formatDateFull = (dateString) => {
  const DATE_FORMAT_OPTIONS = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  return new Date(dateString).toLocaleDateString(undefined, DATE_FORMAT_OPTIONS);
};

/**
 * Get available models based on provider
 * @param {Object} provider - The selected provider object
 * @returns {Array} - Array of available models for the provider
 */
export const getAvailableModels = (provider) => {
  // If provider has fetched models, use those
  if (provider?.availableModels && provider.availableModels.length > 0) {
    return provider.availableModels;
  }

  // Otherwise, fall back to hardcoded models
  switch (provider?.id) {
    case "chatgpt":
      return CHATGPT_MODELS;
    case "azure":
      return AZURE_MODELS;
    case "openaicompat":
      return OPENAI_COMPAT_MODELS;
    case "anthropic":
      return ANTHROPIC_MODELS;
    case "gemini":
      return GEMINI_MODELS;
    case "groq":
      return GROQ_MODELS;
    case "grok":
      return GROK_MODELS;
    case "ollama":
      return OLLAMA_MODELS;
    case "lmstudio":
      return LMSTUDIO_MODELS;
    case "perplexity":
      return PERPLEXITY_MODELS;
    case "mistral":
      return MISTRAL_MODELS;
    case "watsonx":
    default:
      return WATSONX_MODELS;
  }
};

/**
 * Get available embedding models based on provider
 * @param {Object} provider - The selected provider object
 * @returns {Array} - Array of available embedding models for the provider
 */
export const getAvailableEmbeddings = (provider) => {
  // If provider has fetched embeddings, use those
  if (provider?.availableEmbeddings && provider.availableEmbeddings.length > 0) {
    return provider.availableEmbeddings;
  }

  // Otherwise, fall back to hardcoded embeddings
  switch (provider?.id) {
    case "ollama":
      return OLLAMA_EMBEDDINGS;
    case "lmstudio":
      return LMSTUDIO_EMBEDDINGS;
    case "watsonx":
      return WATSONX_EMBEDDINGS;
    case "chatgpt":
    case "gemini":
    case "grok":
      return OPENAI_EMBEDDINGS;
    case "azure":
      return AZURE_EMBEDDINGS;
    case "openaicompat":
      return OPENAI_COMPAT_EMBEDDINGS;
    case "mistral":
      return MISTRAL_EMBEDDINGS;
    case "perplexity":
      return PERPLEXITY_EMBEDDINGS;
    default:
      return []; // No embeddings available for other providers
  }
};

/**
 * Get all available models from all configured providers
 * @param {Array} providers - Array of configured provider objects
 * @returns {Array} - Array of models with provider info: { ...model, providerId, providerName }
 */
export const getAllAvailableModels = (providers) => {
  if (!providers || providers.length === 0) {
    return [];
  }

  const allModels = [];
  providers.forEach((provider) => {
    // Pass the actual provider object to getAvailableModels
    // This ensures fetched models are used if available
    const models = getAvailableModels(provider);
    models.forEach((model) => {
      allModels.push({
        ...model,
        providerId: provider.id,
        providerName: provider.name,
        // Create a display text that includes provider name
        text: `${model.text} (${provider.name})`,
        // Keep original model text for reference
        originalText: model.text,
      });
    });
  });

  return allModels;
};

/**
 * Get all available embedding models from all configured providers
 * @param {Array} providers - Array of configured provider objects
 * @returns {Array} - Array of embedding models with provider info
 */
export const getAllAvailableEmbeddings = (providers) => {
  if (!providers || providers.length === 0) {
    return [];
  }

  const allEmbeddings = [];
  providers.forEach((provider) => {
    // Pass the actual provider object to getAvailableEmbeddings
    // This ensures fetched embeddings are used if available
    const embeddings = getAvailableEmbeddings(provider);
    embeddings.forEach((embedding) => {
      allEmbeddings.push({
        ...embedding,
        providerId: provider.id,
        providerName: provider.name,
        // Create a display text that includes provider name
        text: `${embedding.text} (${provider.name})`,
        // Keep original embedding text for reference
        originalText: embedding.text,
      });
    });
  });

  return allEmbeddings;
};

/**
 * Fetches and updates models and embeddings for a single provider
 * @param {Object} provider - The provider configuration object
 * @returns {Promise<Object>} Updated provider with fetched models or original on error
 */
export const fetchAndUpdateProviderModels = async (provider) => {
  try {
    const models = await CORE.fetchAvailableModels(provider.id, provider);
    const embeddings = await CORE.fetchAvailableEmbeddings(provider.id, provider);

    return {
      ...provider,
      availableModels: models,
      availableEmbeddings: embeddings,
      // Preserve selected models if they still exist, otherwise default to first
      selectedModel:
        models.length > 0
          ? models.find((m) => m.id === provider.selectedModel?.id) || models[0]
          : provider.selectedModel,
      selectedEmbeddingModel:
        embeddings.length > 0
          ? embeddings.find((e) => e.id === provider.selectedEmbeddingModel?.id) || embeddings[0]
          : provider.selectedEmbeddingModel,
    };
  } catch (error) {
    console.error(`Failed to fetch models for provider ${provider.name}:`, error);
    throw error;
  }
};

/**
 * Fetches and updates models for multiple providers
 * @param {Array} providers - Array of provider configuration objects
 * @returns {Promise<Object>} Object with updatedProviders array, successCount, and failCount
 */
export const fetchAndUpdateAllProviderModels = async (providers) => {
  const updatedProviders = [];
  let successCount = 0;
  let failCount = 0;

  for (const provider of providers) {
    try {
      const updatedProvider = await fetchAndUpdateProviderModels(provider);
      updatedProviders.push(updatedProvider);
      successCount++;
    } catch (error) {
      // Keep provider as-is if fetch fails
      updatedProviders.push(provider);
      failCount++;
    }
  }

  return { updatedProviders, successCount, failCount };
};

/**
 * Convert agents to tool format for API calls
 * Agents are represented as simple tools with natural language input
 * @param {Array} agents - Array of agent objects
 * @param {string} currentAgentId - ID of current agent (to exclude self-reference)
 * @returns {Array} Array of tool-formatted agent objects
 */
export const convertAgentsToTools = (agents, currentAgentId = null) => {
  return agents
    .filter((agent) => agent.id !== currentAgentId) // Exclude current agent
    .map((agent) => ({
      ...agent,
      isAgent: true, // Flag to identify as agent
      name: agent.name,
      description: `(Agent) ${agent.description || agent.instructions}`,
      parameters: {
        type: "object",
        properties: {
          request: {
            description: `Input for ${agent.name}. The tool is described as: ${
              agent.description || agent.instructions
            }.
              You may provide:
              - A natural-language string
              - A structured JSON object with any fields
              - An array of values

              Choose whichever format seems most appropriate for the tool’s intended behavior.`,
            type: "string",
            // oneOf: [
            //   {
            //     type: "string",
            //     description: "Natural language command or free-form text input.",
            //   },
            //   {
            //     type: "object",
            //     description: "Structured input with arbitrary fields relevant to the tool.",
            //     additionalProperties: true,
            //   },
            //   {
            //     type: "array",
            //     description: "List-based input when the tool expects multiple items.",
            //     items: {},
            //   },
            // ],
          },
        },
        required: ["request"],
      },
      // Keep original agent data for execution
      type: "function",
    }));
};

/**
 * Combine tools and agents for MultiSelect display
 * Agents have "(Agent)" suffix in their name
 * @param {Array} tools - Array of tool objects
 * @param {Array} agents - Array of agent objects
 * @param {string} currentAgentId - ID of current agent (to exclude self-reference)
 * @returns {Array} Combined array with proper formatting
 */
export const combineToolsAndAgents = (tools, agents, currentAgentId = null) => {
  const formattedAgents = convertAgentsToTools(agents, currentAgentId);
  return [...tools, ...formattedAgents];
};
