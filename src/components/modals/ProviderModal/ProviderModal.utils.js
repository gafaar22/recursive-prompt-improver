// Validate that provider name is not empty
export const validateProviderName = (name) => {
  if (!name || !name.trim()) {
    return "Provider name cannot be empty.";
  }
  return null;
};

// Check if provider name is unique (excluding the current provider being edited)
export const isDuplicateProviderName = (providers, newName, editingProvider) => {
  return providers.some((p) => {
    // If editing, skip the provider being edited
    if (
      editingProvider &&
      p.id === editingProvider.id &&
      p.name === editingProvider.name &&
      p.apiKey === editingProvider.apiKey
    ) {
      return false;
    }
    // Check if name matches (case-insensitive)
    return p.name.trim().toLowerCase() === newName.trim().toLowerCase();
  });
};

// Get initial provider form data for adding a new provider
export const getInitialProviderFormData = (
  defaultProvider,
  availableModels,
  availableEmbeddings,
  DEFAULT_VALUES
) => {
  return {
    id: defaultProvider.id,
    name: defaultProvider.text,
    apiKey: "",
    selectedModel: availableModels[0],
    selectedEmbeddingModel: availableEmbeddings[0] || null,
    projectId: "",
    watsonxUrl: DEFAULT_VALUES.DEFAULT_WATSONX_URL,
    ollamaUrl: DEFAULT_VALUES.DEFAULT_OLLAMA_URL,
    openaiCompatUrl: DEFAULT_VALUES.DEFAULT_OPENAI_COMPAT_URL,
    azureEndpoint: "",
    azureApiVersion: DEFAULT_VALUES.DEFAULT_AZURE_API_VERSION,
    availableModels: null,
    availableEmbeddings: null,
  };
};

// Update providers array when saving
export const updateProvidersArray = (currentProviders, providerFormData, editingProvider) => {
  if (editingProvider) {
    // Update existing provider - match by all unique fields
    return currentProviders.map((p) =>
      p.id === editingProvider.id &&
      p.name === editingProvider.name &&
      p.apiKey === editingProvider.apiKey
        ? providerFormData
        : p
    );
  } else {
    // Add new provider
    return [...currentProviders, providerFormData];
  }
};

// Check if provider configuration is valid for saving
export const isProviderValid = (providerFormData, providers, editingProvider) => {
  // Must have a valid name
  if (validateProviderName(providerFormData?.name)) {
    return false;
  }

  // Must not be a duplicate name
  if (isDuplicateProviderName(providers, providerFormData?.name, editingProvider)) {
    return false;
  }

  // Must have fetched models (availableModels array with at least one model)
  if (!providerFormData?.availableModels?.length) {
    return false;
  }

  // Provider-specific validations
  const providerId = providerFormData?.id;

  // Watsonx requires API key and project ID
  if (providerId === "watsonx") {
    if (!providerFormData?.apiKey?.trim() || !providerFormData?.projectId?.trim()) {
      return false;
    }
  }

  // Azure requires API key and endpoint
  if (providerId === "azure") {
    if (!providerFormData?.apiKey?.trim() || !providerFormData?.azureEndpoint?.trim()) {
      return false;
    }
  }

  // Cloud providers (not local) require API key
  const localProviders = ["ollama", "lmstudio", "openaicompat"];
  if (!localProviders.includes(providerId)) {
    if (!providerFormData?.apiKey?.trim()) {
      return false;
    }
  }

  return true;
};
