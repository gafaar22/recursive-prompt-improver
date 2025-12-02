import { useCallback } from "react";
import { useSettings } from "@context/SettingsContext";
import { importFromJsonFile, fetchAndUpdateAllProviderModels } from "@utils/uiUtils";
import {
  loadSessions,
  loadContexts,
  loadTools,
  loadAgents,
  loadMCPServers,
  loadKnowledgeBases,
  saveSessions,
  saveContexts,
  saveTools,
  saveAgents,
  saveMCPServers,
  saveKnowledgeBases,
} from "@utils/storageUtils";
import { saveExposedServerConfig } from "@core/MCP";

/**
 * Hook for importing a full backup with all data merging logic
 * @returns {Object} - { importFullBackup }
 */
export const useFullBackupImport = () => {
  const { settings, updateAndSaveSettings } = useSettings();

  /**
   * Process and import backup data
   * @param {Object} importedData - The parsed backup JSON data
   * @param {Object} options - Options for the import
   * @param {Function} options.onStart - Called when import starts
   * @param {Function} options.onSuccess - Called when import succeeds
   * @param {Function} options.onError - Called when import fails with error message
   * @param {Function} options.onComplete - Called when import completes (success or error)
   * @returns {Promise<boolean>} - True if import succeeded
   */
  const processBackupData = useCallback(
    async (importedData, options = {}) => {
      const { onStart, onSuccess, onError, onComplete } = options;

      // Check if it's a full backup (has sessions, contexts, settings)
      const isFullBackup = importedData.sessions && importedData.contexts && importedData.settings;

      // Check if it's a settings-only backup (has providers or other settings fields)
      const isSettingsBackup =
        importedData.providers ||
        importedData.defaultProviderId ||
        importedData.max_tokens ||
        importedData.environmentVariables;

      // Validate the backup structure - accept either full backup or settings backup
      if (!isFullBackup && !isSettingsBackup) {
        onError?.("Invalid backup format. Missing required data.");
        return false;
      }

      onStart?.();

      try {
        // Merge imported sessions with existing sessions (if present in backup)
        const existingSessions = await loadSessions();
        let uniqueSessions = existingSessions;
        if (importedData.sessions) {
          const mergedSessions = [...importedData.sessions, ...existingSessions];
          uniqueSessions = mergedSessions.filter(
            (session, index, self) => index === self.findIndex((s) => s.id === session.id)
          );
        }

        // Merge imported contexts with existing contexts (if present in backup)
        const existingContexts = await loadContexts();
        let uniqueContexts = existingContexts;
        if (importedData.contexts) {
          const mergedContexts = [...importedData.contexts, ...existingContexts];
          uniqueContexts = mergedContexts.filter(
            (context, index, self) => index === self.findIndex((c) => c.id === context.id)
          );
        }

        // Merge imported tools with existing tools (if present in backup)
        const existingTools = await loadTools();
        let uniqueTools = existingTools;
        if (importedData.tools) {
          const mergedTools = [...importedData.tools, ...existingTools];
          uniqueTools = mergedTools.filter(
            (tool, index, self) => index === self.findIndex((t) => t.id === tool.id)
          );
        }

        // Merge imported agents with existing agents (if present in backup)
        const existingAgents = await loadAgents();
        let uniqueAgents = existingAgents;
        if (importedData.agents) {
          const mergedAgents = [...importedData.agents, ...existingAgents];
          uniqueAgents = mergedAgents.filter(
            (agent, index, self) => index === self.findIndex((a) => a.id === agent.id)
          );
        }

        // Merge imported MCP servers with existing servers (if present in backup)
        const existingMcpServers = await loadMCPServers();
        let uniqueMcpServers = existingMcpServers;
        if (importedData.mcpServers) {
          const mergedMcpServers = [...importedData.mcpServers, ...existingMcpServers];
          uniqueMcpServers = mergedMcpServers.filter(
            (server, index, self) => index === self.findIndex((s) => s.id === server.id)
          );
        }

        // Merge imported knowledge bases with existing ones (if present in backup)
        const existingKnowledgeBases = await loadKnowledgeBases();
        let uniqueKnowledgeBases = existingKnowledgeBases;
        if (importedData.knowledgeBases) {
          const mergedKnowledgeBases = [...importedData.knowledgeBases, ...existingKnowledgeBases];
          uniqueKnowledgeBases = mergedKnowledgeBases.filter(
            (kb, index, self) => index === self.findIndex((k) => k.id === kb.id)
          );
        }

        // Store the merged data
        await saveSessions(uniqueSessions);
        await saveContexts(uniqueContexts);
        await saveTools(uniqueTools);
        await saveAgents(uniqueAgents);
        await saveMCPServers(uniqueMcpServers);
        await saveKnowledgeBases(uniqueKnowledgeBases);

        // Import MCP server exposure config (if present in backup)
        if (importedData.mcpServerConfig) {
          await saveExposedServerConfig(importedData.mcpServerConfig);
        }

        // Determine settings source - either from nested settings object (full backup) or root level (settings backup)
        const importedSettings = importedData.settings || importedData;

        // Refetch models for imported providers
        let updatedProviders = importedSettings.providers || settings.providers || [];
        let successCount = 0;
        let failCount = 0;

        if (updatedProviders && updatedProviders.length > 0) {
          const fetchResult = await fetchAndUpdateAllProviderModels(updatedProviders);
          updatedProviders = fetchResult.updatedProviders;
          successCount = fetchResult.successCount;
          failCount = fetchResult.failCount;
        }

        // Update settings with imported data and refetched models
        const newSettings = {
          providers: updatedProviders,
          defaultProviderId: importedSettings.defaultProviderId || settings.defaultProviderId,
          max_tokens: importedSettings.max_tokens || settings.max_tokens,
          time_limit: importedSettings.time_limit || settings.time_limit,
          temperature: importedSettings.temperature || settings.temperature,
          maxToolIterations: importedSettings.maxToolIterations || settings.maxToolIterations,
          environmentVariables:
            importedSettings.environmentVariables || settings.environmentVariables || [],
        };

        await updateAndSaveSettings(newSettings);

        onSuccess?.({ successCount, failCount });
        return true;
      } catch (error) {
        onError?.(error.message || "Failed to import backup");
        return false;
      } finally {
        onComplete?.();
      }
    },
    [settings, updateAndSaveSettings]
  );

  /**
   * Open file picker and import full backup
   * @param {Object} options - Options for the import
   * @param {Function} options.onStart - Called when import starts
   * @param {Function} options.onSuccess - Called when import succeeds
   * @param {Function} options.onError - Called when import fails with error message
   * @param {Function} options.onComplete - Called when import completes (success or error)
   */
  const importFullBackup = useCallback(
    (options = {}) => {
      const { onError } = options;

      importFromJsonFile(
        async (importedData) => {
          await processBackupData(importedData, options);
        },
        (error) => {
          onError?.(error?.message || "Failed to read backup file");
        }
      );
    },
    [processBackupData]
  );

  return { importFullBackup, processBackupData };
};
