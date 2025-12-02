import { useEffect, useRef } from "react";

/**
 * Custom hook for debouncing effects
 * Similar to useEffect but with a debounce delay
 *
 * @param {Function} callback - The effect callback to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @param {Array} dependencies - Effect dependencies
 *
 * @example
 * // Auto-save form data after 500ms of inactivity
 * useDebounceEffect(
 *   () => saveToLocalStorage(formData),
 *   500,
 *   [formData]
 * );
 *
 * @example
 * // Search API call after 300ms of typing
 * useDebounceEffect(
 *   () => {
 *     if (searchTerm) {
 *       searchAPI(searchTerm);
 *     }
 *   },
 *   300,
 *   [searchTerm]
 * );
 */
export const useDebounceEffect = (callback, delay, dependencies) => {
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      callbackRef.current();
    }, delay);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};
