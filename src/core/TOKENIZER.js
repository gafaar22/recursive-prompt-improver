/*************** Token Counter Utility **************/

import { getEncoding } from "js-tiktoken";
import { AutoTokenizer } from "@xenova/transformers";

// Cache for tokenizer instances to avoid re-initialization
const tokenizerCache = {
  tiktoken: {},
  transformers: {},
};

// Average characters per token for estimation (common approximation for English text)
const CHARS_PER_TOKEN_ESTIMATE = 4;

// Provider to tokenizer type mapping
const PROVIDER_TOKENIZER_MAP = {
  chatgpt: "tiktoken", // OpenAI uses tiktoken
  anthropic: "tiktoken", // Anthropic uses similar BPE tokenization
  gemini: "tiktoken", // Gemini uses similar BPE tokenization (approximate)
  groq: "tiktoken", // Groq hosts various models, default to tiktoken
  mistral: "tiktoken", // Mistral uses tiktoken-compatible tokenization
  watsonx: "transformers", // WatsonX uses various models (Granite, LLaMA, Mistral)
  huggingface: "transformers", // HuggingFace models use transformers tokenizers
  ollama: "transformers", // Ollama hosts various models (LLaMA, Mistral, etc.)
};

// Model ID patterns to HuggingFace tokenizer mapping for transformers
// Uses patterns that match both hyphenated and non-hyphenated variants
const MODEL_TOKENIZER_MAP = {
  // LLaMA models (pattern matches llama-3, llama3, llama-2, llama2, etc.)
  llama: "Xenova/llama-3-tokenizer",
  // Mistral models
  mistral: "Xenova/mistral-tokenizer-v1",
  mixtral: "Xenova/mistral-tokenizer-v1",
  // Granite models (IBM) - uses LLaMA-based tokenizer
  granite: "Xenova/llama-3-tokenizer",
  // Phi models
  phi: "Xenova/phi-2-tokenizer",
  // Qwen models
  qwen: "Xenova/qwen-tokenizer",
  // Default fallback
  default: "Xenova/llama-3-tokenizer",
};

// OpenAI model to tiktoken encoding mapping
const OPENAI_ENCODING_MAP = {
  "gpt-4": "cl100k_base",
  "gpt-4o": "o200k_base",
  "gpt-4-turbo": "cl100k_base",
  "gpt-3.5-turbo": "cl100k_base",
  "gpt-3.5": "cl100k_base",
  "text-embedding-3": "cl100k_base",
  "text-embedding-ada": "cl100k_base",
  // Default for newer models
  default: "o200k_base",
};

/**
 * Get tiktoken encoder for a specific model or encoding
 * @param {string} modelId - Model ID
 * @returns {Object} Tiktoken encoder instance
 */
function getTiktokenEncoder(modelId) {
  // Try to get encoding for specific model
  let encoding = OPENAI_ENCODING_MAP.default;

  // Check for model-specific encoding
  for (const [key, enc] of Object.entries(OPENAI_ENCODING_MAP)) {
    if (key !== "default" && modelId?.toLowerCase().includes(key)) {
      encoding = enc;
      break;
    }
  }

  // Cache the encoder
  if (!tokenizerCache.tiktoken[encoding]) {
    tokenizerCache.tiktoken[encoding] = getEncoding(encoding);
  }

  return tokenizerCache.tiktoken[encoding];
}

/**
 * Get the HuggingFace tokenizer model ID for a given model
 * @param {string} modelId - Model ID
 * @returns {string} HuggingFace tokenizer model ID
 */
function getTransformerTokenizerModel(modelId) {
  const lowerModelId = modelId?.toLowerCase() || "";

  for (const [key, tokenizerId] of Object.entries(MODEL_TOKENIZER_MAP)) {
    if (key !== "default" && lowerModelId.includes(key)) {
      return tokenizerId;
    }
  }

  return MODEL_TOKENIZER_MAP.default;
}

/**
 * Get transformers tokenizer for a specific model
 * @param {string} modelId - Model ID
 * @returns {Promise<Object>} Transformers tokenizer instance
 */
async function getTransformersTokenizer(modelId) {
  const tokenizerModel = getTransformerTokenizerModel(modelId);

  // Cache the tokenizer
  if (!tokenizerCache.transformers[tokenizerModel]) {
    try {
      tokenizerCache.transformers[tokenizerModel] =
        await AutoTokenizer.from_pretrained(tokenizerModel);
    } catch (_error) {
      // Fallback to default tokenizer when specific tokenizer fails to load
      if (!tokenizerCache.transformers[MODEL_TOKENIZER_MAP.default]) {
        tokenizerCache.transformers[MODEL_TOKENIZER_MAP.default] =
          await AutoTokenizer.from_pretrained(MODEL_TOKENIZER_MAP.default);
      }
      return tokenizerCache.transformers[MODEL_TOKENIZER_MAP.default];
    }
  }

  return tokenizerCache.transformers[tokenizerModel];
}

/**
 * Count tokens in text using tiktoken
 * @param {string} text - Text to count tokens for
 * @param {string} modelId - Model ID
 * @returns {number} Token count
 */
function countTokensTiktoken(text, modelId) {
  const encoder = getTiktokenEncoder(modelId);
  const tokens = encoder.encode(text);
  return tokens.length;
}

/**
 * Count tokens in text using transformers tokenizer
 * @param {string} text - Text to count tokens for
 * @param {string} modelId - Model ID
 * @returns {Promise<number>} Token count
 */
async function countTokensTransformers(text, modelId) {
  const tokenizer = await getTransformersTokenizer(modelId);
  const tokens = tokenizer.encode(text);
  return tokens.length;
}

/**
 * Convert messages array to text for token counting
 * Uses a simplified ChatML-style format for role tokens approximation.
 * Note: This is an approximation since actual special token handling varies by provider.
 * @param {Array} messages - Array of message objects
 * @returns {string} Combined text from messages
 */
function messagesToText(messages) {
  if (!Array.isArray(messages)) {
    return String(messages || "");
  }

  return messages
    .map((msg) => {
      // Handle different message formats
      const role = msg.role || "";
      const content = msg.content || msg.message || "";

      // Include role in token count using ChatML-style format for approximation
      // Actual special token handling varies by provider, but this gives a reasonable estimate
      if (role) {
        return `<|${role}|>\n${content}`;
      }
      return content;
    })
    .join("\n");
}

/**
 * Count tokens for text or messages array
 * @param {string|Array} input - Text string or messages array
 * @param {Object} options - Options object
 * @param {string} options.providerId - Provider ID (chatgpt, anthropic, ollama, etc.)
 * @param {string} options.modelId - Model ID for more accurate tokenization
 * @returns {Promise<Object>} Token count result with count and provider info
 */
async function countTokens(input, options = {}) {
  const { providerId, modelId } = options;

  // Convert messages to text if necessary
  const text = Array.isArray(input) ? messagesToText(input) : String(input || "");

  if (!text) {
    return {
      tokenCount: 0,
      providerId: providerId || "unknown",
      modelId: modelId || "unknown",
      tokenizerType: "none",
    };
  }

  // Determine tokenizer type based on provider
  const tokenizerType = PROVIDER_TOKENIZER_MAP[providerId] || "tiktoken";

  let tokenCount;
  let actualTokenizerType = tokenizerType;

  try {
    if (tokenizerType === "tiktoken") {
      tokenCount = countTokensTiktoken(text, modelId);
    } else {
      tokenCount = await countTokensTransformers(text, modelId);
    }
  } catch (error) {
    // Fallback to estimation when tokenizer fails - estimation is returned to caller
    tokenCount = Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
    actualTokenizerType = "estimation";
  }

  return {
    tokenCount,
    providerId: providerId || "unknown",
    modelId: modelId || "unknown",
    tokenizerType: actualTokenizerType,
  };
}

/**
 * Count tokens for multiple providers at once
 * Useful for comparing token counts across different providers
 * @param {string|Array} input - Text string or messages array
 * @param {Array<string>} providerIds - Array of provider IDs to count tokens for
 * @param {string} modelId - Optional model ID for more accurate tokenization
 * @returns {Promise<Object>} Object with token counts per provider
 */
async function countTokensMultiProvider(input, providerIds = [], modelId = null) {
  const results = {};

  // If no providers specified, use all known providers
  const providers = providerIds.length > 0 ? providerIds : Object.keys(PROVIDER_TOKENIZER_MAP);

  // Count tokens for each provider
  const promises = providers.map(async (providerId) => {
    const result = await countTokens(input, { providerId, modelId });
    results[providerId] = result;
  });

  await Promise.all(promises);

  return results;
}

/**
 * Estimate token count for cost calculation
 * Simple estimation based on character count
 * @param {string|Array} input - Text string or messages array
 * @returns {number} Estimated token count
 */
function estimateTokenCount(input) {
  const text = Array.isArray(input) ? messagesToText(input) : String(input || "");
  // Use the defined constant for character-to-token ratio estimation
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Count tokens across all providers and return the average
 * Useful for getting a balanced token estimate across different tokenization systems
 * @param {string|Array} input - Text string or messages array
 * @param {Array<string>} providerIds - Optional array of provider IDs (defaults to all providers)
 * @param {string} modelId - Optional model ID for more accurate tokenization
 * @returns {Promise<Object>} Object with average token count and per-provider details
 */
async function countTokensAverage(input, providerIds = [], modelId = null) {
  const multiProviderResults = await countTokensMultiProvider(input, providerIds, modelId);

  const providerCounts = Object.entries(multiProviderResults);
  const totalTokens = providerCounts.reduce((sum, [, result]) => sum + result.tokenCount, 0);
  const averageTokenCount =
    providerCounts.length > 0 ? Math.round(totalTokens / providerCounts.length) : 0;

  return {
    averageTokenCount,
    providerCount: providerCounts.length,
    totalTokens,
    providers: multiProviderResults,
  };
}

export const TOKENIZER = {
  countTokens,
  countTokensMultiProvider,
  countTokensAverage,
  estimateTokenCount,
  messagesToText,
  // Expose internal functions for advanced usage
  getTiktokenEncoder,
  getTransformersTokenizer,
  countTokensTiktoken,
  countTokensTransformers,
  // Constants for external reference
  PROVIDER_TOKENIZER_MAP,
  MODEL_TOKENIZER_MAP,
  OPENAI_ENCODING_MAP,
  CHARS_PER_TOKEN_ESTIMATE,
};
