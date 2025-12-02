import React, { useState, useCallback } from "react";
import { useToast } from "@context/ToastContext";
import {
  useModalState,
  usePagination,
  useSearchAndFilter,
  useLocalStorageData,
  useConfirmDelete,
  useImportExport,
} from "@hooks";
import { saveTool } from "@utils/storageUtils";
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Button,
  Grid,
  Column,
  Pagination,
  Search,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextInput,
  DataTableSkeleton,
} from "@carbon/react";
import {
  TrashCan,
  Add,
  Edit,
  Menu,
  Download,
  Tools,
  SearchLocateMirror,
  Function,
} from "@carbon/icons-react";
import ToolModal from "@components/modals/ToolModal";
import EmptyState from "@components/shared/EmptyState";
import { loadTools, deleteTool, clearAllTools } from "@utils/storageUtils";
import { formatDate, truncateText } from "@utils/uiUtils";

const ToolsPage = () => {
  const { showSuccess, showError } = useToast();

  // Custom hooks - Modal and URL search
  const {
    isOpen: isModalOpen,
    currentItem: currentTool,
    editMode,
    openCreate,
    openEdit,
    close: closeModal,
  } = useModalState();

  // Load tools from localStorage
  const { data: tools, isLoading, setData: setTools } = useLocalStorageData(loadTools);

  // Search and filter matcher
  const toolMatcher = useCallback((tool, lowercaseTerm) => {
    const idMatch = tool.id.toString().includes(lowercaseTerm);
    const nameMatch = tool.name.toLowerCase().includes(lowercaseTerm);
    const descriptionMatch = tool.description
      ? tool.description.toLowerCase().includes(lowercaseTerm)
      : false;
    return idMatch || nameMatch || descriptionMatch;
  }, []);

  // Search and filter
  const {
    searchTerm,
    filteredItems: filteredTools,
    totalItems,
    handleSearchChange,
  } = useSearchAndFilter(tools, toolMatcher, {
    onSearchChange: () => resetPage(),
  });

  // Pagination
  const {
    currentPage,
    pageSize,
    paginatedData: paginatedTools,
    handlePageChange,
    resetPage,
  } = usePagination(filteredTools, { initialPageSize: 10 });

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importedTool, setImportedTool] = useState(null);
  const [importToolName, setImportToolName] = useState("");

  // Delete handlers with confirmation
  const { handleDelete, handleClearAll } = useConfirmDelete({ setData: setTools });

  const handleDeleteTool = handleDelete({
    title: "Delete Tool",
    body: "Are you sure you want to delete this tool?",
    deleteOperation: (id) => deleteTool(id),
    successMessage: "Tool deleted",
    successDescription: "The tool has been removed",
  });

  const handleClearAllTools = handleClearAll({
    title: "Clear All Tools",
    body: "Are you sure you want to delete all tools? This action cannot be undone.",
    deleteOperation: () => clearAllTools(),
    successMessage: "All tools cleared",
    successDescription: "All tools have been removed",
  });

  const handleSaveTool = (updatedTools) => {
    setTools(updatedTools);
    showSuccess(
      editMode ? "Tool updated" : "Tool created",
      editMode ? "The tool has been updated successfully" : "A new tool has been created"
    );
  };

  // Import/Export handlers
  const { handleExport, handleImport } = useImportExport();

  const handleExportTool = handleExport({
    getFilename: (tool) => `RPI-tool-${tool.name.replace(/\s+/g, "-")}`,
    successMessage: "Tool exported",
    successDescription: "The tool has been exported as JSON file",
  });

  const handleImportTool = handleImport({
    requiredFields: ["name", "type"],
    onImport: (importedData) => {
      setImportedTool(importedData);
      setImportToolName(importedData.name);
      setImportModalOpen(true);
    },
  });

  // Handle saving imported tool
  const handleSaveImportedTool = async () => {
    if (!importToolName.trim()) {
      showError("Validation Error", "Tool name is required");
      return;
    }

    // Create new tool object with imported data
    const newTool = {
      type: importedTool.type || "function",
      name: importToolName,
      description: importedTool.description || "",
      parameters: importedTool.parameters || {},
      functionCode: importedTool.functionCode || "",
    };

    // Save the tool
    const updatedTools = await saveTool(newTool);
    setTools(updatedTools);

    // Close modal and reset state
    setImportModalOpen(false);
    setImportedTool(null);
    setImportToolName("");

    showSuccess("Tool imported", "The tool has been imported successfully");
  };

  const headers = [
    { key: "name", header: "Name" },
    { key: "timestamp", header: "Date Created" },
    { key: "actions", header: "" },
  ];

  const rows = paginatedTools.map((tool) => ({
    id: tool.id.toString(),
    timestamp: formatDate(tool.timestamp),
    name: (
      <span title={"Function"} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Function size={16} style={{ opacity: "0.5" }} />
        <span title={tool.description}>{truncateText(tool.name, 50)}</span>
      </span>
    ),
    actions: (
      <div className="tableActionsContainer">
        <div></div>
        <div className="tableActionsDiv">
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Edit}
            iconDescription="Edit"
            tooltipPosition="top"
            hasIconOnly
            onClick={() =>
              openEdit({
                id: tool.id,
                type: tool.type,
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
                functionCode: tool.functionCode,
              })
            }
          >
            Edit
          </Button>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Download}
            iconDescription="Export"
            tooltipPosition="top"
            hasIconOnly
            onClick={() => handleExportTool(tool)}
          >
            Export
          </Button>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={TrashCan}
            iconDescription="Delete"
            tooltipPosition="top"
            hasIconOnly
            onClick={() => handleDeleteTool(tool.id)}
          />
        </div>
      </div>
    ),
  }));

  return (
    <div className="margin-bottom-2rem">
      <div className="contextPage">
        <h1 className="sectionTitle">Tools</h1>
        <div className="flex-center">
          <Button
            size="md"
            renderIcon={Add}
            kind="tertiary"
            onClick={openCreate}
            className="margin-right-1rem"
          >
            New
          </Button>
          <Search
            labelText="Search"
            placeholder="Search by ID, name, or description"
            onChange={handleSearchChange}
            value={searchTerm}
            size="md"
            className=""
            disabled={!tools || !tools.length}
          />
          <OverflowMenu
            className="margin-left-1rem"
            size="md"
            flipped
            aria-label="Tools menu"
            renderIcon={Menu}
          >
            <OverflowMenuItem itemText="Import tool" onClick={handleImportTool} />
            <OverflowMenuItem
              hasDivider
              itemText="Delete all tools"
              onClick={handleClearAllTools}
              isDelete
              disabled={!tools || !tools.length}
            />
          </OverflowMenu>
        </div>
      </div>
      <Grid className="row-gap-0">
        <Column lg={16} md={8} sm={4}>
          {isLoading ? (
            <DataTableSkeleton
              showHeader={false}
              showToolbar={false}
              headers={headers}
              rowCount={pageSize}
              columnCount={headers.length}
            />
          ) : !tools || tools.length === 0 ? (
            <EmptyState
              icon={Tools}
              title="No tools yet"
              description="Create a new tool to get started with custom functions and utilities."
            />
          ) : filteredTools.length === 0 ? (
            <EmptyState
              icon={SearchLocateMirror}
              title="No matching tools"
              description="No tools match your search criteria. Try a different search term."
            />
          ) : (
            <DataTable rows={rows} headers={headers}>
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header, idx) => (
                          <TableHeader {...getHeaderProps({ header })} key={`${idx}`}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row, idx) => (
                        <TableRow {...getRowProps({ row })} key={`${idx}`}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          )}
        </Column>
        {isLoading || !tools || tools.length === 0 || filteredTools.length === 0 ? (
          <></>
        ) : (
          <Column lg={16} md={8} sm={4}>
            <Pagination
              backwardText="Previous page"
              forwardText="Next page"
              itemsPerPageText="Items per page:"
              pageNumberText="Page Number"
              pageSize={pageSize}
              pageSizes={[5, 10, 15, 25, 50]}
              totalItems={totalItems}
              page={currentPage}
              onChange={handlePageChange}
            />
          </Column>
        )}
      </Grid>

      {/* Tool Modal */}
      <ToolModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editMode={editMode}
        initialTool={currentTool}
        onSave={handleSaveTool}
      />

      {/* Import Tool Modal */}
      <Modal
        size="sm"
        open={importModalOpen}
        modalHeading="Import Tool"
        primaryButtonText="Import"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSaveImportedTool}
        onRequestClose={() => {
          setImportModalOpen(false);
          setImportedTool(null);
          setImportToolName("");
        }}
        preventCloseOnClickOutside
      >
        <p className="margin-bottom-1rem">Please provide a name for the imported tool:</p>
        <TextInput
          id="import-tool-name"
          labelText="Tool Name"
          placeholder="Enter a name for this tool"
          value={importToolName}
          onChange={(e) => setImportToolName(e.target.value)}
          required
        />
      </Modal>
    </div>
  );
};

export default ToolsPage;
