import { useCallback } from "react";
import { useToast } from "@context/ToastContext";
import { exportToJsonFile, importFromJsonFile } from "@utils/uiUtils";

/**
 * Custom hook for handling import/export operations with consistent error handling.
 *
 * Provides handlers for exporting data to JSON files and importing from JSON files
 * with validation and toast notifications.
 *
 * @returns {Object} Import/export handlers
 * @returns {Function} returns.handleExport - Export handler
 * @returns {Function} returns.handleImport - Import handler
 *
 * @example
 * // In a component
 * const { handleExport, handleImport } = useImportExport();
 *
 * // Export single item
 * const exportContext = handleExport({
 *   getFilename: (item) => `RPI-context-${item.name.replace(/\s+/g, "-")}`,
 *   successMessage: "Context exported",
 *   successDescription: "The context has been exported as JSON file",
 * });
 * await exportContext(contextData);
 *
 * // Import with validation and custom save
 * const importContext = handleImport({
 *   requiredFields: ["name", "messages"],
 *   onImport: (data, setModalOpen, setImportedData, setImportName) => {
 *     setImportedData(data);
 *     setImportName(data.name);
 *     setModalOpen(true);
 *   }
 * });
 * importContext();
 */
export function useImportExport() {
  const { showSuccess, showError } = useToast();

  /**
   * Creates an export handler for single items.
   *
   * @param {Object} options - Export configuration
   * @param {Function} options.getFilename - Function that takes the data and returns filename (without .json)
   * @param {string} options.successMessage - Success toast title
   * @param {string} options.successDescription - Success toast description
   * @param {string} [options.errorMessage="Export failed"] - Error toast title
   * @param {string} [options.errorDescription="Failed to export data"] - Error toast description
   *
   * @returns {Function} Async function that takes data and exports it to JSON
   */
  const handleExport = useCallback(
    ({
      getFilename,
      successMessage,
      successDescription,
      errorMessage = "Export failed",
      errorDescription = "Failed to export data",
    }) => {
      return async (data) => {
        try {
          const filename = getFilename(data);
          const success = await exportToJsonFile(data, filename);

          if (success) {
            showSuccess(successMessage, successDescription);
          }
        } catch (error) {
          console.error("Export operation failed:", error);
          showError(errorMessage, errorDescription);
        }
      };
    },
    [showSuccess, showError]
  );

  /**
   * Creates an export handler for multiple items (batch export).
   *
   * @param {Object} options - Batch export configuration
   * @param {string} options.filename - Static filename for the export
   * @param {Function} [options.transformData] - Optional function to transform data before export
   * @param {string} options.successMessage - Success toast title
   * @param {string} options.successDescription - Success toast description
   * @param {string} [options.errorMessage="Export failed"] - Error toast title
   * @param {string} [options.errorDescription="Failed to export data"] - Error toast description
   *
   * @returns {Function} Async function that takes data array and exports it to JSON
   */
  const handleBatchExport = useCallback(
    ({
      filename,
      transformData,
      successMessage,
      successDescription,
      errorMessage = "Export failed",
      errorDescription = "Failed to export data",
    }) => {
      return async (dataArray) => {
        try {
          const dataToExport = transformData ? transformData(dataArray) : dataArray;
          const success = await exportToJsonFile(dataToExport, filename);

          if (success) {
            showSuccess(successMessage, successDescription);
          }
        } catch (error) {
          console.error("Batch export operation failed:", error);
          showError(errorMessage, errorDescription);
        }
      };
    },
    [showSuccess, showError]
  );

  /**
   * Creates an import handler with validation.
   *
   * @param {Object} options - Import configuration
   * @param {Array<string>} options.requiredFields - Array of required field names for validation
   * @param {Function} options.onImport - Callback when import succeeds, receives (importedData)
   * @param {string} [options.errorMessage="Import failed"] - Error toast title
   * @param {string} [options.errorDescription="Failed to import data"] - Error toast description
   *
   * @returns {Function} Function that triggers file picker and handles import
   */
  const handleImport = useCallback(
    ({ requiredFields, onImport, errorMessage = "Import failed", errorDescription }) => {
      return () => {
        importFromJsonFile(
          (importedData) => {
            onImport(importedData);
          },
          (title, message) => {
            showError(errorMessage, errorDescription || message);
          },
          requiredFields
        );
      };
    },
    [showError]
  );

  return {
    handleExport,
    handleBatchExport,
    handleImport,
  };
}
