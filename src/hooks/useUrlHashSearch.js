import { useState, useEffect, useCallback } from "react";
import { updateUrlHashFromSearchTerm, getSearchTermFromUrlHash } from "@utils/uiUtils";

/**
 * Custom hook for managing search term with URL hash synchronization
 * Automatically syncs search term with URL hash for bookmarkable searches
 *
 * @returns {Object} Search state and setter
 * @property {string} searchTerm - Current search term
 * @property {Function} setSearchTerm - Function to update search term
 *
 * @example
 * const { searchTerm, setSearchTerm } = useUrlHashSearch();
 *
 * <Search
 *   value={searchTerm}
 *   onChange={(e) => setSearchTerm(e.target.value)}
 * />
 */
export const useUrlHashSearch = () => {
  const [searchTerm, setSearchTermState] = useState("");

  // Load search term from URL hash on mount
  useEffect(() => {
    const searchFromHash = getSearchTermFromUrlHash();
    if (searchFromHash) {
      setSearchTermState(searchFromHash);
    }
  }, []);

  // Update URL hash when search term changes
  useEffect(() => {
    updateUrlHashFromSearchTerm(searchTerm);
  }, [searchTerm]);

  const setSearchTerm = useCallback((value) => {
    setSearchTermState(value);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
  };
};
