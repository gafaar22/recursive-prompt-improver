import { useState, useCallback, useMemo } from "react";
import { getPaginatedData } from "@utils/uiUtils";

/**
 * Custom hook for managing pagination state and data
 *
 * @param {Array} data - The data array to paginate
 * @param {Object} options - Configuration options
 * @param {number} options.initialPageSize - Initial page size (default: 10)
 * @returns {Object} Pagination state and controls
 * @property {number} currentPage - Current page number (1-indexed)
 * @property {number} pageSize - Items per page
 * @property {number} totalItems - Total number of items
 * @property {Array} paginatedData - Current page's data
 * @property {Function} handlePageChange - Carbon Design pagination change handler
 * @property {Function} resetPage - Reset to first page
 * @property {Function} setTotalItems - Manually set total items count
 *
 * @example
 * const {
 *   currentPage,
 *   pageSize,
 *   totalItems,
 *   paginatedData,
 *   handlePageChange,
 *   resetPage,
 *   setTotalItems
 * } = usePagination(filteredData, { initialPageSize: 10 });
 *
 * <DataTable rows={paginatedData} ... />
 * <Pagination
 *   page={currentPage}
 *   pageSize={pageSize}
 *   totalItems={totalItems}
 *   onChange={handlePageChange}
 * />
 */
export const usePagination = (data, options = {}) => {
  const { initialPageSize = 10 } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(data?.length || 0);

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    return getPaginatedData(data || [], currentPage, pageSize);
  }, [data, currentPage, pageSize]);

  // Handle Carbon Design Pagination component onChange
  const handlePageChange = useCallback((pageInfo) => {
    setCurrentPage(pageInfo.page);
    setPageSize(pageInfo.pageSize);
  }, []);

  // Reset to first page (useful when filtering/searching)
  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    pageSize,
    totalItems,
    paginatedData,
    handlePageChange,
    resetPage,
    setCurrentPage,
    setPageSize,
    setTotalItems,
  };
};
