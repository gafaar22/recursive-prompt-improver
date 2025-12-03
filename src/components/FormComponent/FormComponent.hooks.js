import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@context/SettingsContext";
import { useToast } from "@context/ToastContext";
import { useConfirm } from "@context/ConfirmContext";
import { usePrompt } from "@context/PromptContext";
import { useLoading } from "@context/LoadingContext";
import { useDebounceEffect } from "@hooks";
import { CORE } from "@core/MAIN";
import { RAG } from "@core/RAG";
import { executeTool } from "@utils/toolUtils";
import {
  getDefaultModel,
  getInitialFormData,
  createEmptyTestPair,
  cloneTestPair,
  findAffectedTestsByToolRemoval,
  updateTestPairsRemovingTools,
  generateStartLogMessage,
  cleanFormData,
  doesLastSessionMatch,
  formatModelWithProvider,
} from "./FormComponent.utils";
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  saveSession,
  saveOutputToLocalStorage,
  loadOutputFromLocalStorage,
  clearOutputFromLocalStorage,
  loadContexts,
  loadSessions,
  loadTools,
  loadPreviousInstructions,
  savePreviousInstructions,
  loadImprovedInstructions,
  saveImprovedInstructions,
  clearImprovedInstructions,
  clearInstructionHistory,
  saveAgent,
  loadAgents,
  loadAllMCPTools,
  loadKnowledgeBases,
} from "@utils/storageUtils";
import { DEFAULT_CHECK_TYPES, CHECK_TYPES, ROLES } from "@utils/constants";
import { isImproveDisabled, getAllAvailableModels, validateAgentName } from "@utils/uiUtils";

export const useFormComponent = () => {
  const { settings } = useSettings();
  const { showSuccess, showError, showInfo } = useToast();
  const { confirm } = useConfirm();
  const { prompt } = usePrompt();
  const navigate = useNavigate();
  const {
    isLoading,
    setIsLoading,
    logs,
    logger: contextLogger,
    clearLogs,
    currentIteration,
    setCurrentIteration,
  } = useLoading();

  const outputLog = useRef();
  const isInitialMount = useRef(true);
  const logQueue = useRef(Promise.resolve());

  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [fillingOutputIndex, setFillingOutputIndex] = useState(null);
  const [error, setError] = useState("");
  const [instructionsRows, setInstructionsRows] = useState(4);
  const [testPairRowFocused, setTestPairRowFocused] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [tools, setTools] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedTestIdx, setSelectedTestIdx] = useState(null);
  const [isTestSettingsOpen, setIsTestSettingsOpen] = useState(false);
  const [lastSessionScores, setLastSessionScores] = useState({});
  const [previousInstructions, setPreviousInstructions] = useState(null);
  const [improvedInstructions, setImprovedInstructions] = useState(null);
  const [formData, setFormData] = useState(
    getInitialFormData(settings.providers, settings.defaultProviderId)
  );

  const allAvailableModels = getAllAvailableModels(settings.providers);

  const logger = (value, subvalue = "") => {
    contextLogger(value, subvalue);
    logQueue.current = logQueue.current.then(async () => {
      const savedLogs = await loadOutputFromLocalStorage();
      const newOutput = `${savedLogs}\n${value}\n${subvalue}\n__________________________________________\n`;
      await saveOutputToLocalStorage(newOutput);
    });
  };

  const handleChange = (field, value, index = null) => {
    if (index !== null && field.includes(".")) {
      const [, childField] = field.split(".");
      setFormData((prevData) => {
        const updatedPairs = [...prevData.inOutPairs];
        updatedPairs[index] = {
          ...updatedPairs[index],
          [childField]: value,
        };
        return {
          ...prevData,
          inOutPairs: updatedPairs,
        };
      });
    } else {
      setFormData({
        ...formData,
        [field]: value,
      });
    }
  };

  const handleAddInOutPair = () => {
    setFormData((prevData) => ({
      ...prevData,
      inOutPairs: [...prevData.inOutPairs, createEmptyTestPair()],
    }));
  };

  const handleTestSettingsChange = (testIndex, field, value) => {
    setFormData((prevData) => {
      const updatedPairs = [...prevData.inOutPairs];
      updatedPairs[testIndex] = {
        ...updatedPairs[testIndex],
        settings: {
          ...updatedPairs[testIndex].settings,
          [field]: value,
        },
      };
      return {
        ...prevData,
        inOutPairs: updatedPairs,
      };
    });
  };

  const handleTestContextChange = (testIndex, context) => {
    handleTestSettingsChange(testIndex, "context", context);
  };

  const handleTestKnowledgeBasesChange = (testIndex, knowledgeBasesArr) => {
    handleTestSettingsChange(testIndex, "knowledgeBases", knowledgeBasesArr);
  };

  const handleFillOutput = async (testIndex) => {
    const pair = formData.inOutPairs[testIndex];

    if (!pair.in.trim()) {
      showError("Empty input", "Test input is required to generate output");
      return;
    }

    if (!formData.instructions.trim()) {
      showError("Empty instructions", "Instructions are required to generate output");
      return;
    }

    setFillingOutputIndex(testIndex);
    try {
      const testModel = pair.settings?.model || formData?.coreModel;

      if (!testModel) {
        showError("No model", "Please select a model to generate output");
        return;
      }

      const tools = formData.selectedTools || [];
      const contextMessages = pair.settings?.context?.messages || [];
      const initialMessages = contextMessages.map((msg) => ({
        role: msg.role,
        content: msg.message,
        toolId: msg.toolId || "",
        toolName: msg.toolName || "",
        toolCalls: msg.toolCalls || [],
      }));

      const maxIterations = settings.maxToolIterations || 5;

      const result = await CORE.executeConversationalLoop({
        systemPrompt: formData.instructions,
        userMessage: pair.in,
        modelId: testModel.id,
        providerId: testModel.providerId,
        initialMessages,
        tools,
        availableTools: tools,
        ROLES,
        maxIterations,
        onMessageUpdate: () => {},
        executeToolFn: (toolCall, availableTools, timeout) =>
          executeTool(toolCall, availableTools, timeout),
        timeLimit: settings.time_limit || 60000,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to generate output");
      }

      const lastAssistantMessage = result.messages
        .filter((msg) => msg.role === ROLES.ASSISTANT)
        .pop();

      if (!lastAssistantMessage) {
        throw new Error("No response generated");
      }

      handleChange("inOutPairs.out", lastAssistantMessage.content, testIndex);
      showSuccess("Output generated", "Test output has been filled successfully");
    } catch (error) {
      console.error("Error filling output:", error);
      const errorMessage =
        typeof error === "string" ? error : error?.message || "An error occurred";
      showError("Failed to generate output", errorMessage);
    } finally {
      setFillingOutputIndex(null);
    }
  };

  const handleToolsChange = async (selectedItems) => {
    const newToolIds = new Set(selectedItems.map((t) => t.id));
    const removedTools = formData.selectedTools.filter((t) => !newToolIds.has(t.id));

    if (removedTools.length > 0) {
      const affectedTests = findAffectedTestsByToolRemoval(formData.inOutPairs, removedTools);

      if (affectedTests.length > 0) {
        const isConfirmed = await confirm({
          title: "Remove Tool and Update Tests",
          body: `Removing ${removedTools.length > 1 ? "these tools" : "this tool"} will also remove the 'Tools call' check from test${affectedTests.length > 1 ? "s" : ""}: ${affectedTests.join(", ")}. Do you want to continue?`,
          confirmText: "Remove",
          cancelText: "Cancel",
          variant: "danger",
        });

        if (!isConfirmed) return;

        setFormData((prevData) => ({
          ...prevData,
          inOutPairs: updateTestPairsRemovingTools(prevData.inOutPairs, removedTools),
          selectedTools: selectedItems,
        }));
      } else {
        handleChange("selectedTools", selectedItems);
      }
    } else {
      handleChange("selectedTools", selectedItems);
    }
  };

  const handleRemoveInOutPair = async (index) => {
    if (formData.inOutPairs.length <= 1) return;

    const pair = formData.inOutPairs[index];
    const hasContent = pair.in.trim() || pair.out.trim();

    let isConfirmed = true;
    if (hasContent) {
      isConfirmed = await confirm({
        title: "Remove Test Pair",
        body: `Are you sure you want to remove ${index + 1}° pair?`,
        confirmText: "Remove",
        cancelText: "Cancel",
        variant: "danger",
      });
    }

    if (isConfirmed) {
      setFormData((prevData) => {
        const updatedPairs = [...prevData.inOutPairs];
        updatedPairs.splice(index, 1);
        return {
          ...prevData,
          inOutPairs: updatedPairs,
        };
      });
    }
  };

  const handleDuplicateInOutPair = (index) => {
    const pair = formData.inOutPairs[index];
    const duplicatedPair = cloneTestPair(pair);

    setFormData((prevData) => {
      const updatedPairs = [...prevData.inOutPairs];
      updatedPairs.splice(index + 1, 0, duplicatedPair);
      return {
        ...prevData,
        inOutPairs: updatedPairs,
      };
    });

    showSuccess("Test duplicated", `Test ${index + 1} duplicated to test ${index + 2}`);
  };

  const handleClearForm = async () => {
    const isConfirmed = await confirm({
      title: "Clear Form",
      body: "Are you sure you want to clear the form? All data will be lost.",
      confirmText: "Clear",
      cancelText: "Cancel",
      variant: "danger",
    });

    if (isConfirmed) {
      clearLocalStorage();
      await clearInstructionHistory();
      setPreviousInstructions(null);
      setImprovedInstructions(null);
      setFormData(getInitialFormData(settings.providers, settings.defaultProviderId));
      showInfo("Form cleared", "All form data has been reset");
    }
  };

  const handleImprovePrompt = async () => {
    const isGenerating = !formData.instructions.trim();

    const feedback = await prompt({
      title: isGenerating ? "Generate Instructions" : "Improve Instructions",
      body: isGenerating
        ? "Describe what you want the assistant to do:"
        : "Provide feedback or requirements to improve the current assistant:",
      placeholder: isGenerating
        ? "Example: Create a prompt that helps users write professional emails"
        : "Example: Make it more concise, add error handling instructions, etc.",
      confirmText: isGenerating ? "Generate" : "Improve",
      cancelText: "Cancel",
      initialValue: "",
      rows: 6,
    });

    if (feedback) {
      setIsImprovingPrompt(true);
      try {
        const previous = formData.instructions;
        setPreviousInstructions(previous);
        await savePreviousInstructions(previous);
        setImprovedInstructions(null);
        await clearImprovedInstructions();

        const final = await CORE.improvePromptByFeedback(formData.instructions, feedback);
        if (final) {
          setImprovedInstructions(final);
          await saveImprovedInstructions(final);
          setFormData((prevData) => ({
            ...prevData,
            instructions: final || formData.instructions,
          }));
          showSuccess(
            "Completed",
            isGenerating
              ? "System prompt generated based on your description"
              : "System prompt improved based on your feedback",
            4000
          );
        }
      } catch (error) {
        console.log(error);
        setPreviousInstructions(null);
        setImprovedInstructions(null);
        await clearInstructionHistory();
        if (error.name === "AbortError") {
          showError(
            "Operation stopped",
            isGenerating ? "Generation has been aborted" : "Improving has been aborted"
          );
        } else {
          const errorMessage =
            typeof error === "string" ? error : error?.message || "An error occurred";
          showError("Processing failed", errorMessage);
        }
      }
      setIsImprovingPrompt(false);
    }
  };

  const handleUndoImprove = () => {
    if (previousInstructions !== null) {
      setFormData((prevData) => ({
        ...prevData,
        instructions: previousInstructions,
      }));
      showInfo("Restored", "Previous system prompt has been restored");
    }
  };

  const handleRedoImprove = () => {
    if (improvedInstructions !== null) {
      setFormData((prevData) => ({
        ...prevData,
        instructions: improvedInstructions,
      }));
      showInfo("Restored", "Improved system prompt has been restored");
    }
  };

  const handleSaveAsAgent = async () => {
    if (!formData.instructions.trim()) {
      showError("Empty instructions", "Instructions are required to save as agent");
      return;
    }

    if (!formData.coreModel) {
      showError("No model", "Please select a model to save as agent");
      return;
    }

    // Load existing agents for validation
    const existingAgents = await loadAgents();

    const agentName = await prompt({
      title: "Save as Agent",
      body: "Enter a name for this agent",
      placeholder: "e.g., Email_Assistant, Code_Reviewer, etc.",
      confirmText: "Save",
      cancelText: "Cancel",
      initialValue: "",
      rows: 1,
      helperText:
        "1-64 characters, must start with a letter, can contain letters, numbers, hyphens, and underscores",
      validate: (name) => validateAgentName(name, existingAgents),
    });

    if (agentName && agentName.trim()) {
      try {
        const agentData = {
          id: Date.now().toString(),
          name: agentName.trim(),
          instructions: formData.instructions,
          selectedTools: formData.selectedTools || [],
          coreModel: formData.coreModel,
          useJsonOutput: false,
          useJsonSchema: false,
          jsonSchema: "",
          jsonSchemaStrict: false,
          chatMessages: [],
        };

        await saveAgent(agentData);
        showSuccess("Agent saved", `Agent "${agentName.trim()}" has been saved successfully`);
      } catch (error) {
        console.error("Error saving agent:", error);
        const errorMessage =
          typeof error === "string" ? error : error?.message || "An error occurred";
        showError("Failed to save agent", errorMessage);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCurrentIteration(0);
    setError("");
    clearLogs();
    await saveOutputToLocalStorage("");
    setIsLoading(true);

    const cleanedFormData = {
      ...cleanFormData(formData),
      maxToolIterations: settings.maxToolIterations || 5,
      timeLimit: settings.time_limit || 60000,
    };

    await saveToLocalStorage(cleanedFormData);
    showInfo("Processing started", `Running with ${cleanedFormData?.coreModel?.text} model`);

    logger(generateStartLogMessage(cleanedFormData));

    try {
      const start = new Date();
      const final = await CORE.run(cleanedFormData, logger, setCurrentIteration);
      saveSession(cleanedFormData, final?.results, final?.tests);
      const end = new Date();
      const executionTime = parseInt((end - start) / 1000);

      logger(
        `🏁 END - ${
          isImproveDisabled(formData.improveMode) ? "Testing" : `${formData.iterations} iterations`
        } - ✅ Completed successfully in ${executionTime} seconds`
      );

      showSuccess(
        "Processing completed",
        `${
          isImproveDisabled(formData.improveMode) ? "Testing" : `${formData.iterations} iterations`
        } in ${executionTime} seconds`,
        8000,
        "/sessions",
        "Click to view in sessions"
      );
    } catch (error) {
      console.log(error);
      if (error.name === "AbortError") {
        showError("Operation stopped", "Processing has been aborted");
      } else {
        const errorMessage =
          typeof error === "string" ? error : error?.message || "An error occurred";
        setError(errorMessage);
        logger(`🚨 ERROR: ${errorMessage}`);
        showError("Processing failed", errorMessage);
      }
    }
    setIsLoading(false);
  };

  const loadLastSessionScores = async () => {
    const allSessions = await loadSessions();
    const lastSession = allSessions?.[0];
    if (!lastSession || lastSession.improveMode !== false) {
      setLastSessionScores({});
      return;
    }

    const scores = {};
    formData.inOutPairs.forEach((currentPair, testIndex) => {
      const lastSessionTest = lastSession.tests?.[0]?.[testIndex];
      const lastSessionPair = lastSession.inOutPairs?.[testIndex];

      if (
        doesLastSessionMatch(
          currentPair,
          lastSessionPair,
          lastSessionTest,
          formData.instructions,
          lastSession.instructions,
          formData.selectedTools,
          lastSession.selectedTools
        )
      ) {
        const currentCheckTypes = currentPair.settings?.checkTypes || DEFAULT_CHECK_TYPES;
        const currentHasJsonCheck = currentCheckTypes.includes(CHECK_TYPES.JSON_VALID.id);
        const currentHasToolsCallCheck = currentCheckTypes.includes(CHECK_TYPES.TOOLS_CALL.id);

        scores[testIndex] = {
          test: lastSessionTest,
          hasJsonCheck: currentHasJsonCheck,
          hasToolsCallCheck: currentHasToolsCallCheck,
        };
      }
    });

    setLastSessionScores(scores);
  };

  const getLastSessionScoreByTestIndex = (testIndex) => {
    return lastSessionScores[testIndex] || null;
  };

  useDebounceEffect(
    () => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      saveToLocalStorage(formData);
    },
    500,
    [JSON.stringify(formData)]
  );

  useEffect(() => {
    if (outputLog?.current) {
      outputLog?.current?.scrollTo({
        top: outputLog.current.scrollHeight,
        left: 0,
        behavior: "smooth",
      });
    }
  }, [logs]);

  useEffect(() => {
    if (isLoading) {
      setIsFullscreen(true);
    } else {
      if (isFullscreen) setIsFullscreen(false);
    }
    const handleBeforeUnload = (e) => {
      if (isLoading) {
        e.preventDefault();
        e.returnValue = "A session is running. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isLoading]);

  useEffect(() => {
    if (isFullscreen) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  }, [isFullscreen]);

  useEffect(() => {
    setTimeout(async () => {
      await loadLastSessionScores();
    }, 1000);
  }, [JSON.stringify(formData?.inOutPairs), isLoading]);

  useEffect(() => {
    if (isInitialMount.current) return;

    if (settings.providers && settings.providers.length > 0) {
      const newDefaultModel = getDefaultModel(settings.providers, settings.defaultProviderId);
      const isCurrentModelValid = allAvailableModels.some(
        (m) => m.id === formData.coreModel?.id && m.providerId === formData.coreModel?.providerId
      );

      if (!isCurrentModelValid) {
        setFormData((prevData) => ({
          ...prevData,
          coreModel: newDefaultModel,
        }));
      }
    }
  }, [JSON.stringify(settings.providers), settings.defaultProviderId]);

  useEffect(() => {
    const loadSavedData = async () => {
      setIsLoadingForm(true);
      const savedData = await loadFromLocalStorage();
      if (savedData) {
        setFormData((prevData) => ({
          ...prevData,
          instructions: savedData.instructions || "",
          inOutPairs: (
            savedData.inOutPairs || [
              {
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
              },
            ]
          ).map((pair) => ({
            ...pair,
            settings: {
              context: pair.settings?.context || null,
              checkTypes: pair.settings?.checkTypes || DEFAULT_CHECK_TYPES,
              model: formatModelWithProvider(pair.settings?.model, settings.providers),
              embeddingModel: formatModelWithProvider(
                pair.settings?.embeddingModel,
                settings.providers
              ),
              useJsonSchema: pair.settings?.useJsonSchema || false,
              jsonSchema: pair.settings?.jsonSchema || "",
              jsonSchemaStrict: pair.settings?.jsonSchemaStrict || false,
              toolsCalled: pair.settings?.toolsCalled || [],
              knowledgeBases: pair.settings?.knowledgeBases || [],
              images: pair.settings?.images || [],
            },
          })),
          iterations: savedData.iterations || 1,
          coreModel: formatModelWithProvider(
            savedData.coreModel ||
              savedData.selectedModel ||
              getDefaultModel(settings.providers, settings.defaultProviderId),
            settings.providers
          ),
          improveMode: savedData.improveMode !== undefined ? savedData.improveMode : true,
          selectedTools: savedData.selectedTools || [],
          chatMessages: savedData.chatMessages || [],
        }));
      }

      const savedPrevious = await loadPreviousInstructions();
      const savedImproved = await loadImprovedInstructions();
      if (savedPrevious) {
        setPreviousInstructions(savedPrevious);
      }
      if (savedImproved) {
        setImprovedInstructions(savedImproved);
      }

      setContexts(await loadContexts());

      // Load knowledge bases and filter to only indexed ones
      const allKnowledgeBases = await loadKnowledgeBases();
      const indexedKnowledgeBases = allKnowledgeBases.filter((kb) => RAG.isIndexed(kb));
      setKnowledgeBases(indexedKnowledgeBases);

      const loadedTools = await loadTools();
      const loadedAgents = await loadAgents();
      const loadedMCPTools = await loadAllMCPTools();
      // Combine tools, agents, and MCP tools for display
      const combinedTools = [
        ...loadedTools,
        ...loadedAgents.map((agent) => ({
          ...agent,
          isAgent: true,
        })),
        ...loadedMCPTools,
      ];
      setTools(combinedTools);

      if (savedData?.selectedTools && savedData.selectedTools.length > 0) {
        const updatedSelectedTools = savedData.selectedTools
          .map((selectedTool) => {
            const freshTool = combinedTools.find((t) => t.id === selectedTool.id);
            return freshTool || null;
          })
          .filter(Boolean);

        setFormData((prev) => ({
          ...prev,
          selectedTools: updatedSelectedTools,
        }));
      }

      setTimeout(() => setIsLoadingForm(false), 300);
    };
    loadSavedData();
  }, []);

  return {
    // State
    formData,
    isLoading,
    isLoadingForm,
    isImprovingPrompt,
    isFullscreen,
    isDiffModalOpen,
    isChatModalOpen,
    fillingOutputIndex,
    error,
    instructionsRows,
    testPairRowFocused,
    contexts,
    tools,
    knowledgeBases,
    selectedTestIdx,
    isTestSettingsOpen,
    previousInstructions,
    improvedInstructions,
    logs,
    currentIteration,
    allAvailableModels,
    outputLog,
    settings,
    navigate,

    // State setters
    setFormData,
    setIsFullscreen,
    setIsDiffModalOpen,
    setIsChatModalOpen,
    setInstructionsRows,
    setTestPairRowFocused,
    setSelectedTestIdx,
    setIsTestSettingsOpen,

    // Handlers
    handleChange,
    handleAddInOutPair,
    handleTestSettingsChange,
    handleTestContextChange,
    handleTestKnowledgeBasesChange,
    handleFillOutput,
    handleToolsChange,
    handleRemoveInOutPair,
    handleDuplicateInOutPair,
    handleClearForm,
    handleImprovePrompt,
    handleUndoImprove,
    handleRedoImprove,
    handleSaveAsAgent,
    handleSubmit,
    getLastSessionScoreByTestIndex,

    // Utils
    showError,
    showInfo,
    clearLogs,
    clearOutputFromLocalStorage,
    logger,
  };
};
