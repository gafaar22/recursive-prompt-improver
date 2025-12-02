/**
 * RAG.js - Retrieval-Augmented Generation Utilities
 *
 * This module provides utilities for:
 * - Document chunking (splitting documents into overlapping chunks)
 * - Embedding generation and storage
 * - Vector similarity search for retrieval
 *
 * Flow:
 * - Indexing: Document → Chunks → Embeddings → Vector Storage
 * - Retrieval: Query → Embedding → Similarity Search → Context for LLM
 */

import { AI_API } from "@core/API";
import { CORE } from "@core/MAIN";
import { loadKnowledgeBases, saveKnowledgeBases } from "@utils/storageUtils";

/**
 * Default configuration for chunking
 */
const DEFAULT_CHUNK_CONFIG = {
  chunkSize: 500, // Characters per chunk
  chunkOverlap: 100, // Overlap between chunks for context continuity
  separator: "\n\n", // Primary separator for splitting
  fallbackSeparators: ["\n", ". ", " "], // Fallback separators
};

// RAG configuration constants for chat context
const RAG_CONFIG = {
  TOP_K: 5,
  MIN_SIMILARITY: 0.3,
};

/**
 * Split text into chunks with overlap
 * @param {string} text - The text to chunk
 * @param {Object} config - Chunking configuration
 * @returns {Array<{text: string, index: number, start: number, end: number}>} - Array of chunks with metadata
 */
export const chunkText = (text, config = {}) => {
  const { chunkSize, chunkOverlap, separator, fallbackSeparators } = {
    ...DEFAULT_CHUNK_CONFIG,
    ...config,
  };

  if (!text || text.length === 0) {
    return [];
  }

  // If text is smaller than chunk size, return as single chunk
  if (text.length <= chunkSize) {
    return [{ text: text.trim(), index: 0, start: 0, end: text.length }];
  }

  const chunks = [];
  let currentPosition = 0;
  let chunkIndex = 0;

  while (currentPosition < text.length) {
    // Calculate end position for this chunk
    let endPosition = Math.min(currentPosition + chunkSize, text.length);

    // If we're not at the end, try to find a good break point
    if (endPosition < text.length) {
      let bestBreak = -1;

      // Try each separator in order of preference
      const allSeparators = [separator, ...fallbackSeparators];
      for (const sep of allSeparators) {
        // Look for separator within the chunk, preferring later positions
        const searchStart = currentPosition + Math.floor(chunkSize * 0.5);
        const searchText = text.substring(searchStart, endPosition);
        const sepIndex = searchText.lastIndexOf(sep);

        if (sepIndex !== -1) {
          bestBreak = searchStart + sepIndex + sep.length;
          break;
        }
      }

      // Use the best break point if found
      if (bestBreak > currentPosition) {
        endPosition = bestBreak;
      }
    }

    // Extract and add the chunk
    const chunkText = text.substring(currentPosition, endPosition).trim();
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        start: currentPosition,
        end: endPosition,
      });
      chunkIndex++;
    }

    // Move to next position with overlap
    currentPosition = endPosition - chunkOverlap;

    // Ensure we make progress
    if (currentPosition <= chunks[chunks.length - 1]?.start) {
      currentPosition = endPosition;
    }
  }

  return chunks;
};

/**
 * Chunk a document (file) into smaller pieces
 * @param {Object} file - File object with name and content
 * @param {Object} config - Chunking configuration
 * @returns {Array<Object>} - Array of chunk objects with file metadata
 */
export const chunkDocument = (file, config = {}) => {
  const chunks = chunkText(file.content, config);

  return chunks.map((chunk) => ({
    ...chunk,
    fileId: file.id,
    fileName: file.name,
  }));
};

/**
 * Chunk all files in a knowledge base
 * @param {Object} knowledgeBase - Knowledge base object with files array
 * @param {Object} config - Chunking configuration
 * @returns {Array<Object>} - Array of all chunks from all files
 */
export const chunkKnowledgeBase = (knowledgeBase, config = {}) => {
  if (!knowledgeBase?.files || knowledgeBase.files.length === 0) {
    return [];
  }

  const allChunks = [];
  for (const file of knowledgeBase.files) {
    const fileChunks = chunkDocument(file, config);
    allChunks.push(...fileChunks);
  }

  return allChunks;
};

/**
 * Generate embeddings for an array of texts
 * @param {Array<string>} texts - Array of text strings to embed
 * @param {string} modelId - Embedding model ID
 * @param {string} providerId - Provider ID
 * @param {AbortSignal} abortSignal - Optional abort signal
 * @param {Function} onProgress - Optional progress callback (current, total)
 * @returns {Array<Array<number>>} - Array of embedding vectors
 */
export const generateEmbeddings = async (
  texts,
  modelId,
  providerId,
  abortSignal = null,
  onProgress = null
) => {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Batch size for embedding requests (to avoid API limits)
  const BATCH_SIZE = 20;
  const embeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await AI_API.embeddingsGet(batch, modelId, abortSignal, providerId);
      // API returns { results: [{ embedding: [...] }, ...] }
      const batchEmbeddings = response.results.map((r) => r.embedding);
      embeddings.push(...batchEmbeddings);

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, texts.length), texts.length);
      }
    } catch (error) {
      console.error(`Error generating embeddings for batch ${i / BATCH_SIZE}:`, error);
      throw error;
    }
  }

  return embeddings;
};

/**
 * Index a knowledge base - chunk documents and generate embeddings
 * @param {Object} knowledgeBase - Knowledge base to index
 * @param {string} modelId - Embedding model ID
 * @param {string} providerId - Provider ID
 * @param {Object} options - Options including abortSignal, onProgress, chunkConfig
 * @returns {Object} - Indexed data with chunks and embeddings
 */
export const indexKnowledgeBase = async (knowledgeBase, modelId, providerId, options = {}) => {
  const { abortSignal = null, onProgress = null, chunkConfig = {} } = options;

  // Step 1: Chunk all documents
  if (onProgress) onProgress("chunking", 0, 1);
  const chunks = chunkKnowledgeBase(knowledgeBase, chunkConfig);

  if (chunks.length === 0) {
    return { chunks: [], embeddings: [], knowledgeBaseId: knowledgeBase.id };
  }

  // Step 2: Generate embeddings for all chunks
  const texts = chunks.map((c) => c.text);
  const embeddings = await generateEmbeddings(
    texts,
    modelId,
    providerId,
    abortSignal,
    (current, total) => {
      if (onProgress) onProgress("embedding", current, total);
    }
  );

  return {
    knowledgeBaseId: knowledgeBase.id,
    knowledgeBaseName: knowledgeBase.name,
    chunks,
    embeddings,
    indexedAt: Date.now(),
    modelId,
    providerId,
  };
};

/**
 * Store indexed data (chunks + embeddings) in the knowledge base
 * @param {number} knowledgeBaseId - Knowledge base ID
 * @param {Object} indexedData - Indexed data with chunks and embeddings
 * @returns {boolean} - Success status
 */
export const storeVectors = async (knowledgeBaseId, indexedData) => {
  try {
    const knowledgeBases = await loadKnowledgeBases();
    const index = knowledgeBases.findIndex((kb) => kb.id === knowledgeBaseId);

    if (index === -1) {
      console.error("Knowledge base not found:", knowledgeBaseId);
      return false;
    }

    // Store vectors directly in the knowledge base object
    knowledgeBases[index].vectors = {
      chunks: indexedData.chunks,
      embeddings: indexedData.embeddings,
      indexedAt: indexedData.indexedAt,
      modelId: indexedData.modelId,
      providerId: indexedData.providerId,
    };

    await saveKnowledgeBases(knowledgeBases);
    return true;
  } catch (error) {
    console.error("Error storing vectors:", error);
    return false;
  }
};

/**
 * Load vectors for a knowledge base
 * @param {number} knowledgeBaseId - Knowledge base ID
 * @returns {Object|null} - Vectors object or null if not found
 */
export const loadVectors = async (knowledgeBaseId) => {
  try {
    const knowledgeBases = await loadKnowledgeBases();
    const kb = knowledgeBases.find((kb) => kb.id === knowledgeBaseId);
    return kb?.vectors || null;
  } catch (error) {
    console.error("Error loading vectors:", error);
    return null;
  }
};

/**
 * Delete vectors for a knowledge base
 * @param {number} knowledgeBaseId - Knowledge base ID
 * @returns {boolean} - Success status
 */
export const deleteVectors = async (knowledgeBaseId) => {
  try {
    const knowledgeBases = await loadKnowledgeBases();
    const index = knowledgeBases.findIndex((kb) => kb.id === knowledgeBaseId);

    if (index !== -1) {
      delete knowledgeBases[index].vectors;
      await saveKnowledgeBases(knowledgeBases);
    }

    return true;
  } catch (error) {
    console.error("Error deleting vectors:", error);
    return false;
  }
};

/**
 * Check if a knowledge base has been indexed
 * @param {Object} knowledgeBase - Knowledge base object
 * @returns {boolean} - True if indexed
 */
export const isIndexed = (knowledgeBase) => {
  return !!(
    knowledgeBase?.vectors?.chunks?.length > 0 && knowledgeBase?.vectors?.embeddings?.length > 0
  );
};

/**
 * Calculate similarity between query embedding and all chunk embeddings
 * @param {Array<number>} queryEmbedding - Query embedding vector
 * @param {Array<Array<number>>} chunkEmbeddings - Array of chunk embedding vectors
 * @returns {Array<{index: number, similarity: number}>} - Sorted array of similarities
 */
export const calculateSimilarities = (queryEmbedding, chunkEmbeddings) => {
  const similarities = chunkEmbeddings.map((embedding, index) => ({
    index,
    similarity: CORE.cosineSimilarity(queryEmbedding, embedding),
  }));

  // Sort by similarity descending
  return similarities.sort((a, b) => b.similarity - a.similarity);
};

/**
 * Retrieve relevant chunks from a knowledge base
 * @param {string} query - Search query
 * @param {Object} knowledgeBase - Knowledge base with vectors
 * @param {string} modelId - Embedding model ID
 * @param {string} providerId - Provider ID
 * @param {Object} options - Options including topK, minSimilarity, abortSignal
 * @returns {Array<Object>} - Array of relevant chunks with similarity scores
 */
export const retrieveFromKnowledgeBase = async (
  query,
  knowledgeBase,
  modelId,
  providerId,
  options = {}
) => {
  const { topK = 5, minSimilarity = 0.5, abortSignal = null } = options;

  if (!isIndexed(knowledgeBase)) {
    console.warn("Knowledge base is not indexed:", knowledgeBase.name);
    return [];
  }

  const { chunks, embeddings } = knowledgeBase.vectors;

  // Generate embedding for the query
  const [queryEmbedding] = await generateEmbeddings([query], modelId, providerId, abortSignal);

  if (!queryEmbedding) {
    console.error("Failed to generate query embedding");
    return [];
  }

  // Calculate similarities
  const similarities = calculateSimilarities(queryEmbedding, embeddings);

  // Filter by minimum similarity and take top K
  const results = similarities
    .filter((s) => s.similarity >= minSimilarity)
    .slice(0, topK)
    .map((s) => ({
      ...chunks[s.index],
      similarity: s.similarity,
    }));

  return results;
};

/**
 * Retrieve relevant context from multiple knowledge bases
 * @param {string} query - Search query
 * @param {Array<number>} knowledgeBaseIds - Array of knowledge base IDs to search
 * @param {string} modelId - Embedding model ID
 * @param {string} providerId - Provider ID
 * @param {Object} options - Options including topK, minSimilarity, abortSignal
 * @returns {Array<Object>} - Array of relevant chunks from all knowledge bases
 */
export const retrieveContext = async (
  query,
  knowledgeBaseIds,
  modelId,
  providerId,
  options = {}
) => {
  const { topK = 5, minSimilarity = 0.5, abortSignal = null } = options;

  if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
    return [];
  }

  // Load all knowledge bases
  const allKnowledgeBases = await loadKnowledgeBases();
  const targetKnowledgeBases = allKnowledgeBases.filter((kb) => knowledgeBaseIds.includes(kb.id));

  // Generate embedding for the query once
  const [queryEmbedding] = await generateEmbeddings([query], modelId, providerId, abortSignal);

  if (!queryEmbedding) {
    console.error("Failed to generate query embedding");
    return [];
  }

  // Collect results from all knowledge bases
  const allResults = [];

  for (const kb of targetKnowledgeBases) {
    if (!isIndexed(kb)) {
      console.warn("Skipping unindexed knowledge base:", kb.name);
      continue;
    }

    const { chunks, embeddings } = kb.vectors;
    const similarities = calculateSimilarities(queryEmbedding, embeddings);

    // Add knowledge base context to results
    const kbResults = similarities
      .filter((s) => s.similarity >= minSimilarity)
      .map((s) => ({
        ...chunks[s.index],
        similarity: s.similarity,
        knowledgeBaseId: kb.id,
        knowledgeBaseName: kb.name,
      }));

    allResults.push(...kbResults);
  }

  // Sort all results by similarity and take top K
  return allResults.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
};

/**
 * Format retrieved chunks as context for LLM
 * @param {Array<Object>} chunks - Retrieved chunks with metadata
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted context string
 */
export const formatContextForLLM = (chunks, options = {}) => {
  const { includeSource = true, includeScore = false, maxLength = 10000 } = options;

  if (!chunks || chunks.length === 0) {
    return "";
  }

  let context = "";
  let currentLength = 0;

  for (const chunk of chunks) {
    // Build chunk header
    let header = "";
    if (includeSource) {
      header = `[Source: ${chunk.fileName}`;
      if (chunk.knowledgeBaseName) {
        header += ` | KB: ${chunk.knowledgeBaseName}`;
      }
      if (includeScore) {
        header += ` | Score: ${chunk.similarity.toFixed(3)}`;
      }
      header += "]\n";
    }

    const chunkContent = header + chunk.text + "\n\n";

    // Check if adding this chunk exceeds max length
    if (currentLength + chunkContent.length > maxLength) {
      // Add partial chunk if there's room
      const remainingSpace = maxLength - currentLength;
      if (remainingSpace > 100) {
        context += chunkContent.substring(0, remainingSpace) + "...";
      }
      break;
    }

    context += chunkContent;
    currentLength += chunkContent.length;
  }

  return context.trim();
};

/**
 * Full RAG pipeline: query → retrieve → format context
 * @param {string} query - User query
 * @param {Array<number>} knowledgeBaseIds - Knowledge base IDs to search
 * @param {string} modelId - Embedding model ID
 * @param {string} providerId - Provider ID
 * @param {Object} options - All options (retrieval + formatting)
 * @returns {Object} - { context: string, sources: Array }
 */
export const getRAGContext = async (query, knowledgeBaseIds, modelId, providerId, options = {}) => {
  const {
    topK = 5,
    minSimilarity = 0.5,
    includeSource = true,
    includeScore = false,
    maxLength = 10000,
    abortSignal = null,
  } = options;

  // Retrieve relevant chunks
  const chunks = await retrieveContext(query, knowledgeBaseIds, modelId, providerId, {
    topK,
    minSimilarity,
    abortSignal,
  });

  // Format as context
  const context = formatContextForLLM(chunks, {
    includeSource,
    includeScore,
    maxLength,
  });

  // Extract unique sources
  const sources = [
    ...new Map(
      chunks.map((c) => [
        `${c.knowledgeBaseId}-${c.fileId}`,
        {
          knowledgeBaseId: c.knowledgeBaseId,
          knowledgeBaseName: c.knowledgeBaseName,
          fileId: c.fileId,
          fileName: c.fileName,
        },
      ])
    ).values(),
  ];

  return { context, sources, chunks };
};

/**
 * Format RAG context for inclusion in user message
 * @param {string} ragContext - The RAG context string
 * @param {number} resultsCount - Number of RAG results
 * @param {string} userQuery - The original user query
 * @returns {string} - Formatted message with context
 */
const formatRAGContextMessage = (ragContext, resultsCount, userQuery) => {
  return `[Context from knowledge bases (${resultsCount} results)]\n${ragContext}\n\n[User Query]\n${userQuery}`;
};

/**
 * Export RAG utilities
 */
export const RAG = {
  // Chunking
  chunkText,
  chunkDocument,
  chunkKnowledgeBase,
  DEFAULT_CHUNK_CONFIG,
  // Embedding
  generateEmbeddings,
  // Indexing
  indexKnowledgeBase,
  storeVectors,
  loadVectors,
  deleteVectors,
  isIndexed,
  // Retrieval
  calculateSimilarities,
  retrieveFromKnowledgeBase,
  retrieveContext,
  // Formatting
  formatContextForLLM,
  // Full pipeline
  getRAGContext,
  // Chat context utilities
  RAG_CONFIG,
  formatRAGContextMessage,
};

export default RAG;
