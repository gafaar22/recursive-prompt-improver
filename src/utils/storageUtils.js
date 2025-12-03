/**
 * Utility functions for handling storage operations with pluggable backend
 */

import {
  STORAGE_KEYS,
  DEFAULT_VALUES,
  DEFAULT_CHECK_TYPES,
  MODEL_ITEMS,
  CHECK_TYPES,
} from "./constants";
import { TOKENIZER } from "@core/TOKENIZER";
import { estimateImageTokens } from "./fileUtils";

/*************** STORAGE ADAPTER INTERFACE **************/

/**
 * Storage adapter interface for abstracting storage backend
 * Adapters can be either synchronous (localStorage) or asynchronous (IndexedDB)
 */
class StorageAdapter {
  getItem() {
    throw new Error("getItem must be implemented");
  }
  setItem() {
    throw new Error("setItem must be implemented");
  }
  removeItem() {
    throw new Error("removeItem must be implemented");
  }
  clear() {
    throw new Error("clear must be implemented");
  }
  isAsync() {
    return false; // Override to true for async adapters
  }
}

/**
 * LocalStorage implementation of StorageAdapter (synchronous)
 */
class LocalStorageAdapter extends StorageAdapter {
  getItem(key) {
    return localStorage.getItem(key);
  }
  setItem(key, value) {
    localStorage.setItem(key, value);
  }
  removeItem(key) {
    localStorage.removeItem(key);
  }
  clear() {
    localStorage.clear();
  }
  isAsync() {
    return false;
  }
}

/**
 * IndexedDB implementation of StorageAdapter (asynchronous)
 */
class IndexedDBAdapter extends StorageAdapter {
  constructor() {
    super();
    this.dbName = "RPI_Storage";
    this.storeName = "keyValueStore";
    this.dbVersion = 1;
    this.db = null;
    this.initPromise = this._initDB();
  }

  async _initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error("IndexedDB initialization failed:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async _ensureDB() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  async getItem(key) {
    try {
      const db = await this._ensureDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readonly");
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("IndexedDB getItem error:", error);
      return null;
    }
  }

  async setItem(key, value) {
    try {
      const db = await this._ensureDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("IndexedDB setItem error:", error);
    }
  }

  async removeItem(key) {
    try {
      const db = await this._ensureDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("IndexedDB removeItem error:", error);
    }
  }

  async clear() {
    try {
      const db = await this._ensureDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("IndexedDB clear error:", error);
    }
  }

  isAsync() {
    return true;
  }
}

/**
 * Storage backend selector
 * Set STORAGE_TYPE=localstorage to use localStorage, otherwise defaults to IndexedDB
 */
const storageBackend =
  typeof process !== "undefined" && process.env.STORAGE_TYPE === "localstorage"
    ? new LocalStorageAdapter()
    : new IndexedDBAdapter();

/**
 * Low-level storage access functions that normalize sync/async behavior
 * Always returns promises for consistency across backends
 */
const storage = {
  getItem: (key) => {
    const result = storageBackend.getItem(key);
    return storageBackend.isAsync() ? result : Promise.resolve(result);
  },
  setItem: (key, value) => {
    const result = storageBackend.setItem(key, value);
    return storageBackend.isAsync() ? result : Promise.resolve(result);
  },
  removeItem: (key) => {
    const result = storageBackend.removeItem(key);
    return storageBackend.isAsync() ? result : Promise.resolve(result);
  },
  clear: () => {
    const result = storageBackend.clear();
    return storageBackend.isAsync() ? result : Promise.resolve(result);
  },
};

/*************** PUBLIC API FUNCTIONS **************/

/**
 * Save form data to storage
 * @param {Object} data - The form data to save
 */
export const saveToLocalStorage = async (data) => {
  try {
    await storage.setItem(
      STORAGE_KEYS.FORM_DATA,
      JSON.stringify({
        instructions: data.instructions,
        inOutPairs: (data.inOutPairs || []).map((pair) => ({
          in: pair.in || "",
          out: pair.out || "",
          settings: {
            context: pair.settings?.context || null,
            checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
            model: pair.settings?.model || null,
            embeddingModel: pair.settings?.embeddingModel || null,
            useJsonSchema: pair.settings?.useJsonSchema || false,
            jsonSchema: pair.settings?.jsonSchema || "",
            jsonSchemaStrict: pair.settings?.jsonSchemaStrict || false,
            toolsCalled: pair.settings?.toolsCalled || [],
            knowledgeBases: pair.settings?.knowledgeBases || [],
            images: pair.settings?.images || [],
          },
        })),
        iterations: data.iterations,
        coreModel: data.coreModel,
        improveMode: data.improveMode !== undefined ? data.improveMode : true,
        selectedTools: data.selectedTools || [],
        chatMessages: data.chatMessages || [],
      })
    );
  } catch (error) {
    console.error("Error saving to storage:", error);
  }
};

/**
 * Load form data from storage
 * @returns {Object|null} - The loaded form data or null if not found
 */
export const loadFromLocalStorage = async () => {
  try {
    const savedData = await storage.getItem(STORAGE_KEYS.FORM_DATA);
    return savedData ? JSON.parse(savedData) : null;
  } catch (error) {
    console.error("Error loading from storage:", error);
    return null;
  }
};

/**
 * Clear form data from storage
 */
export const clearLocalStorage = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.FORM_DATA);
  } catch (error) {
    console.error("Error clearing storage:", error);
  }
};

/**
 * Load previous instructions from storage
 * @returns {string|null} - The previous instructions or null if not found
 */
export const loadPreviousInstructions = async () => {
  try {
    const savedInstructions = await storage.getItem(STORAGE_KEYS.PREVIOUS_INSTRUCTIONS);
    return savedInstructions;
  } catch (error) {
    console.error("Error loading previous instructions:", error);
    return null;
  }
};

/**
 * Save previous instructions to storage
 * @param {string} instructions - The previous instructions to save
 */
export const savePreviousInstructions = async (instructions) => {
  try {
    await storage.setItem(STORAGE_KEYS.PREVIOUS_INSTRUCTIONS, instructions);
    return true;
  } catch (error) {
    console.error("Error saving previous instructions:", error);
    return false;
  }
};

/**
 * Clear previous instructions from storage
 */
export const clearPreviousInstructions = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.PREVIOUS_INSTRUCTIONS);
  } catch (error) {
    console.error("Error clearing previous instructions:", error);
  }
};

/**
 * Load improved instructions from storage
 * @returns {string|null} - The improved instructions or null if not found
 */
export const loadImprovedInstructions = async () => {
  try {
    const savedInstructions = await storage.getItem(STORAGE_KEYS.IMPROVED_INSTRUCTIONS);
    return savedInstructions;
  } catch (error) {
    console.error("Error loading improved instructions:", error);
    return null;
  }
};

/**
 * Save improved instructions to storage
 * @param {string} instructions - The improved instructions to save
 */
export const saveImprovedInstructions = async (instructions) => {
  try {
    await storage.setItem(STORAGE_KEYS.IMPROVED_INSTRUCTIONS, instructions);
    return true;
  } catch (error) {
    console.error("Error saving improved instructions:", error);
    return false;
  }
};

/**
 * Clear improved instructions from storage
 */
export const clearImprovedInstructions = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.IMPROVED_INSTRUCTIONS);
  } catch (error) {
    console.error("Error clearing improved instructions:", error);
  }
};

/**
 * Clear all instruction history from storage (both previous and improved)
 */
export const clearInstructionHistory = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.PREVIOUS_INSTRUCTIONS);
    await storage.removeItem(STORAGE_KEYS.IMPROVED_INSTRUCTIONS);
  } catch (error) {
    console.error("Error clearing instruction history:", error);
  }
};

/**
 * Load sessions from storage
 * @returns {Array} - The loaded sessions or empty array if not found
 */
export const loadSessions = async () => {
  try {
    const savedSessions = await storage.getItem(STORAGE_KEYS.SESSIONS);
    return savedSessions ? JSON.parse(savedSessions) : [];
  } catch (error) {
    console.error("Error loading sessions:", error);
    return [];
  }
};

/**
 * Save sessions to storage
 * @param {Array} sessions - The sessions array to save
 */
export const saveSessions = async (sessions) => {
  try {
    await storage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    return true;
  } catch (error) {
    console.error("Error saving sessions:", error);
    return false;
  }
};

/**
 * Save session data to storage
 * @param {Object} data - The form data
 * @param {Array} result - The results array
 * @param {Array} tests - The tests array
 */
export const saveSession = async (data, result, tests) => {
  try {
    const existingSessions = await loadSessions();

    // Get current settings models from default provider
    const savedProviders = await storage.getItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await storage.getItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);

    let currentModel = DEFAULT_VALUES.DEFAULT_MODEL;
    let currentEmbeddingModel = DEFAULT_VALUES.DEFAULT_EMBEDDING_MODEL;

    if (savedProviders) {
      const providers = JSON.parse(savedProviders);
      const defaultProvider = providers.find((p) => p.id === savedDefaultProviderId);
      if (defaultProvider) {
        currentModel = defaultProvider.selectedModel || currentModel;
        currentEmbeddingModel = defaultProvider.selectedEmbeddingModel || currentEmbeddingModel;
      } else if (providers.length > 0) {
        currentModel = providers[0].selectedModel || currentModel;
        currentEmbeddingModel = providers[0].selectedEmbeddingModel || currentEmbeddingModel;
      }
    }

    const newSession = {
      id: Date.now(),
      timestamp: data.timestamp || new Date().toISOString(),
      instructions: data.instructions,
      inOutPairs: data.inOutPairs || [
        {
          in: data.in || "",
          out: data.out || "",
          settings: {
            context: null,
            checkTypes: DEFAULT_CHECK_TYPES,
            model: null,
            embeddingModel: null,
            toolsCalled: [],
          },
        },
      ],
      iterations: data.iterations,
      coreModel: data.coreModel,
      improveMode: data.improveMode !== undefined ? data.improveMode : true,
      output: result || [],
      tests: tests || [],
      settingsModel: data.settingsModel || currentModel,
      settingsEmbeddingModel: data.settingsEmbeddingModel || currentEmbeddingModel,
      selectedTools: data.selectedTools || [],
    };

    existingSessions.unshift(newSession);
    await storage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(existingSessions));
  } catch (error) {
    console.error("Error saving session:", error);
  }
};

/**
 * Delete a session by ID
 * @param {number} id - The session ID to delete
 * @returns {Array} - The updated sessions array
 */
export const deleteSession = async (id) => {
  try {
    const sessions = await loadSessions();
    const updatedSessions = sessions.filter((session) => session.id !== id);
    await storage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updatedSessions));
    return updatedSessions;
  } catch (error) {
    console.error("Error deleting session:", error);
    return [];
  }
};

/**
 * Load a session into the form data
 * @param {Object} session - The session to load
 */
export const loadSessionIntoForm = async (session) => {
  try {
    if (!session) {
      return;
    }

    // Load all current contexts and tools
    const existingContexts = await loadContexts();
    const existingTools = await loadTools();

    // Process each test pair's context
    const inOutPairs = await Promise.all(
      (
        session.inOutPairs || [
          {
            in: session.in || "",
            out: session.out || "",
            settings: {
              context: null,
              checkTypes: DEFAULT_CHECK_TYPES,
              model: null,
              embeddingModel: null,
              toolsCalled: [],
            },
          },
        ]
      ).map(async (pair) => {
        // If this pair has a context, try to recover it
        if (pair.settings?.context) {
          const matchingContext = existingContexts.find(
            (context) => context.id === pair.settings.context.id
          );

          if (matchingContext) {
            // Check if content is identical
            const isIdentical =
              JSON.stringify(matchingContext.messages) ===
              JSON.stringify(pair.settings.context.messages);

            if (isIdentical) {
              return {
                ...pair,
                settings: {
                  ...pair.settings,
                  context: matchingContext,
                  checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
                  model: pair.settings?.model || null,
                  embeddingModel: pair.settings?.embeddingModel || null,
                  toolsCalled: pair.settings?.toolsCalled || [],
                },
              };
            }
          }

          // Create a new context with recovered data
          const recoveredContext = {
            name: `${pair.settings.context.name} (recovered from session ${session.id})`,
            messages: pair.settings.context.messages,
          };

          // Save and use the recovered context
          const updatedContexts = await saveContext(recoveredContext);
          return {
            ...pair,
            settings: {
              ...pair.settings,
              context: updatedContexts[0],
              checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
              model: pair.settings?.model || null,
              embeddingModel: pair.settings?.embeddingModel || null,
              toolsCalled: pair.settings?.toolsCalled || [],
            },
          };
        }

        return {
          ...pair,
          settings: {
            ...pair.settings,
            checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
            model: pair.settings?.model || null,
            embeddingModel: pair.settings?.embeddingModel || null,
            toolsCalled: pair.settings?.toolsCalled || [],
          },
        };
      })
    );

    // Process selected tools - check if they exist and are identical
    const processedTools = await Promise.all(
      (session.selectedTools || []).map(async (sessionTool) => {
        // Try to find matching tool by ID
        const matchingTool = existingTools.find((tool) => tool.id === sessionTool.id);

        if (matchingTool) {
          // Check if content is identical (compare all relevant fields)
          const isIdentical =
            matchingTool.name === sessionTool.name &&
            matchingTool.type === sessionTool.type &&
            matchingTool.description === sessionTool.description &&
            JSON.stringify(matchingTool.parameters) === JSON.stringify(sessionTool.parameters) &&
            matchingTool.functionCode === sessionTool.functionCode;

          if (isIdentical) {
            // Use the existing tool reference
            return matchingTool;
          }
        }

        // Tool doesn't exist or has been modified - create a recovered version
        const recoveredTool = {
          type: sessionTool.type || "function",
          name: sessionTool.name,
          description:
            `(recovered from session ${session.id}) ${sessionTool.description || ""}`.trim(),
          parameters: sessionTool.parameters || {},
          functionCode: sessionTool.functionCode || "",
        };

        // Save and use the recovered tool
        const updatedTools = await saveTool(recoveredTool);
        return updatedTools[0];
      })
    );

    const formData = {
      instructions: session.instructions || "",
      inOutPairs,
      iterations: session.iterations || 1,
      coreModel: session.coreModel || session.selectedModel || MODEL_ITEMS[0],
      improveMode: session.improveMode !== undefined ? session.improveMode : true,
      selectedTools: processedTools.filter(Boolean), // Remove any null/undefined entries
    };

    await saveToLocalStorage(formData);
    // Clear instruction history (previous/improved) when loading a session
    await clearInstructionHistory();
    return formData;
  } catch (error) {
    console.error("Error loading session into form:", error);
    return null;
  }
};

/**
 * Clear all sessions
 */
export const clearAllSessions = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.SESSIONS);
  } catch (error) {
    console.error("Error clearing sessions:", error);
  }
};

/**
 * Save output logs to storage
 * @param {string} output - The output logs to save
 */
export const saveOutputToLocalStorage = async (output) => {
  try {
    await storage.setItem(STORAGE_KEYS.OUTPUT_LOGS, output);
  } catch (error) {
    console.error("Error saving output to storage:", error);
  }
};

/**
 * Load output logs from storage
 * @returns {string} - The loaded output logs or empty string if not found
 */
export const loadOutputFromLocalStorage = async () => {
  try {
    const output = await storage.getItem(STORAGE_KEYS.OUTPUT_LOGS);
    return output || "";
  } catch (error) {
    console.error("Error loading output from storage:", error);
    return "";
  }
};

/**
 * Clear output logs from storage
 */
export const clearOutputFromLocalStorage = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.OUTPUT_LOGS);
  } catch (error) {
    console.error("Error clearing output from storage:", error);
  }
};

/**
 * Load contexts from storage
 * @returns {Array} - The loaded contexts or empty array if not found
 */
export const loadContexts = async () => {
  try {
    const savedContexts = await storage.getItem(STORAGE_KEYS.CONTEXTS);
    return savedContexts ? JSON.parse(savedContexts) : [];
  } catch (error) {
    console.error("Error loading contexts:", error);
    return [];
  }
};

/**
 * Save contexts to storage
 * @param {Array} contexts - The contexts array to save
 */
export const saveContexts = async (contexts) => {
  try {
    await storage.setItem(STORAGE_KEYS.CONTEXTS, JSON.stringify(contexts));
    return true;
  } catch (error) {
    console.error("Error saving contexts:", error);
    return false;
  }
};

/**
 * Calculate total tokens for a context's messages
 * @param {Array} messages - Array of message objects
 * @returns {Promise<number>} - Total token count
 */
const calculateContextTokens = async (messages) => {
  if (!messages || messages.length === 0) return 0;

  let totalTokens = 0;
  for (const msg of messages) {
    if (msg.avgTokens !== undefined) {
      // avgTokens already includes image tokens (calculated when message was created)
      totalTokens += msg.avgTokens;
    } else {
      // Calculate text tokens
      if (msg.message) {
        try {
          const result = await TOKENIZER.countTokensAverage(msg.message);
          totalTokens += result.averageTokenCount || 0;
        } catch (error) {
          console.error("Error calculating tokens:", error);
        }
      }
      // Add image tokens only if avgTokens was not present
      if (msg.images && Array.isArray(msg.images)) {
        for (const img of msg.images) {
          if (img.width && img.height) {
            totalTokens += estimateImageTokens(img);
          }
        }
      }
    }
  }
  return totalTokens;
};

/**
 * Save a context to storage (create new or update existing)
 * @param {Object} context - The context object with name, messages, and optional instructionHash
 * @returns {Array} - The updated contexts array
 */
export const saveContext = async (context) => {
  try {
    // Calculate total tokens for the context
    const totalTokens = await calculateContextTokens(context.messages);

    const existingContexts = await loadContexts();
    let updatedContext;

    // Check if a context with the same instructionHash exists (highest priority)
    if (context.instructionHash) {
      const existingContextByHash = existingContexts.find(
        (c) => c.instructionHash === context.instructionHash
      );

      if (existingContextByHash) {
        // Update existing context with same instruction hash but preserve its original timestamp
        updatedContext = {
          ...existingContextByHash,
          name: context.name,
          messages: context.messages || [],
          instructionHash: context.instructionHash,
          totalTokens,
        };

        // Replace the old context with the updated one
        const contextIndex = existingContexts.findIndex((c) => c.id === existingContextByHash.id);
        existingContexts[contextIndex] = updatedContext;
        await storage.setItem(STORAGE_KEYS.CONTEXTS, JSON.stringify(existingContexts));

        // Update context references in formData
        const formData = await loadFromLocalStorage();
        if (formData) {
          let formDataUpdated = false;

          // Update in test pairs
          const updatedPairs = formData.inOutPairs.map((pair) => {
            if (pair.settings?.context?.id === existingContextByHash.id) {
              formDataUpdated = true;
              return {
                ...pair,
                settings: {
                  ...pair.settings,
                  context: updatedContext,
                },
              };
            }
            return pair;
          });

          if (formDataUpdated) {
            formData.inOutPairs = updatedPairs;
            await saveToLocalStorage(formData);
          }
        }

        // Update context references in stored sessions
        const sessions = await loadSessions();
        if (sessions && sessions.length > 0) {
          let sessionsUpdated = false;
          const updatedSessions = sessions.map((session) => {
            let sessionModified = false;

            const updatedPairs = session.inOutPairs.map((pair) => {
              if (pair.settings?.context?.id === existingContextByHash.id) {
                sessionModified = true;
                return {
                  ...pair,
                  settings: {
                    ...pair.settings,
                    context: updatedContext,
                  },
                };
              }
              return pair;
            });

            if (sessionModified) {
              sessionsUpdated = true;
              return {
                ...session,
                inOutPairs: updatedPairs,
              };
            }
            return session;
          });

          if (sessionsUpdated) {
            await saveSessions(updatedSessions);
          }
        }

        return existingContexts;
      }
    }

    // Check if this is an update to an existing context by ID
    if (context.id) {
      // Find the index of the context to update
      const contextIndex = existingContexts.findIndex((c) => c.id === context.id);

      if (contextIndex !== -1) {
        // Update existing context but preserve its original timestamp
        updatedContext = {
          ...existingContexts[contextIndex],
          name: context.name,
          messages: context.messages || [],
          instructionHash: context.instructionHash || undefined,
          totalTokens,
        };

        // Replace the old context with the updated one
        existingContexts[contextIndex] = updatedContext;
        await storage.setItem(STORAGE_KEYS.CONTEXTS, JSON.stringify(existingContexts));

        // Update context references in formData
        const formData = await loadFromLocalStorage();
        if (formData) {
          let formDataUpdated = false;

          // Update in test pairs
          const updatedPairs = formData.inOutPairs.map((pair) => {
            if (pair.settings?.context?.id === context.id) {
              formDataUpdated = true;
              return {
                ...pair,
                settings: {
                  ...pair.settings,
                  context: updatedContext,
                },
              };
            }
            return pair;
          });

          if (formDataUpdated) {
            formData.inOutPairs = updatedPairs;
            await saveToLocalStorage(formData);
          }
        }

        // Update context references in stored sessions
        const sessions = await loadSessions();
        if (sessions && sessions.length > 0) {
          let sessionsUpdated = false;
          const updatedSessions = sessions.map((session) => {
            let sessionModified = false;

            const updatedPairs = session.inOutPairs.map((pair) => {
              if (pair.settings?.context?.id === context.id) {
                sessionModified = true;
                return {
                  ...pair,
                  settings: {
                    ...pair.settings,
                    context: updatedContext,
                  },
                };
              }
              return pair;
            });

            if (sessionModified) {
              sessionsUpdated = true;
              return {
                ...session,
                inOutPairs: updatedPairs,
              };
            }
            return session;
          });

          if (sessionsUpdated) {
            await saveSessions(updatedSessions);
          }
        }

        return existingContexts;
      }
    }

    // If not updating or context not found, create a new one
    const newContext = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      name: context.name,
      messages: context.messages || [],
      instructionHash: context.instructionHash || undefined,
      totalTokens,
    };

    existingContexts.unshift(newContext);
    await storage.setItem(STORAGE_KEYS.CONTEXTS, JSON.stringify(existingContexts));
    return existingContexts;
  } catch (error) {
    console.error("Error saving context:", error);
    return [];
  }
};

/**
 * Delete a context by ID
 * @param {number} id - The context ID to delete
 * @returns {Array} - The updated contexts array
 */
export const deleteContext = async (id) => {
  try {
    const contexts = await loadContexts();
    const updatedContexts = contexts.filter((context) => context.id !== id);
    await storage.setItem(STORAGE_KEYS.CONTEXTS, JSON.stringify(updatedContexts));

    // Check if the deleted context is referenced in any test pairs
    const formData = await loadFromLocalStorage();
    if (formData) {
      const updatedPairs = formData.inOutPairs.map((pair) => {
        if (pair.settings?.context?.id === id) {
          return {
            ...pair,
            settings: {
              ...pair.settings,
              context: null,
              checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
              model: pair.settings?.model || null,
              embeddingModel: pair.settings?.embeddingModel || null,
              toolsCalled: pair.settings?.toolsCalled || [],
            },
          };
        }
        return pair;
      });

      if (JSON.stringify(updatedPairs) !== JSON.stringify(formData.inOutPairs)) {
        formData.inOutPairs = updatedPairs;
        await saveToLocalStorage(formData);
      }
    }

    // Remove context references from stored sessions
    const sessions = await loadSessions();
    if (sessions && sessions.length > 0) {
      let sessionsUpdated = false;
      const updatedSessions = sessions.map((session) => {
        let sessionModified = false;

        const updatedPairs = session.inOutPairs.map((pair) => {
          if (pair.settings?.context?.id === id) {
            sessionModified = true;
            return {
              ...pair,
              settings: {
                ...pair.settings,
                context: null,
                checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
                model: pair.settings?.model || null,
                embeddingModel: pair.settings?.embeddingModel || null,
                toolsCalled: pair.settings?.toolsCalled || [],
              },
            };
          }
          return pair;
        });

        if (sessionModified) {
          sessionsUpdated = true;
          return {
            ...session,
            inOutPairs: updatedPairs,
          };
        }
        return session;
      });

      if (sessionsUpdated) {
        await saveSessions(updatedSessions);
      }
    }

    return updatedContexts;
  } catch (error) {
    console.error("Error deleting context:", error);
    return [];
  }
};

/**
 * Clear all contexts
 */
export const clearAllContexts = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.CONTEXTS);

    // Remove all context references from test pairs
    const formData = await loadFromLocalStorage();
    if (formData) {
      const updatedPairs = formData.inOutPairs.map((pair) => ({
        ...pair,
        settings: {
          ...pair.settings,
          context: null,
          checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
          model: pair.settings?.model || null,
          embeddingModel: pair.settings?.embeddingModel || null,
          toolsCalled: pair.settings?.toolsCalled || [],
        },
      }));
      formData.inOutPairs = updatedPairs;
      await saveToLocalStorage(formData);
    }

    // Remove all context references from stored sessions
    const sessions = await loadSessions();
    if (sessions && sessions.length > 0) {
      const updatedSessions = sessions.map((session) => {
        const updatedPairs = session.inOutPairs.map((pair) => ({
          ...pair,
          settings: {
            ...pair.settings,
            context: null,
            checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
            model: pair.settings?.model || null,
            embeddingModel: pair.settings?.embeddingModel || null,
            toolsCalled: pair.settings?.toolsCalled || [],
          },
        }));

        return {
          ...session,
          inOutPairs: updatedPairs,
        };
      });

      await saveSessions(updatedSessions);
    }
  } catch (error) {
    console.error("Error clearing contexts:", error);
  }
};

/*************** KNOWLEDGE BASE STORAGE FUNCTIONS **************/

/**
 * Load knowledge bases from storage
 * @returns {Array} - The loaded knowledge bases or empty array if not found
 */
export const loadKnowledgeBases = async () => {
  try {
    const savedKnowledgeBases = await storage.getItem(STORAGE_KEYS.KNOWLEDGE_BASES);
    return savedKnowledgeBases ? JSON.parse(savedKnowledgeBases) : [];
  } catch (error) {
    console.error("Error loading knowledge bases:", error);
    return [];
  }
};

/**
 * Save knowledge bases to storage
 * @param {Array} knowledgeBases - The knowledge bases array to save
 */
export const saveKnowledgeBases = async (knowledgeBases) => {
  try {
    await storage.setItem(STORAGE_KEYS.KNOWLEDGE_BASES, JSON.stringify(knowledgeBases));
    return true;
  } catch (error) {
    console.error("Error saving knowledge bases:", error);
    return false;
  }
};

/**
 * Save a knowledge base to storage (create new or update existing)
 * @param {Object} knowledgeBase - The knowledge base object with name, description, and files
 * @returns {Array} - The updated knowledge bases array
 */
export const saveKnowledgeBase = async (knowledgeBase) => {
  try {
    const existingKnowledgeBases = await loadKnowledgeBases();

    if (knowledgeBase.id) {
      // Update existing knowledge base
      const index = existingKnowledgeBases.findIndex((kb) => kb.id === knowledgeBase.id);
      if (index !== -1) {
        existingKnowledgeBases[index] = {
          ...existingKnowledgeBases[index],
          ...knowledgeBase,
        };
      }
    } else {
      // Create new knowledge base with unique ID
      const newKnowledgeBase = {
        ...knowledgeBase,
        id: Date.now(),
        timestamp: Date.now(),
        files: knowledgeBase.files || [],
      };
      existingKnowledgeBases.push(newKnowledgeBase);
    }

    await storage.setItem(STORAGE_KEYS.KNOWLEDGE_BASES, JSON.stringify(existingKnowledgeBases));
    return existingKnowledgeBases;
  } catch (error) {
    console.error("Error saving knowledge base:", error);
    return [];
  }
};

/**
 * Delete a knowledge base from storage
 * @param {number} id - The ID of the knowledge base to delete
 * @returns {Array} - The updated knowledge bases array
 */
export const deleteKnowledgeBase = async (id) => {
  try {
    const knowledgeBases = await loadKnowledgeBases();
    const updatedKnowledgeBases = knowledgeBases.filter((kb) => kb.id !== id);
    await storage.setItem(STORAGE_KEYS.KNOWLEDGE_BASES, JSON.stringify(updatedKnowledgeBases));
    return updatedKnowledgeBases;
  } catch (error) {
    console.error("Error deleting knowledge base:", error);
    return [];
  }
};

/**
 * Clear all knowledge bases
 */
export const clearAllKnowledgeBases = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.KNOWLEDGE_BASES);
  } catch (error) {
    console.error("Error clearing knowledge bases:", error);
  }
};

/**
 * Add a file to a knowledge base
 * @param {number} knowledgeBaseId - The ID of the knowledge base
 * @param {Object} file - The file object with name, content, size, and type
 * @returns {Array} - The updated knowledge bases array
 */
export const addFileToKnowledgeBase = async (knowledgeBaseId, file) => {
  try {
    const knowledgeBases = await loadKnowledgeBases();
    const index = knowledgeBases.findIndex((kb) => kb.id === knowledgeBaseId);

    if (index !== -1) {
      const newFile = {
        id: Date.now(),
        name: file.name,
        content: file.content,
        originalData: file.originalData, // For binary files like PDFs
        usedOCR: file.usedOCR, // Whether OCR was used for this file
        size: file.size,
        type: file.type,
        timestamp: Date.now(),
      };
      knowledgeBases[index].files = [...(knowledgeBases[index].files || []), newFile];
      await storage.setItem(STORAGE_KEYS.KNOWLEDGE_BASES, JSON.stringify(knowledgeBases));
    }

    return knowledgeBases;
  } catch (error) {
    console.error("Error adding file to knowledge base:", error);
    return [];
  }
};

/**
 * Delete a file from a knowledge base
 * @param {number} knowledgeBaseId - The ID of the knowledge base
 * @param {number} fileId - The ID of the file to delete
 * @returns {Array} - The updated knowledge bases array
 */
export const deleteFileFromKnowledgeBase = async (knowledgeBaseId, fileId) => {
  try {
    const knowledgeBases = await loadKnowledgeBases();
    const index = knowledgeBases.findIndex((kb) => kb.id === knowledgeBaseId);

    if (index !== -1) {
      knowledgeBases[index].files = knowledgeBases[index].files.filter((f) => f.id !== fileId);
      await storage.setItem(STORAGE_KEYS.KNOWLEDGE_BASES, JSON.stringify(knowledgeBases));
    }

    return knowledgeBases;
  } catch (error) {
    console.error("Error deleting file from knowledge base:", error);
    return [];
  }
};

/**
 * Load settings from storage
 * @returns {Object} - The loaded settings with default values for missing properties
 */
export const loadSettings = async () => {
  try {
    // Load multi-provider settings
    const savedProviders = await storage.getItem(STORAGE_KEYS.PROVIDERS);
    const savedDefaultProviderId = await storage.getItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID);
    const savedMaxTokens = await storage.getItem(STORAGE_KEYS.MAX_TOKENS);
    const savedTimeLimit = await storage.getItem(STORAGE_KEYS.TIME_LIMIT);
    const savedTemperature = await storage.getItem(STORAGE_KEYS.TEMPERATURE);
    const savedMaxToolIterations = await storage.getItem(STORAGE_KEYS.MAX_TOOL_ITERATIONS);
    const savedEnvironmentVariables = await storage.getItem(STORAGE_KEYS.ENVIRONMENT_VARIABLES);

    const providers = savedProviders ? JSON.parse(savedProviders) : [];
    const environmentVariables = savedEnvironmentVariables
      ? JSON.parse(savedEnvironmentVariables)
      : [];

    return {
      providers: providers.length > 0 ? providers : [],
      defaultProviderId: savedDefaultProviderId || null,
      max_tokens: savedMaxTokens ? parseInt(savedMaxTokens) : DEFAULT_VALUES.MAX_TOKENS,
      time_limit: savedTimeLimit ? parseInt(savedTimeLimit) : DEFAULT_VALUES.TIME_LIMIT,
      temperature: savedTemperature ? parseFloat(savedTemperature) : DEFAULT_VALUES.TEMPERATURE,
      maxToolIterations: savedMaxToolIterations
        ? parseInt(savedMaxToolIterations)
        : DEFAULT_VALUES.MAX_TOOL_ITERATIONS,
      environmentVariables: environmentVariables,
    };
  } catch (error) {
    console.error("Error loading settings from storage:", error);
    return {
      providers: [],
      defaultProviderId: null,
      max_tokens: DEFAULT_VALUES.MAX_TOKENS,
      time_limit: DEFAULT_VALUES.TIME_LIMIT,
      temperature: DEFAULT_VALUES.TEMPERATURE,
      maxToolIterations: DEFAULT_VALUES.MAX_TOOL_ITERATIONS,
      environmentVariables: [],
    };
  }
};

/**
 * Save settings to storage
 * @param {Object} settings - The settings object to save
 * @returns {boolean} - True if successful, false otherwise
 */
export const saveSettings = async (settings) => {
  try {
    // Save new multi-provider format
    await storage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(settings.providers || []));
    await storage.setItem(STORAGE_KEYS.DEFAULT_PROVIDER_ID, settings.defaultProviderId || "");
    await storage.setItem(STORAGE_KEYS.MAX_TOKENS, settings.max_tokens.toString());
    await storage.setItem(STORAGE_KEYS.TIME_LIMIT, settings.time_limit.toString());
    await storage.setItem(STORAGE_KEYS.TEMPERATURE, settings.temperature.toString());
    await storage.setItem(STORAGE_KEYS.MAX_TOOL_ITERATIONS, settings.maxToolIterations.toString());
    await storage.setItem(
      STORAGE_KEYS.ENVIRONMENT_VARIABLES,
      JSON.stringify(settings.environmentVariables || [])
    );

    // Update form data's coreModel when default provider/model changes
    const defaultProvider = settings.providers?.find((p) => p.id === settings.defaultProviderId);
    if (defaultProvider?.selectedModel) {
      const formData = await loadFromLocalStorage();
      if (formData) {
        formData.coreModel = defaultProvider.selectedModel;
        await saveToLocalStorage(formData);
      }
    }

    return true;
  } catch (error) {
    console.error("Error saving settings to storage:", error);
    return false;
  }
};

/**
 * Restore default settings
 * @param {Object} currentSettings - The current settings object
 * @returns {Object} - The settings object with defaults restored
 */
export const restoreDefaultSettings = async (currentSettings) => {
  try {
    // Preserve existing providers and only reset global settings
    const newSettings = {
      providers: currentSettings.providers || [], // Keep existing providers
      defaultProviderId: currentSettings.defaultProviderId || DEFAULT_VALUES.DEFAULT_PROVIDER.id, // Keep existing default provider
      max_tokens: DEFAULT_VALUES.MAX_TOKENS, // Reset to default
      time_limit: DEFAULT_VALUES.TIME_LIMIT, // Reset to default
      temperature: DEFAULT_VALUES.TEMPERATURE, // Reset to default
      maxToolIterations: DEFAULT_VALUES.MAX_TOOL_ITERATIONS, // Reset to default
      environmentVariables: currentSettings.environmentVariables || [], // Keep existing environment variables
    };

    // Save to storage
    await saveSettings(newSettings);

    return newSettings;
  } catch (error) {
    console.error("Error restoring default settings:", error);
    return currentSettings;
  }
};

/**
 * Load tools from storage
 * @returns {Array} - The loaded tools or empty array if not found
 */
export const loadTools = async () => {
  try {
    const savedTools = await storage.getItem(STORAGE_KEYS.TOOLS);
    return savedTools ? JSON.parse(savedTools) : [];
  } catch (error) {
    console.error("Error loading tools:", error);
    return [];
  }
};

/**
 * Save tools to storage
 * @param {Array} tools - The tools array to save
 */
export const saveTools = async (tools) => {
  try {
    await storage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(tools));
    return true;
  } catch (error) {
    console.error("Error saving tools:", error);
    return false;
  }
};

/**
 * Save a tool to storage (create new or update existing)
 * @param {Object} tool - The tool object with type, name, description, parameters, and functionCode
 * @returns {Array} - The updated tools array
 */
export const saveTool = async (tool) => {
  try {
    const existingTools = await loadTools();
    let updatedTool;

    // Check if this is an update to an existing tool
    if (tool.id) {
      // Find the index of the tool to update
      const toolIndex = existingTools.findIndex((t) => t.id === tool.id);

      if (toolIndex !== -1) {
        // Check if tool name changed to update chat message references
        const oldToolName = existingTools[toolIndex].name;
        const newToolName = tool.name;
        const toolNameChanged = oldToolName !== newToolName;

        // Update existing tool but preserve its original timestamp
        updatedTool = {
          ...existingTools[toolIndex],
          type: tool.type || "function",
          name: tool.name,
          description: tool.description || "",
          parameters: tool.parameters || {},
          functionCode: tool.functionCode || "",
        };

        // Replace the old tool with the updated one
        existingTools[toolIndex] = updatedTool;
        await storage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(existingTools));

        // Update tool name references in chat messages and contexts if name changed
        if (toolNameChanged) {
          await updateChatMessagesOnToolRename(oldToolName, newToolName);
          await updateContextsOnToolRename(oldToolName, newToolName);
        }

        // Update tool references in formData
        const formData = await loadFromLocalStorage();
        if (formData) {
          let formDataUpdated = false;

          // Update in selectedTools
          const updatedSelectedTools = (formData.selectedTools || []).map((t) =>
            t.id === tool.id ? updatedTool : t
          );
          if (JSON.stringify(updatedSelectedTools) !== JSON.stringify(formData.selectedTools)) {
            formData.selectedTools = updatedSelectedTools;
            formDataUpdated = true;
          }

          // Update in test pairs' toolsCalled
          const updatedPairs = formData.inOutPairs.map((pair) => {
            if (pair.settings?.toolsCalled?.length > 0) {
              const updatedToolsCalled = pair.settings.toolsCalled.map((t) =>
                t.id === tool.id ? updatedTool : t
              );
              if (
                JSON.stringify(updatedToolsCalled) !== JSON.stringify(pair.settings.toolsCalled)
              ) {
                formDataUpdated = true;
                return {
                  ...pair,
                  settings: {
                    ...pair.settings,
                    toolsCalled: updatedToolsCalled,
                  },
                };
              }
            }
            return pair;
          });

          if (formDataUpdated) {
            formData.inOutPairs = updatedPairs;
            await saveToLocalStorage(formData);
          }
        }

        // Update tool references in stored sessions
        const sessions = await loadSessions();
        if (sessions && sessions.length > 0) {
          let sessionsUpdated = false;
          const updatedSessions = sessions.map((session) => {
            let sessionModified = false;

            // Update in selectedTools
            const updatedSelectedTools = (session.selectedTools || []).map((t) => {
              if (t.id === tool.id) {
                sessionModified = true;
                return updatedTool;
              }
              return t;
            });

            // Update in test pairs' toolsCalled
            const updatedPairs = session.inOutPairs.map((pair) => {
              if (pair.settings?.toolsCalled?.length > 0) {
                const updatedToolsCalled = pair.settings.toolsCalled.map((t) => {
                  if (t.id === tool.id) {
                    sessionModified = true;
                    return updatedTool;
                  }
                  return t;
                });

                // Always return updated pair if we processed toolsCalled
                return {
                  ...pair,
                  settings: {
                    ...pair.settings,
                    toolsCalled: updatedToolsCalled,
                  },
                };
              }
              return pair;
            });

            if (sessionModified) {
              sessionsUpdated = true;
              return {
                ...session,
                selectedTools: updatedSelectedTools,
                inOutPairs: updatedPairs,
              };
            }
            return session;
          });

          if (sessionsUpdated) {
            await saveSessions(updatedSessions);
          }
        }

        // Update agent references
        await updateAgentsOnToolUpdate(updatedTool);

        return existingTools;
      }
    }

    // If not updating or tool not found, create a new one
    const newTool = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: tool.type || "function",
      name: tool.name,
      description: tool.description || "",
      parameters: tool.parameters || {},
      functionCode: tool.functionCode || "",
    };

    existingTools.unshift(newTool);
    await storage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(existingTools));
    return existingTools;
  } catch (error) {
    console.error("Error saving tool:", error);
    return [];
  }
};

/**
 * Delete a tool by ID
 * @param {number} id - The tool ID to delete
 * @returns {Array} - The updated tools array
 */
export const deleteTool = async (id) => {
  try {
    const tools = await loadTools();
    const updatedTools = tools.filter((tool) => tool.id !== id);
    await storage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(updatedTools));

    // Remove tool references from formData
    const formData = await loadFromLocalStorage();
    if (formData) {
      // Remove from selectedTools
      const updatedSelectedTools = (formData.selectedTools || []).filter((tool) => tool.id !== id);

      // Remove from test pairs' toolsCalled and update checkTypes
      const updatedPairs = formData.inOutPairs.map((pair) => {
        if (pair.settings?.toolsCalled?.length > 0) {
          const updatedToolsCalled = pair.settings.toolsCalled.filter((tool) => tool.id !== id);

          // If no tools left in toolsCalled, remove the TOOLS_CALL check type
          let updatedCheckTypes = pair.settings.checkTypes;
          if (
            updatedToolsCalled.length === 0 &&
            updatedCheckTypes.includes(CHECK_TYPES.TOOLS_CALL.id)
          ) {
            updatedCheckTypes = updatedCheckTypes.filter((ct) => ct !== CHECK_TYPES.TOOLS_CALL.id);
          }

          return {
            ...pair,
            settings: {
              ...pair.settings,
              toolsCalled: updatedToolsCalled,
              checkTypes: updatedCheckTypes,
            },
          };
        }
        return pair;
      });

      if (
        JSON.stringify(updatedSelectedTools) !== JSON.stringify(formData.selectedTools) ||
        JSON.stringify(updatedPairs) !== JSON.stringify(formData.inOutPairs)
      ) {
        formData.selectedTools = updatedSelectedTools;
        formData.inOutPairs = updatedPairs;
        await saveToLocalStorage(formData);
      }
    }

    // Remove tool references from stored sessions
    const sessions = await loadSessions();
    if (sessions && sessions.length > 0) {
      let sessionsUpdated = false;
      const updatedSessions = sessions.map((session) => {
        let sessionModified = false;

        // Remove from selectedTools
        const updatedSelectedTools = (session.selectedTools || []).filter((tool) => tool.id !== id);
        if (updatedSelectedTools.length !== (session.selectedTools || []).length) {
          sessionModified = true;
        }

        // Remove from test pairs' toolsCalled
        const updatedPairs = session.inOutPairs.map((pair) => {
          if (pair.settings?.toolsCalled?.length > 0) {
            const updatedToolsCalled = pair.settings.toolsCalled.filter((tool) => tool.id !== id);
            if (updatedToolsCalled.length !== pair.settings.toolsCalled.length) {
              sessionModified = true;

              // Update checkTypes if needed
              let updatedCheckTypes = pair.settings.checkTypes;
              if (
                updatedToolsCalled.length === 0 &&
                updatedCheckTypes.includes(CHECK_TYPES.TOOLS_CALL.id)
              ) {
                updatedCheckTypes = updatedCheckTypes.filter(
                  (ct) => ct !== CHECK_TYPES.TOOLS_CALL.id
                );
              }

              return {
                ...pair,
                settings: {
                  ...pair.settings,
                  toolsCalled: updatedToolsCalled,
                  checkTypes: updatedCheckTypes,
                },
              };
            }
          }
          return pair;
        });

        if (sessionModified) {
          sessionsUpdated = true;
          return {
            ...session,
            selectedTools: updatedSelectedTools,
            inOutPairs: updatedPairs,
          };
        }
        return session;
      });

      if (sessionsUpdated) {
        await saveSessions(updatedSessions);
      }
    }

    // Update agent references
    await updateAgentsOnToolDelete(id);

    return updatedTools;
  } catch (error) {
    console.error("Error deleting tool:", error);
    return [];
  }
};

/**
 * Clear all tools
 */
export const clearAllTools = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.TOOLS);

    // Remove all tool references from formData
    const formData = await loadFromLocalStorage();
    if (formData) {
      // Clear selectedTools
      formData.selectedTools = [];

      // Remove all toolsCalled from test pairs and update checkTypes
      const updatedPairs = formData.inOutPairs.map((pair) => {
        if (pair.settings?.toolsCalled?.length > 0) {
          // Remove TOOLS_CALL check type
          let updatedCheckTypes = pair.settings.checkTypes;
          if (updatedCheckTypes.includes(CHECK_TYPES.TOOLS_CALL.id)) {
            updatedCheckTypes = updatedCheckTypes.filter((ct) => ct !== CHECK_TYPES.TOOLS_CALL.id);
          }

          return {
            ...pair,
            settings: {
              ...pair.settings,
              toolsCalled: [],
              checkTypes: updatedCheckTypes,
            },
          };
        }
        return pair;
      });

      formData.inOutPairs = updatedPairs;
      await saveToLocalStorage(formData);
    }

    // Remove all tool references from stored sessions
    const sessions = await loadSessions();
    if (sessions && sessions.length > 0) {
      const updatedSessions = sessions.map((session) => {
        const updatedPairs = session.inOutPairs.map((pair) => {
          if (pair.settings?.toolsCalled?.length > 0) {
            // Remove TOOLS_CALL check type
            let updatedCheckTypes = pair.settings.checkTypes;
            if (updatedCheckTypes.includes(CHECK_TYPES.TOOLS_CALL.id)) {
              updatedCheckTypes = updatedCheckTypes.filter(
                (ct) => ct !== CHECK_TYPES.TOOLS_CALL.id
              );
            }

            return {
              ...pair,
              settings: {
                ...pair.settings,
                toolsCalled: [],
                checkTypes: updatedCheckTypes,
              },
            };
          }
          return pair;
        });

        return {
          ...session,
          selectedTools: [],
          inOutPairs: updatedPairs,
        };
      });

      await saveSessions(updatedSessions);
    }

    // Clear all tool references from agents
    const agents = await loadAgents();
    if (agents && agents.length > 0) {
      const updatedAgents = agents.map((agent) => ({
        ...agent,
        selectedTools: [],
      }));
      await saveAgents(updatedAgents);
    }
  } catch (error) {
    console.error("Error clearing tools:", error);
  }
};

/*************** AGENTS MANAGEMENT **************/

/**
 * Load agents from storage
 * @returns {Array} - Array of agent objects
 */
export const loadAgents = async () => {
  try {
    const savedAgents = await storage.getItem(STORAGE_KEYS.AGENTS);
    return savedAgents ? JSON.parse(savedAgents) : [];
  } catch (error) {
    console.error("Error loading agents:", error);
    return [];
  }
};

/**
 * Save agents array to storage
 * @param {Array} agents - Array of agent objects to save
 */
export const saveAgents = async (agents) => {
  try {
    await storage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(agents));
  } catch (error) {
    console.error("Error saving agents:", error);
  }
};

/**
 * Save or update a single agent
 * @param {Object} agent - The agent object to save
 * @returns {Array} - Updated agents array
 */
export const saveAgent = async (agent) => {
  try {
    const existingAgents = await loadAgents();

    // If updating an existing agent
    if (agent.id) {
      const index = existingAgents.findIndex((a) => a.id === agent.id);
      if (index !== -1) {
        // Check if agent name changed to update chat message references
        const oldAgentName = existingAgents[index].name;
        const newAgentName = agent.name;
        const agentNameChanged = oldAgentName !== newAgentName;

        // Update existing agent
        const updatedAgent = {
          ...agent,
          timestamp: new Date().toISOString(),
        };
        existingAgents[index] = updatedAgent;
        await saveAgents(existingAgents);

        // Update agent name references in ALL other agents' chat messages if name changed
        // This must happen AFTER saving the updated agent
        if (agentNameChanged) {
          await updateChatMessagesOnAgentRename(oldAgentName, newAgentName);
          await updateContextsOnAgentRename(oldAgentName, newAgentName);
        }

        // Update agent references in other agents' selectedTools
        await updateAgentsOnAgentUpdate(updatedAgent);

        // Update agent references in formData
        const formData = await loadFromLocalStorage();
        if (formData && formData.selectedTools?.length > 0) {
          const updatedSelectedTools = formData.selectedTools.map((tool) =>
            tool.id === agent.id && tool.isAgent ? updatedAgent : tool
          );
          if (JSON.stringify(updatedSelectedTools) !== JSON.stringify(formData.selectedTools)) {
            formData.selectedTools = updatedSelectedTools;
            await saveToLocalStorage(formData);
          }
        }

        // Update agent references in sessions
        await updateSessionsOnAgentUpdate(updatedAgent);

        return existingAgents;
      }
    }

    // If not updating or agent not found, create a new one
    const newAgent = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      name: agent.name,
      description: agent.description || "",
      instructions: agent.instructions,
      selectedTools: agent.selectedTools || [],
      coreModel: agent.coreModel,
      useJsonOutput: agent.useJsonOutput || false,
      useJsonSchema: agent.useJsonSchema || false,
      jsonSchema: agent.jsonSchema || "",
      jsonSchemaStrict: agent.jsonSchemaStrict || false,
      chatMessages: agent.chatMessages || [],
    };

    existingAgents.unshift(newAgent);
    await saveAgents(existingAgents);
    return existingAgents;
  } catch (error) {
    console.error("Error saving agent:", error);
    return [];
  }
};

/**
 * Delete an agent
 * @param {number} id - The agent ID to delete
 * @returns {Array} - Updated agents array
 */
export const deleteAgent = async (id) => {
  try {
    const existingAgents = await loadAgents();
    const updatedAgents = existingAgents.filter((agent) => agent.id !== id);
    await saveAgents(updatedAgents);

    // Update agent references in other agents' selectedTools
    await updateAgentsOnAgentDelete(id);

    // Update agent references in sessions
    await updateSessionsOnAgentDelete(id);

    // Remove agent references from formData
    const formData = await loadFromLocalStorage();
    if (formData && formData.selectedTools?.length > 0) {
      const updatedSelectedTools = formData.selectedTools.filter(
        (tool) => !(tool.id === id && tool.isAgent)
      );
      if (updatedSelectedTools.length !== formData.selectedTools.length) {
        formData.selectedTools = updatedSelectedTools;
        await saveToLocalStorage(formData);
      }
    }

    return updatedAgents;
  } catch (error) {
    console.error("Error deleting agent:", error);
    return [];
  }
};

/**
 * Clear all agents
 */
export const clearAllAgents = async () => {
  try {
    await storage.removeItem(STORAGE_KEYS.AGENTS);

    // Remove all agent references from formData
    const formData = await loadFromLocalStorage();
    if (formData && formData.selectedTools?.length > 0) {
      const updatedSelectedTools = formData.selectedTools.filter((tool) => !tool.isAgent);
      if (updatedSelectedTools.length !== formData.selectedTools.length) {
        formData.selectedTools = updatedSelectedTools;
        await saveToLocalStorage(formData);
      }
    }

    // Remove all agent references from sessions
    const sessions = await loadSessions();
    if (sessions && sessions.length > 0) {
      let sessionsUpdated = false;
      const updatedSessions = sessions.map((session) => {
        if (session.selectedTools?.some((tool) => tool.isAgent)) {
          sessionsUpdated = true;
          return {
            ...session,
            selectedTools: session.selectedTools.filter((tool) => !tool.isAgent),
          };
        }
        return session;
      });

      if (sessionsUpdated) {
        await saveSessions(updatedSessions);
      }
    }
  } catch (error) {
    console.error("Error clearing agents:", error);
  }
};

/**
 * Update agent references when a tool is deleted
 * @param {number} toolId - The tool ID that was deleted
 */
export const updateAgentsOnToolDelete = async (toolId) => {
  try {
    const agents = await loadAgents();
    if (agents && agents.length > 0) {
      let agentsUpdated = false;
      const updatedAgents = agents.map((agent) => {
        if (agent.selectedTools?.some((t) => t.id === toolId)) {
          agentsUpdated = true;
          return {
            ...agent,
            selectedTools: agent.selectedTools.filter((t) => t.id !== toolId),
          };
        }
        return agent;
      });

      if (agentsUpdated) {
        await saveAgents(updatedAgents);
      }
    }
  } catch (error) {
    console.error("Error updating agents on tool delete:", error);
  }
};

/**
 * Update agent references when a tool is modified
 * @param {Object} updatedTool - The updated tool object
 */
export const updateAgentsOnToolUpdate = async (updatedTool) => {
  try {
    const agents = await loadAgents();
    if (agents && agents.length > 0) {
      let agentsUpdated = false;
      const updatedAgents = agents.map((agent) => {
        let currentAgentUpdated = false;
        const updatedSelectedTools = (agent.selectedTools || []).map((t) => {
          if (t.id === updatedTool.id) {
            currentAgentUpdated = true;
            agentsUpdated = true;
            return updatedTool;
          }
          return t;
        });

        if (currentAgentUpdated) {
          return {
            ...agent,
            selectedTools: updatedSelectedTools,
          };
        }
        return agent;
      });

      if (agentsUpdated) {
        await saveAgents(updatedAgents);
      }
    }
  } catch (error) {
    console.error("Error updating agents on tool update:", error);
  }
};

/**
 * Update agent references when a model changes
 * @param {string} oldModelId - The old model ID
 * @param {Object} newModel - The new model object
 */
export const updateAgentsOnModelChange = async (oldModelId, newModel) => {
  try {
    const agents = await loadAgents();
    if (agents && agents.length > 0) {
      let agentsUpdated = false;
      const updatedAgents = agents.map((agent) => {
        if (agent.coreModel?.id === oldModelId) {
          agentsUpdated = true;
          return {
            ...agent,
            coreModel: newModel,
          };
        }
        return agent;
      });

      if (agentsUpdated) {
        await saveAgents(updatedAgents);
      }
    }
  } catch (error) {
    console.error("Error updating agents on model change:", error);
  }
};

/**
 * Update agent references when another agent is deleted
 * Removes the deleted agent from selectedTools of all agents
 * @param {number} agentId - The agent ID that was deleted
 */
export const updateAgentsOnAgentDelete = async (agentId) => {
  try {
    const agents = await loadAgents();
    if (agents && agents.length > 0) {
      let agentsUpdated = false;
      const updatedAgents = agents.map((agent) => {
        if (agent.selectedTools?.some((t) => t.id === agentId && t.isAgent)) {
          agentsUpdated = true;
          return {
            ...agent,
            selectedTools: agent.selectedTools.filter((t) => !(t.id === agentId && t.isAgent)),
          };
        }
        return agent;
      });

      if (agentsUpdated) {
        await saveAgents(updatedAgents);
      }
    }
  } catch (error) {
    console.error("Error updating agents on agent delete:", error);
  }
};

/**
 * Update agent references when another agent is modified
 * Updates the agent object in selectedTools of all agents
 * @param {Object} updatedAgent - The updated agent object
 */
export const updateAgentsOnAgentUpdate = async (updatedAgent) => {
  try {
    const agents = await loadAgents();
    if (agents && agents.length > 0) {
      let agentsUpdated = false;
      const updatedAgents = agents.map((agent) => {
        let currentAgentUpdated = false;
        const updatedSelectedTools = (agent.selectedTools || []).map((t) => {
          if (t.id === updatedAgent.id && t.isAgent) {
            currentAgentUpdated = true;
            agentsUpdated = true;
            // Merge updated agent properties while preserving tool-specific properties
            return {
              ...updatedAgent,
              isAgent: true,
              parameters: t.parameters, // Preserve existing parameters schema
              type: t.type || "function", // Preserve type
              description: `(Agent) ${updatedAgent.description || updatedAgent.instructions}`, // Update description
            };
          }
          return t;
        });

        if (currentAgentUpdated) {
          return {
            ...agent,
            selectedTools: updatedSelectedTools,
          };
        }
        return agent;
      });

      if (agentsUpdated) {
        await saveAgents(updatedAgents);
      }
    }
  } catch (error) {
    console.error("Error updating agents on agent update:", error);
  }
};

/**
 * Update agent references in sessions when an agent is modified
 * Updates the agent object in selectedTools of all sessions
 * @param {Object} updatedAgent - The updated agent object
 */
export const updateSessionsOnAgentUpdate = async (updatedAgent) => {
  try {
    const sessions = await loadSessions();
    if (sessions && sessions.length > 0) {
      let sessionsUpdated = false;
      const updatedSessions = sessions.map((session) => {
        if (session.selectedTools?.some((t) => t.id === updatedAgent.id && t.isAgent)) {
          sessionsUpdated = true;
          return {
            ...session,
            selectedTools: session.selectedTools.map((t) =>
              t.id === updatedAgent.id && t.isAgent
                ? {
                    ...updatedAgent,
                    isAgent: true,
                    parameters: t.parameters, // Preserve existing parameters schema
                    type: t.type || "function", // Preserve type
                    description: `(Agent) ${updatedAgent.description || updatedAgent.instructions}`, // Update description
                  }
                : t
            ),
          };
        }
        return session;
      });

      if (sessionsUpdated) {
        await saveSessions(updatedSessions);
      }
    }
  } catch (error) {
    console.error("Error updating sessions on agent update:", error);
  }
};

/**
 * Update agent references in sessions when an agent is deleted
 * Removes the deleted agent from selectedTools of all sessions
 * @param {number} agentId - The agent ID that was deleted
 */
export const updateSessionsOnAgentDelete = async (agentId) => {
  try {
    const sessions = await loadSessions();
    if (sessions && sessions.length > 0) {
      let sessionsUpdated = false;
      const updatedSessions = sessions.map((session) => {
        if (session.selectedTools?.some((t) => t.id === agentId && t.isAgent)) {
          sessionsUpdated = true;
          return {
            ...session,
            selectedTools: session.selectedTools.filter((t) => !(t.id === agentId && t.isAgent)),
          };
        }
        return session;
      });

      if (sessionsUpdated) {
        await saveSessions(updatedSessions);
      }
    }
  } catch (error) {
    console.error("Error updating sessions on agent delete:", error);
  }
};

/**
 * Update tool name references in agent chat messages when a tool is renamed
 * Updates:
 * - toolName field in messages (for tool execution results)
 * - toolCalls function names (when AI calls the tool)
 * @param {string} oldToolName - The old tool name
 * @param {string} newToolName - The new tool name
 */
export const updateChatMessagesOnToolRename = async (oldToolName, newToolName) => {
  try {
    const agents = await loadAgents();
    if (agents && agents.length > 0) {
      let agentsUpdated = false;
      const updatedAgents = agents.map((agent) => {
        if (agent.chatMessages && agent.chatMessages.length > 0) {
          const updatedMessages = agent.chatMessages.map((msg) => {
            let messageUpdated = false;
            let updatedMsg = { ...msg };

            // Update toolName field (for TOOL role messages)
            if (msg.toolName === oldToolName) {
              updatedMsg.toolName = newToolName;
              messageUpdated = true;
            }

            // Update toolCalls array (for ASSISTANT messages that call tools)
            if (msg.toolCalls && msg.toolCalls.length > 0) {
              const updatedToolCalls = msg.toolCalls.map((toolCall) => {
                if (toolCall.function?.name === oldToolName) {
                  messageUpdated = true;
                  return {
                    ...toolCall,
                    function: {
                      ...toolCall.function,
                      name: newToolName,
                    },
                  };
                }
                return toolCall;
              });

              if (messageUpdated) {
                updatedMsg.toolCalls = updatedToolCalls;
              }
            }

            if (messageUpdated) {
              agentsUpdated = true;
              return updatedMsg;
            }
            return msg;
          });

          if (JSON.stringify(updatedMessages) !== JSON.stringify(agent.chatMessages)) {
            return {
              ...agent,
              chatMessages: updatedMessages,
            };
          }
        }
        return agent;
      });

      if (agentsUpdated) {
        await saveAgents(updatedAgents);
      }
    }
  } catch (error) {
    console.error("Error updating chat messages on tool rename:", error);
  }
};

/**
 * Update tool name references in agent chat messages when an agent is renamed
 * Since agents can be used as tools, their name changes need to propagate to chat history
 * Updates:
 * - toolName field in messages (for tool execution results)
 * - toolCalls function names (when AI calls the agent as a tool)
 * @param {string} oldAgentName - The old agent name
 * @param {string} newAgentName - The new agent name
 */
export const updateChatMessagesOnAgentRename = async (oldAgentName, newAgentName) => {
  try {
    const agents = await loadAgents();
    if (agents && agents.length > 0) {
      let agentsUpdated = false;
      const updatedAgents = agents.map((agent) => {
        if (agent.chatMessages && agent.chatMessages.length > 0) {
          const updatedMessages = agent.chatMessages.map((msg) => {
            let messageUpdated = false;
            let updatedMsg = { ...msg };

            // Update toolName field (for TOOL role messages)
            if (msg.toolName === oldAgentName) {
              updatedMsg.toolName = newAgentName;
              messageUpdated = true;
            }

            // Update toolCalls array (for ASSISTANT messages that call tools)
            if (msg.toolCalls && msg.toolCalls.length > 0) {
              const updatedToolCalls = msg.toolCalls.map((toolCall) => {
                if (toolCall.function?.name === oldAgentName) {
                  messageUpdated = true;
                  return {
                    ...toolCall,
                    function: {
                      ...toolCall.function,
                      name: newAgentName,
                    },
                  };
                }
                return toolCall;
              });

              if (messageUpdated) {
                updatedMsg.toolCalls = updatedToolCalls;
              }
            }

            if (messageUpdated) {
              agentsUpdated = true;
              return updatedMsg;
            }
            return msg;
          });

          if (JSON.stringify(updatedMessages) !== JSON.stringify(agent.chatMessages)) {
            return {
              ...agent,
              chatMessages: updatedMessages,
            };
          }
        }
        return agent;
      });

      if (agentsUpdated) {
        await saveAgents(updatedAgents);
      }
    }
  } catch (error) {
    console.error("Error updating chat messages on agent rename:", error);
  }
};

/**
 * Update tool name references in contexts when a tool is renamed
 * Updates toolName field in context messages where tools were called
 * @param {string} oldToolName - The old tool name
 * @param {string} newToolName - The new tool name
 */
export const updateContextsOnToolRename = async (oldToolName, newToolName) => {
  try {
    console.log(
      `[updateContextsOnToolRename] Updating tool name from "${oldToolName}" to "${newToolName}"`
    );
    const contexts = await loadContexts();
    if (contexts && contexts.length > 0) {
      let contextsUpdated = false;
      const updatedContexts = contexts.map((context) => {
        if (context.messages && context.messages.length > 0) {
          const updatedMessages = context.messages.map((msg) => {
            if (msg.toolName === oldToolName) {
              console.log(
                `[updateContextsOnToolRename] Found match in context "${context.name}", message role: ${msg.role}`
              );
              contextsUpdated = true;
              return {
                ...msg,
                toolName: newToolName,
              };
            }
            return msg;
          });

          if (JSON.stringify(updatedMessages) !== JSON.stringify(context.messages)) {
            return {
              ...context,
              messages: updatedMessages,
            };
          }
        }
        return context;
      });

      if (contextsUpdated) {
        console.log(
          `[updateContextsOnToolRename] Saving ${updatedContexts.length} updated contexts`
        );
        await saveContexts(updatedContexts);
      } else {
        console.log(`[updateContextsOnToolRename] No contexts required updates`);
      }
    }
  } catch (error) {
    console.error("Error updating contexts on tool rename:", error);
  }
};

/**
 * Update tool name references in contexts when an agent is renamed
 * Since agents can be used as tools, their name changes need to propagate to contexts
 * @param {string} oldAgentName - The old agent name
 * @param {string} newAgentName - The new agent name
 */
export const updateContextsOnAgentRename = async (oldAgentName, newAgentName) => {
  try {
    console.log(
      `[updateContextsOnAgentRename] Updating agent name from "${oldAgentName}" to "${newAgentName}"`
    );
    const contexts = await loadContexts();
    if (contexts && contexts.length > 0) {
      let contextsUpdated = false;
      const updatedContexts = contexts.map((context) => {
        if (context.messages && context.messages.length > 0) {
          const updatedMessages = context.messages.map((msg) => {
            if (msg.toolName === oldAgentName) {
              console.log(
                `[updateContextsOnAgentRename] Found match in context "${context.name}", message role: ${msg.role}`
              );
              contextsUpdated = true;
              return {
                ...msg,
                toolName: newAgentName,
              };
            }
            return msg;
          });

          if (JSON.stringify(updatedMessages) !== JSON.stringify(context.messages)) {
            return {
              ...context,
              messages: updatedMessages,
            };
          }
        }
        return context;
      });

      if (contextsUpdated) {
        console.log(
          `[updateContextsOnAgentRename] Saving ${updatedContexts.length} updated contexts`
        );
        await saveContexts(updatedContexts);
      } else {
        console.log(`[updateContextsOnAgentRename] No contexts required updates`);
      }
    }
  } catch (error) {
    console.error("Error updating contexts on agent rename:", error);
  }
};

/*************** LOW-LEVEL STORAGE ACCESS **************/

/**
 * Get a single item from storage
 * @param {string} key - The storage key
 * @returns {string|null} - The stored value or null
 */
export const getStorageItem = async (key) => {
  try {
    return await storage.getItem(key);
  } catch (error) {
    console.error(`Error getting storage item ${key}:`, error);
    return null;
  }
};

/**
 * Set a single item in storage
 * @param {string} key - The storage key
 * @param {string} value - The value to store
 */
export const setStorageItem = async (key, value) => {
  try {
    await storage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting storage item ${key}:`, error);
  }
};

/**
 * Remove a single item from storage
 * @param {string} key - The storage key
 */
export const removeStorageItem = async (key) => {
  try {
    await storage.removeItem(key);
  } catch (error) {
    console.error(`Error removing storage item ${key}:`, error);
  }
};

/**
 * Clear all storage
 */
export const clearStorage = async () => {
  try {
    await storage.clear();
  } catch (error) {
    console.error("Error clearing storage:", error);
  }
};

/*************** MCP SERVERS **************/

/**
 * Load MCP servers from storage
 * @returns {Promise<Array>} - Array of MCP server configurations
 */
export const loadMCPServers = async () => {
  try {
    const serversJson = await storage.getItem(STORAGE_KEYS.MCP_SERVERS);
    if (!serversJson) return [];
    return JSON.parse(serversJson);
  } catch (error) {
    console.error("Error loading MCP servers:", error);
    return [];
  }
};

/**
 * Save multiple MCP servers (batch save for import/restore)
 * @param {Array} servers - Array of MCP server configs
 * @returns {Promise<void>}
 */
export const saveMCPServers = async (servers) => {
  try {
    await storage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify(servers || []));
  } catch (error) {
    console.error("Error saving MCP servers:", error);
    throw error;
  }
};

/**
 * Save an MCP server configuration
 * @param {Object} server - MCP server config {name, url, headers, timestamp}
 * @returns {Promise<Array>} - Updated array of MCP servers
 */
export const saveMCPServer = async (server) => {
  try {
    const existingServers = await loadMCPServers();

    if (server.id) {
      // Update existing server
      const index = existingServers.findIndex((s) => s.id === server.id);
      if (index !== -1) {
        existingServers[index] = {
          ...existingServers[index],
          ...server,
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      // Create new server
      const newServer = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        name: server.name,
        url: server.url,
        headers: server.headers || {},
        status: "disconnected",
        toolCount: 0,
        lastError: null,
      };
      existingServers.unshift(newServer);
    }

    await storage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify(existingServers));
    return existingServers;
  } catch (error) {
    console.error("Error saving MCP server:", error);
    return [];
  }
};

/**
 * Delete an MCP server by ID
 * @param {number} id - The server ID to delete
 * @returns {Promise<Array>} - The updated servers array
 */
export const deleteMCPServer = async (id) => {
  try {
    const servers = await loadMCPServers();
    const updatedServers = servers.filter((server) => server.id !== id);
    await storage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify(updatedServers));
    return updatedServers;
  } catch (error) {
    console.error("Error deleting MCP server:", error);
    return [];
  }
};

/**
 * Clear all MCP servers
 * @returns {Promise<Array>} - Empty array
 */
export const clearAllMCPServers = async () => {
  try {
    await storage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify([]));
    return [];
  } catch (error) {
    console.error("Error clearing all MCP servers:", error);
    return [];
  }
};

/**
 * Update MCP server status
 * @param {number} id - Server ID
 * @param {Object} statusData - Status data {status, toolCount, lastError}
 * @returns {Promise<Array>} - Updated array of MCP servers
 */
export const updateMCPServerStatus = async (id, statusData) => {
  try {
    const servers = await loadMCPServers();
    const index = servers.findIndex((s) => s.id === id);

    if (index !== -1) {
      servers[index] = {
        ...servers[index],
        ...statusData,
        lastUpdated: new Date().toISOString(),
      };
      await storage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify(servers));
    }

    return servers;
  } catch (error) {
    console.error("Error updating MCP server status:", error);
    return [];
  }
};

/**
 * Load all MCP tools from all connected servers
 * Returns tools with MCP metadata (serverId, serverName, isMCP flag)
 * @returns {Promise<Array>} - Array of MCP tools
 */
export const loadAllMCPTools = async () => {
  try {
    const servers = await loadMCPServers();
    const mcpTools = [];

    for (const server of servers) {
      if (server.tools && Array.isArray(server.tools)) {
        // Convert each MCP tool to our format
        server.tools.forEach((tool) => {
          mcpTools.push({
            id: `mcp_${server.id}_${tool.name}`,
            name: tool.name,
            description: tool.description || "",
            parameters: tool.inputSchema || {},
            isMCP: true,
            mcpServerId: server.id,
            mcpServerName: server.name,
            type: "function",
            // Store the original MCP tool for reference
            _mcpTool: tool,
          });
        });
      }
    }

    return mcpTools;
  } catch (error) {
    console.error("Error loading MCP tools:", error);
    return [];
  }
};
