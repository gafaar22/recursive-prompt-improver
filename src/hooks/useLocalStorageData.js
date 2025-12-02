import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for loading and managing data from localStorage
 * Handles loading state and provides reload functionality
 *
 * @param {Function} loadFunction - Async function that loads data from localStorage
 * @param {Object} options - Configuration options
 * @param {Function} options.onLoad - Callback after data is loaded
 * @param {number} options.loadDelay - Delay in ms before setting loading to false (default: 300)
 * @returns {Object} Data state and controls
 * @property {Array|Object} data - Loaded data
 * @property {boolean} isLoading - Loading state
 * @property {Function} reload - Function to reload data
 * @property {Function} setData - Function to update data
 * @property {Error} error - Error if load failed
 *
 * @example
 * const {
 *   data: contexts,
 *   isLoading,
 *   reload,
 *   setData: setContexts
 * } = useLocalStorageData(loadContexts, {
 *   onLoad: (data) => console.log('Loaded:', data),
 *   loadDelay: 300
 * });
 *
 * if (isLoading) return <Loading />;
 * return <DataTable rows={contexts} />;
 */
export const useLocalStorageData = (loadFunction, options = {}) => {
  const { onLoad, loadDelay = 300 } = options;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data function
  const loadData = useCallback(
    async (skipDelay = false) => {
      if (!skipDelay) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const loadedData = await loadFunction();
        setData(loadedData);

        // Call onLoad callback if provided
        if (onLoad) {
          onLoad(loadedData);
        }

        // Add delay for smooth UX
        setTimeout(
          () => {
            setIsLoading(false);
          },
          skipDelay ? 0 : loadDelay
        );
      } catch (err) {
        setError(err);
        setIsLoading(false);
        console.error("Error loading data:", err);
      }
    },
    [loadFunction, onLoad, loadDelay]
  );

  // Reload function (can skip delay for quick reloads)
  const reload = useCallback(
    (skipDelay = false) => {
      loadData(skipDelay);
    },
    [loadData]
  );

  // Load on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    isLoading,
    error,
    reload,
    setData,
  };
};
