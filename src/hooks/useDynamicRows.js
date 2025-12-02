import { useState, useCallback } from "react";

/**
 * Custom hook for managing dynamic TextArea row expansion on focus/blur.
 *
 * Provides a simple pattern for expanding TextArea fields when focused
 * and collapsing them when blurred, improving UX for multi-line inputs.
 *
 * @param {number} [collapsedRows=1] - Number of rows when collapsed (not focused)
 * @param {number} [expandedRows=3] - Number of rows when expanded (focused)
 *
 * @returns {Object} Row management utilities
 * @returns {number} returns.rows - Current number of rows to display
 * @returns {Function} returns.onFocus - Handler for focus event
 * @returns {Function} returns.onBlur - Handler for blur event (accepts callback)
 * @returns {Function} returns.reset - Reset to collapsed state
 *
 * @example
 * // Basic usage
 * const { rows, onFocus, onBlur } = useDynamicRows(1, 3);
 *
 * <TextArea
 *   rows={rows}
 *   onFocus={onFocus}
 *   onBlur={onBlur}
 * />
 *
 * @example
 * // With blur callback
 * const { rows, onFocus, onBlur } = useDynamicRows(2, 5);
 *
 * <TextArea
 *   rows={rows}
 *   onFocus={onFocus}
 *   onBlur={() => {
 *     onBlur();
 *     // Additional logic after blur
 *     validateField();
 *   }}
 * />
 *
 * @example
 * // With custom rows per field
 * const description = useDynamicRows(1, 3);
 * const notes = useDynamicRows(2, 8);
 *
 * <TextArea
 *   labelText="Description"
 *   rows={description.rows}
 *   onFocus={description.onFocus}
 *   onBlur={description.onBlur}
 * />
 * <TextArea
 *   labelText="Notes"
 *   rows={notes.rows}
 *   onFocus={notes.onFocus}
 *   onBlur={notes.onBlur}
 * />
 */
export function useDynamicRows(collapsedRows = 1, expandedRows = 3) {
  const [rows, setRows] = useState(collapsedRows);

  const onFocus = useCallback(() => {
    setRows(expandedRows);
  }, [expandedRows]);

  const onBlur = useCallback(
    (callback) => {
      setRows(collapsedRows);
      if (typeof callback === "function") {
        callback();
      }
    },
    [collapsedRows]
  );

  const reset = useCallback(() => {
    setRows(collapsedRows);
  }, [collapsedRows]);

  return {
    rows,
    onFocus,
    onBlur,
    reset,
  };
}
