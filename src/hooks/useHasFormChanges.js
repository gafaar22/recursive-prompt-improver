import { useMemo } from "react";

/**
 * Custom hook to detect if form data has changed from its initial state.
 *
 * Performs deep comparison between current and initial data, useful for:
 * - Enabling/disabling save buttons in edit mode
 * - Showing "unsaved changes" warnings
 * - Preventing unnecessary saves
 *
 * @param {Object} currentData - Current form data
 * @param {Object} initialData - Initial/original form data
 * @param {Object} options - Configuration options
 * @param {boolean} [options.editMode=false] - If false, always returns true (create mode)
 * @param {Array<string>} [options.ignoreFields=[]] - Field names to ignore in comparison
 * @param {Function} [options.customComparator] - Custom comparison function (currentData, initialData) => boolean
 *
 * @returns {boolean} True if data has changed, false otherwise
 *
 * @example
 * // Simple usage
 * const hasChanges = useHasFormChanges(formData, initialFormData, { editMode });
 *
 * @example
 * // With ignored fields
 * const hasChanges = useHasFormChanges(
 *   currentTool,
 *   initialTool,
 *   {
 *     editMode,
 *     ignoreFields: ['timestamp', 'id']
 *   }
 * );
 *
 * @example
 * // With custom comparator for complex logic
 * const hasChanges = useHasFormChanges(
 *   currentData,
 *   initialData,
 *   {
 *     editMode,
 *     customComparator: (current, initial) => {
 *       // Custom comparison logic
 *       return current.name !== initial.name ||
 *              JSON.stringify(current.config) !== JSON.stringify(initial.config);
 *     }
 *   }
 * );
 */
export function useHasFormChanges(
  currentData,
  initialData,
  { editMode = false, ignoreFields = [], customComparator = null } = {}
) {
  return useMemo(() => {
    // In create mode (not editing), always consider as "has changes"
    if (!editMode || !initialData) {
      return true;
    }

    // If custom comparator provided, use it
    if (customComparator && typeof customComparator === "function") {
      return customComparator(currentData, initialData);
    }

    // Deep comparison function
    const hasChangedFields = (current, initial, ignore = []) => {
      // Handle null/undefined cases
      if (current === initial) {
        return false;
      }
      if (!current || !initial) {
        return true;
      }

      // Get all keys from both objects
      const currentKeys = Object.keys(current).filter((key) => !ignore.includes(key));
      const initialKeys = Object.keys(initial).filter((key) => !ignore.includes(key));

      // Check if number of keys changed
      if (currentKeys.length !== initialKeys.length) {
        return true;
      }

      // Check each key
      for (const key of currentKeys) {
        const currentValue = current[key];
        const initialValue = initial[key];

        // Skip ignored fields
        if (ignore.includes(key)) {
          continue;
        }

        // Handle null/undefined
        if (currentValue === initialValue) {
          continue;
        }
        if (currentValue === null || currentValue === undefined) {
          if (initialValue !== null && initialValue !== undefined) {
            return true;
          }
          continue;
        }
        if (initialValue === null || initialValue === undefined) {
          return true;
        }

        // Handle arrays
        if (Array.isArray(currentValue) && Array.isArray(initialValue)) {
          if (currentValue.length !== initialValue.length) {
            return true;
          }
          // Deep compare array elements
          for (let i = 0; i < currentValue.length; i++) {
            if (typeof currentValue[i] === "object" && typeof initialValue[i] === "object") {
              if (hasChangedFields(currentValue[i], initialValue[i], ignore)) {
                return true;
              }
            } else if (currentValue[i] !== initialValue[i]) {
              return true;
            }
          }
          continue;
        }

        // Handle objects (but not arrays)
        if (
          typeof currentValue === "object" &&
          typeof initialValue === "object" &&
          !Array.isArray(currentValue) &&
          !Array.isArray(initialValue)
        ) {
          if (hasChangedFields(currentValue, initialValue, ignore)) {
            return true;
          }
          continue;
        }

        // Handle primitives and functions
        if (currentValue !== initialValue) {
          return true;
        }
      }

      return false;
    };

    return hasChangedFields(currentData, initialData, ignoreFields);
  }, [currentData, initialData, editMode, ignoreFields, customComparator]);
}
