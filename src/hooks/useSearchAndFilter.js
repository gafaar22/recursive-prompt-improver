import { useState, useEffect, useCallback } from "react";
import { filterItemsBySearchTerm } from "@utils/uiUtils";

/**
 * Custom hook for managing search and filter functionality
 * Automatically filters data based on search term and custom matcher function
 *
 * @param {Array} items - The items to filter
 * @param {Function} matcherFunction - Custom function to match items (item, lowercaseTerm) => boolean
 * @param {Object} options - Configuration options
 * @param {Function} options.onSearchChange - Callback when search changes (e.g., reset pagination)
 * @returns {Object} Search state and filtered data
 * @property {string} searchTerm - Current search term
 * @property {Array} filteredItems - Filtered items based on search
 * @property {number} totalItems - Count of filtered items
 * @property {Function} handleSearchChange - Search input onChange handler
 * @property {Function} setSearchTerm - Manually set search term
 * @property {Function} updateItems - Update source items
 *
 * @example
 * const {
 *   searchTerm,
 *   filteredItems,
 *   totalItems,
 *   handleSearchChange
 * } = useSearchAndFilter(
 *   contexts,
 *   (context, term) => context.name.toLowerCase().includes(term),
 *   { onSearchChange: () => setCurrentPage(1) }
 * );
 *
 * <Search value={searchTerm} onChange={handleSearchChange} />
 * <DataTable rows={filteredItems} ... />
 */
export const useSearchAndFilter = (items, matcherFunction, options = {}) => {
  const { onSearchChange } = options;

  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState(items || []);
  const [totalItems, setTotalItems] = useState(items?.length || 0);

  // Filter items whenever items or searchTerm changes
  useEffect(() => {
    if (!items) {
      setFilteredItems([]);
      setTotalItems(0);
      return;
    }

    const filtered = filterItemsBySearchTerm(items, searchTerm, matcherFunction);
    setFilteredItems(filtered);
    setTotalItems(filtered.length);
  }, [items, searchTerm, matcherFunction]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setSearchTerm(value);

      // Trigger callback (e.g., reset pagination)
      if (onSearchChange) {
        onSearchChange(value);
      }
    },
    [onSearchChange]
  );

  // Manual update function
  const updateItems = useCallback(
    (newItems) => {
      if (!newItems) {
        return;
      }

      const filtered = filterItemsBySearchTerm(newItems, searchTerm, matcherFunction);
      setFilteredItems(filtered);
      setTotalItems(filtered.length);
    },
    [searchTerm, matcherFunction]
  );

  return {
    searchTerm,
    filteredItems,
    totalItems,
    handleSearchChange,
    setSearchTerm,
    updateItems,
  };
};
