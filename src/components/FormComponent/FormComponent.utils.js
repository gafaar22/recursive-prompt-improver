import { DEFAULT_CHECK_TYPES, CHECK_TYPES, ROLES, MODEL_ITEMS } from "@utils/constants";
import { isImproveDisabled } from "@utils/uiUtils";

/**
 * Format a model object with provider information
 * @param {Object} model - The model object to format
 * @param {Array} providers - Array of provider objects
 * @returns {Object} Model with provider name included in text
 */
export const formatModelWithProvider = (model, providers) => {
  if (!model || !providers || providers.length === 0) {
    return model;
  }

  // If model already has formatted provider info, return as is
  if (model.providerName && model.text && model.text.includes(`(${model.providerName})`)) {
    return model;
  }

  // Find the provider for this model
  let provider = null;
  if (model.providerId) {
    provider = providers.find((p) => p.id === model.providerId);
  }

  // If we still don't have a provider, try to find by model name
  if (!provider && model.providerName) {
    provider = providers.find((p) => p.name === model.providerName);
  }

  if (!provider) {
    // Can't find provider, return model with its existing providerName if available
    if (model.providerName && !model.text.includes(`(${model.providerName})`)) {
      const originalText = model.originalText || model.text;
      return {
        ...model,
        text: `${originalText} (${model.providerName})`,
        originalText: originalText,
      };
    }
    return model;
  }

  // Format with provider name
  const originalText = model.originalText || model.text;
  return {
    ...model,
    providerId: provider.id,
    providerName: provider.name,
    text: `${originalText} (${provider.name})`,
    originalText: originalText,
  };
};

/**
 * Get default model from default provider with provider name included
 */
export const getDefaultModel = (providers, defaultProviderId) => {
  if (!providers || providers.length === 0) {
    return MODEL_ITEMS[0];
  }
  const defaultProvider = providers.find((p) => p.id === defaultProviderId);
  const provider = defaultProvider || providers[0];
  const selectedModel = provider?.selectedModel;

  if (!selectedModel) {
    return MODEL_ITEMS[0];
  }

  // If model already has provider info, return as is
  if (selectedModel.providerName || selectedModel.providerId) {
    return selectedModel;
  }

  // Format model with provider name
  return {
    ...selectedModel,
    providerId: provider.id,
    providerName: provider.name,
    text: `${selectedModel.text} (${provider.name})`,
    originalText: selectedModel.text,
  };
};

/**
 * Get default embedding model from default provider with provider name included
 */
export const getDefaultEmbeddingModel = (providers, defaultProviderId) => {
  if (!providers || providers.length === 0) {
    return null;
  }
  const defaultProvider = providers.find((p) => p.id === defaultProviderId);
  const provider = defaultProvider || providers[0];
  const selectedEmbeddingModel = provider?.selectedEmbeddingModel;

  if (!selectedEmbeddingModel) {
    return null;
  }

  // If model already has provider info, return as is
  if (selectedEmbeddingModel.providerName || selectedEmbeddingModel.providerId) {
    return selectedEmbeddingModel;
  }

  // Format embedding model with provider name
  return {
    ...selectedEmbeddingModel,
    providerId: provider.id,
    providerName: provider.name,
    text: `${selectedEmbeddingModel.text} (${provider.name})`,
    originalText: selectedEmbeddingModel.text,
  };
};

/**
 * Get initial form data state
 */
export const getInitialFormData = (providers, defaultProviderId) => ({
  instructions: "",
  inOutPairs: [
    {
      in: "",
      out: "",
      settings: {
        context: null,
        checkTypes: DEFAULT_CHECK_TYPES,
        model: null, // null means use core model
        embeddingModel: null, // null means use core embedding model
        useJsonSchema: false,
        jsonSchema: "",
        jsonSchemaStrict: false,
        toolsCalled: [],
        knowledgeBases: [],
        images: [],
      },
    },
  ],
  iterations: 1,
  coreModel: getDefaultModel(providers, defaultProviderId),
  improveMode: false,
  selectedTools: [],
  chatMessages: [],
});

/**
 * Create a new empty test pair
 */
export const createEmptyTestPair = () => ({
  in: "",
  out: "",
  settings: {
    context: null,
    checkTypes: DEFAULT_CHECK_TYPES,
    model: null,
    embeddingModel: null,
    useJsonSchema: false,
    jsonSchema: "",
    jsonSchemaStrict: false,
    toolsCalled: [],
    knowledgeBases: [],
    images: [],
  },
});

/**
 * Deep clone a test pair
 */
export const cloneTestPair = (pair) => ({
  in: pair.in,
  out: pair.out,
  settings: {
    context: pair.settings?.context || null,
    checkTypes: [...(pair.settings?.checkTypes || DEFAULT_CHECK_TYPES)],
    model: pair.settings?.model || null,
    embeddingModel: pair.settings?.embeddingModel || null,
    useJsonSchema: pair.settings?.useJsonSchema || false,
    jsonSchema: pair.settings?.jsonSchema || "",
    jsonSchemaStrict: pair.settings?.jsonSchemaStrict || false,
    // Deep clone toolsCalled array to avoid reference issues
    toolsCalled: (pair.settings?.toolsCalled || []).map((tool) => ({
      ...tool,
    })),
    // Deep clone knowledgeBases array
    knowledgeBases: (pair.settings?.knowledgeBases || []).map((kb) => ({
      ...kb,
    })),
    // Deep clone images array
    images: (pair.settings?.images || []).map((img) => ({
      ...img,
    })),
  },
});

/**
 * Find tests that are affected by tool removal
 */
export const findAffectedTestsByToolRemoval = (inOutPairs, removedTools) => {
  const affectedTests = [];
  inOutPairs.forEach((pair, index) => {
    if (pair.settings?.toolsCalled?.length > 0) {
      const usesRemovedTool = pair.settings.toolsCalled.some((tool) =>
        removedTools.some((removed) => removed.id === tool.id)
      );
      if (usesRemovedTool) {
        affectedTests.push(index + 1);
      }
    }
  });
  return affectedTests;
};

/**
 * Update test pairs by removing specified tools
 */
export const updateTestPairsRemovingTools = (inOutPairs, removedTools) => {
  return inOutPairs.map((pair) => {
    if (pair.settings?.toolsCalled?.length > 0) {
      // Remove the tools from toolsCalled
      const updatedToolsCalled = pair.settings.toolsCalled.filter(
        (tool) => !removedTools.some((removed) => removed.id === tool.id)
      );

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
};

/**
 * Generate the start log message with configuration details
 */
export const generateStartLogMessage = (data) => {
  let log = `🚀 START - ${
    isImproveDisabled(data.improveMode)
      ? "Testing only"
      : `${data.iterations} iterations - Improvement and Testing`
  }\n🧠 CORE MODEL: ${data?.coreModel?.text || data?.coreModel?.originalText || "Unknown"}\n`;

  // Log selected tools if any
  if (data.selectedTools && data.selectedTools.length > 0) {
    log += `\n🛠️  SELECTED TOOLS: ${data.selectedTools.map((t) => t.name || "Unnamed tool").join(", ")}\n`;
  }

  // Log instructions
  log += `\n📋 INSTRUCTIONS:\n${data.instructions}\n`;

  // Log each test with its input, output, and context
  data.inOutPairs.forEach((pair, index) => {
    log += `\n📌 TEST ${index + 1}:`;
    if (pair.settings?.context?.id !== "none" && pair.settings?.context?.messages?.length > 0) {
      log += `\n🔄 CONTEXT: ${pair.settings.context.name} (${pair.settings.context.messages.length} messages)`;
      pair.settings.context.messages.forEach((msg, msgIdx) => {
        log += `\n💬 MSG ${msgIdx + 1} - ${msg.role || ROLES.USER}:\n${msg.message}`;
      });
    }
    // Log tools to verify if any
    if (pair.settings?.toolsCalled && pair.settings.toolsCalled.length > 0) {
      log += `\n🔧 TOOLS TO VERIFY: ${pair.settings.toolsCalled.map((t) => t.name || "Unnamed tool").join(", ")}`;
    }
    log += `\n📤 INPUT:\n${pair.in}`;
    log += `\n📤 EXPECTED:\n${pair.out}\n`;
  });

  return log;
};

/**
 * Clean form data by removing contexts set to "none"
 */
export const cleanFormData = (formData) => ({
  ...formData,
  inOutPairs: formData.inOutPairs.map((pair) => ({
    ...pair,
    settings: {
      ...pair.settings,
      context: pair.settings?.context?.id === "none" ? null : pair.settings.context,
    },
  })),
});

/**
 * Check if last session matches current configuration
 */
export const doesLastSessionMatch = (
  currentPair,
  lastSessionPair,
  lastSessionTest,
  formInstructions,
  lastSessionInstructions,
  currentTools,
  lastSessionTools
) => {
  if (!currentPair || !lastSessionPair || !lastSessionTest) return false;

  // Verify test input matches
  if (currentPair.in?.trim() !== lastSessionPair.in?.trim()) return false;

  // Verify instructions match
  if (formInstructions?.trim() !== lastSessionInstructions?.trim()) return false;

  // Verify selected tools match (compare by id)
  const currentToolsArray = currentTools || [];
  const lastToolsArray = lastSessionTools || [];
  if (currentToolsArray.length !== lastToolsArray.length) return false;
  const currentToolIds = currentToolsArray
    .map((t) => t.id)
    .sort()
    .join(",");
  const lastToolIds = lastToolsArray
    .map((t) => t.id)
    .sort()
    .join(",");
  if (currentToolIds !== lastToolIds) return false;

  // Verify JSON validation settings match if enabled
  const currentCheckTypes = currentPair.settings?.checkTypes || DEFAULT_CHECK_TYPES;
  const lastCheckTypes =
    lastSessionTest.settings?.checkTypes ||
    lastSessionPair.settings?.checkTypes ||
    DEFAULT_CHECK_TYPES;
  const currentHasJsonCheck = currentCheckTypes.includes(CHECK_TYPES.JSON_VALID.id);
  const lastHasJsonCheck = lastCheckTypes.includes(CHECK_TYPES.JSON_VALID.id);
  if (currentHasJsonCheck !== lastHasJsonCheck) return false;

  const currentHasToolsCallCheck = currentCheckTypes.includes(CHECK_TYPES.TOOLS_CALL.id);
  const lastHasToolsCallCheck = lastCheckTypes.includes(CHECK_TYPES.TOOLS_CALL.id);
  if (currentHasToolsCallCheck !== lastHasToolsCallCheck) return false;

  return true;
};

/**
 * Build detailed tooltip content for last session scores
 */
export const buildDetailedTooltipContent = (scoreData) => {
  if (!scoreData) return null;

  const { test, hasJsonCheck, hasToolsCallCheck } = scoreData;
  const lines = ["Last run:"];

  // Equality/Score section
  if (test.isEqual) {
    lines.push("✅ EQUALITY: Perfect match");
  } else {
    lines.push(`🎯 AI SCORE: ${test.aiScore.toFixed(1)}%`);
    if (test.similarity !== null && test.similarity !== undefined) {
      lines.push(`📊 SIMILARITY: ${(test.similarity * 100).toFixed(1)}%`);
    }
  }

  // JSON validation section
  if (hasJsonCheck && test.isJsonValid !== null) {
    if (test.isJsonValid) {
      lines.push("✅ JSON: Valid");
    } else {
      lines.push("❌ JSON: Invalid");
    }
  }

  // Tools call section
  if (hasToolsCallCheck && test.toolsCallResult) {
    const toolsResult = test.toolsCallResult;
    if (toolsResult.success) {
      lines.push(`✅ TOOLS: All ${toolsResult.calledTools?.length || 0} tool(s) called`);
      // Add details for each tool
      if (toolsResult.calledTools && toolsResult.calledTools.length > 0) {
        toolsResult.calledTools.forEach((tool) => {
          lines.push(`  • ${tool.name}`);
          if (tool.argumentsValid !== null) {
            lines.push(`    Args: ${tool.argumentsValid ? "✓ Valid" : "✗ Invalid"}`);
          }
          if (tool.expectedValuesValid !== null) {
            lines.push(`    Values: ${tool.expectedValuesValid ? "✓ Match" : "✗ Mismatch"}`);
          }
        });
      }
    } else {
      lines.push("❌ TOOLS: Verification failed");
      if (toolsResult.missing && toolsResult.missing.length > 0) {
        lines.push(`  Missing: ${toolsResult.missing.join(", ")}`);
      }
      if (toolsResult.calledTools && toolsResult.calledTools.length > 0) {
        lines.push(`  Called: ${toolsResult.calledTools.map((t) => t.name).join(", ")}`);
      }
    }
  }

  return lines;
};

/**
 * Get tools with disabled state based on selected tools (prevent duplicate names)
 */
export const getToolsWithDisabledState = (tools, selectedTools) => {
  const selectedToolNames = new Set(selectedTools.map((tool) => tool.name));
  const selectedToolsById = new Map(selectedTools.map((tool) => [tool.id, tool]));

  return tools.map((tool) => {
    // Determine the tool type/origin for display
    let type = "Tool";
    let origin = "Local";
    if (tool.isAgent) {
      type = "Agent";
      origin = "Local";
    } else if (tool.isMCP) {
      type = "Tool";
      origin = "MCP"; // Show only "MCP" without URL (URL is already in tool name)
    }

    // If this tool is in selectedTools, return the exact same reference with added display fields
    if (selectedToolsById.has(tool.id)) {
      const selectedTool = selectedToolsById.get(tool.id);
      return {
        ...selectedTool,
        type,
        origin,
      };
    }

    // Otherwise, return tool with disabled state and display fields
    return {
      ...tool,
      type,
      origin,
      disabled: selectedToolNames.has(tool.name),
    };
  });
};
