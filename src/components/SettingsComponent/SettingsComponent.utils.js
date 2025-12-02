/**
 * Utility functions for SettingsComponent
 */

import React from "react";
import { truncateText } from "@utils/uiUtils";

// Import provider icons as React components from local assets
import { ReactComponent as IbmIcon } from "@assets/icons/ibm.svg";
import { ReactComponent as OllamaIcon } from "@assets/icons/ollama.svg";
import { ReactComponent as LmstudioIcon } from "@assets/icons/lmstudio.svg";
import { ReactComponent as OpenaiIcon } from "@assets/icons/openai.svg";
import { ReactComponent as OpenaiTextIcon } from "@assets/icons/openai-text.svg";
import { ReactComponent as AzureIcon } from "@assets/icons/azure-color.svg";
import { ReactComponent as AnthropicIcon } from "@assets/icons/anthropic.svg";
import { ReactComponent as GeminiIcon } from "@assets/icons/gemini-color.svg";
import { ReactComponent as GroqIcon } from "@assets/icons/groq.svg";
import { ReactComponent as GrokIcon } from "@assets/icons/grok.svg";
import { ReactComponent as PerplexityIcon } from "@assets/icons/perplexity-color.svg";
import { ReactComponent as HuggingfaceIcon } from "@assets/icons/huggingface-color.svg";
import { ReactComponent as MistralIcon } from "@assets/icons/mistral-color.svg";

/**
 * Map provider IDs to their corresponding icon components
 */
const PROVIDER_ICONS = {
  watsonx: IbmIcon,
  ollama: OllamaIcon,
  lmstudio: LmstudioIcon,
  chatgpt: OpenaiIcon,
  azure: AzureIcon,
  openaicompat: OpenaiTextIcon,
  anthropic: AnthropicIcon,
  gemini: GeminiIcon,
  groq: GroqIcon,
  grok: GrokIcon,
  perplexity: PerplexityIcon,
  huggingface: HuggingfaceIcon,
  mistral: MistralIcon,
};

/**
 * Get the icon component for a provider
 * @param {string} providerId - The provider ID
 * @returns {React.ComponentType|null} - The icon component or null if not available
 */
export const getProviderIcon = (providerId) => {
  return PROVIDER_ICONS[providerId] || null;
};

/**
 * Provider icon component - renders SVG directly as React component
 */
export const ProviderIcon = ({ providerId, size = 20, className = "" }) => {
  const IconComponent = getProviderIcon(providerId);
  const providerClass = `provider-icon--${providerId}`;

  if (!IconComponent) return null;

  return (
    <span
      className={`provider-icon ${providerClass} ${className}`}
      style={{ width: size, height: size, display: "inline-flex" }}
    >
      <IconComponent width={size} height={size} />
    </span>
  );
};

/**
 * Validate environment variable key (must be valid identifier like .env files)
 * @param {string} key - The key to validate
 * @param {number|null} currentIndex - The index of the current variable being edited (null for new)
 * @param {Array} environmentVariables - Array of existing environment variables
 * @returns {string} - Error message or empty string if valid
 */
export const validateEnvVarKey = (key, currentIndex = null, environmentVariables = []) => {
  if (!key || !key.trim()) {
    return "Key is required";
  }
  // Check for valid identifier format (alphanumeric and underscore, must start with letter or underscore)
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return "Key must be a valid identifier (letters, numbers, underscores; must start with letter or underscore)";
  }
  // Check for uniqueness
  const existingIndex = environmentVariables?.findIndex((v) => v.key === key);
  if (existingIndex !== -1 && existingIndex !== currentIndex) {
    return "Key must be unique";
  }
  return "";
};

/**
 * Prepare provider rows data for DataTable
 * @param {Array} providers - Array of provider objects
 * @param {string} defaultProviderId - The ID of the default provider
 * @param {Array} apiProviders - Array of available API providers
 * @returns {Array} - Array of row objects for DataTable
 */
export const prepareProviderRows = (providers, defaultProviderId, apiProviders) => {
  return (
    providers?.map((provider, index) => {
      return {
        id: `${provider.id}-${provider.name}-${index}`,
        provider: (
          <span className="provider-type-cell">
            <ProviderIcon providerId={provider.id} size={18} />
            {provider.name}
          </span>
        ),
        model: (
          <span title={provider.selectedModel?.text}>
            {truncateText(provider.selectedModel?.text || "N/A", 20)}
          </span>
        ),
        embedding: (
          <span title={provider.selectedEmbeddingModel?.text}>
            {truncateText(provider.selectedEmbeddingModel?.text || "N/A", 20)}
          </span>
        ),
        isDefault: provider.id === defaultProviderId,
        providerData: provider,
      };
    }) || []
  );
};

/**
 * Provider table headers configuration
 */
export const PROVIDER_TABLE_HEADERS = [
  { key: "provider", header: "Name" },
  { key: "model", header: "Default Model" },
  { key: "embedding", header: "Default Embedding" },
  { key: "isDefault", header: "Default" },
  { key: "actions", header: "Actions" },
  { key: "providerData", header: "" }, // Hidden column for data access
];
