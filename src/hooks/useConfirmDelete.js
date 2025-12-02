import { useCallback } from "react";
import { useConfirm } from "@context/ConfirmContext";
import { useToast } from "@context/ToastContext";

/**
 * Custom hook for handling delete operations with confirmation dialogs.
 *
 * Provides a consistent pattern for delete operations across the application:
 * 1. Shows confirmation dialog
 * 2. Executes delete operation if confirmed
 * 3. Updates local state
 * 4. Shows success/error toast
 *
 * @param {Object} config - Configuration object
 * @param {Function} config.setData - Function to update local state after deletion
 *
 * @returns {Object} Delete handlers
 * @returns {Function} returns.handleDelete - Delete single item with confirmation
 * @returns {Function} returns.handleClearAll - Delete all items with confirmation
 *
 * @example
 * // In a component
 * const { data: contexts, setData: setContexts } = useLocalStorageData(loadContexts);
 * const { handleDelete, handleClearAll } = useConfirmDelete({ setData: setContexts });
 *
 * // Delete single item
 * const deleteContext = handleDelete({
 *   title: "Delete Context",
 *   body: "Are you sure you want to delete this context?",
 *   deleteOperation: (id) => deleteContextFromStorage(id),
 *   successMessage: "Context deleted",
 *   successDescription: "The context has been removed"
 * });
 * await deleteContext(contextId);
 *
 * // Clear all items
 * const clearAllContexts = handleClearAll({
 *   title: "Clear All Contexts",
 *   body: "Are you sure you want to delete all contexts? This action cannot be undone.",
 *   deleteOperation: () => clearAllContextsFromStorage(),
 *   successMessage: "All contexts cleared",
 *   successDescription: "All contexts have been removed"
 * });
 * await clearAllContexts();
 */
export function useConfirmDelete({ setData }) {
  const { confirm } = useConfirm();
  const { showSuccess, showError } = useToast();

  /**
   * Creates a delete handler for single items with confirmation.
   *
   * @param {Object} options - Delete operation configuration
   * @param {string} options.title - Confirmation dialog title
   * @param {string} options.body - Confirmation dialog body text
   * @param {Function} options.deleteOperation - Async function that performs the delete (receives item id)
   * @param {string} options.successMessage - Success toast title
   * @param {string} options.successDescription - Success toast description
   * @param {string} [options.errorMessage="Delete failed"] - Error toast title
   * @param {string} [options.errorDescription="Failed to delete item"] - Error toast description
   * @param {string} [options.confirmText="Delete"] - Confirm button text
   * @param {string} [options.cancelText="Cancel"] - Cancel button text
   *
   * @returns {Function} Async function that takes an item id and performs the delete operation
   */
  const handleDelete = useCallback(
    ({
      title,
      body,
      deleteOperation,
      successMessage,
      successDescription,
      errorMessage = "Delete failed",
      errorDescription = "Failed to delete item",
      confirmText = "Delete",
      cancelText = "Cancel",
    }) => {
      return async (id) => {
        try {
          const isConfirmed = await confirm({
            title,
            body,
            confirmText,
            cancelText,
            variant: "danger",
          });

          if (isConfirmed) {
            const updatedData = await deleteOperation(id);
            setData(updatedData);
            showSuccess(successMessage, successDescription);
          }
        } catch (error) {
          console.error("Delete operation failed:", error);
          showError(errorMessage, errorDescription);
        }
      };
    },
    [confirm, setData, showSuccess, showError]
  );

  /**
   * Creates a handler for clearing all items with confirmation.
   *
   * @param {Object} options - Clear all operation configuration
   * @param {string} options.title - Confirmation dialog title
   * @param {string} options.body - Confirmation dialog body text
   * @param {Function} options.deleteOperation - Async function that performs the clear all operation
   * @param {string} options.successMessage - Success toast title
   * @param {string} options.successDescription - Success toast description
   * @param {string} [options.errorMessage="Clear failed"] - Error toast title
   * @param {string} [options.errorDescription="Failed to clear items"] - Error toast description
   * @param {string} [options.confirmText="Delete All"] - Confirm button text
   * @param {string} [options.cancelText="Cancel"] - Cancel button text
   *
   * @returns {Function} Async function that performs the clear all operation
   */
  const handleClearAll = useCallback(
    ({
      title,
      body,
      deleteOperation,
      successMessage,
      successDescription,
      errorMessage = "Clear failed",
      errorDescription = "Failed to clear items",
      confirmText = "Delete All",
      cancelText = "Cancel",
    }) => {
      return async () => {
        try {
          const isConfirmed = await confirm({
            title,
            body,
            confirmText,
            cancelText,
            variant: "danger",
          });

          if (isConfirmed) {
            await deleteOperation();
            setData([]);
            showSuccess(successMessage, successDescription);
          }
        } catch (error) {
          console.error("Clear all operation failed:", error);
          showError(errorMessage, errorDescription);
        }
      };
    },
    [confirm, setData, showSuccess, showError]
  );

  return {
    handleDelete,
    handleClearAll,
  };
}
