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
import { saveContext } from "@utils/storageUtils";
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
  Tag,
} from "@carbon/react";
import { TrashCan, Add, Edit, Menu, Download, SearchLocateMirror, Chat } from "@carbon/icons-react";
import ContextModal from "@components/modals/ContextModal";
import EmptyState from "@components/shared/EmptyState";
import { loadContexts, deleteContext, clearAllContexts } from "@utils/storageUtils";
import { formatDate, truncateText } from "@utils/uiUtils";

const ContextsPage = () => {
  const { showSuccess, showError } = useToast();

  // Custom hooks - Modal and URL search
  const {
    isOpen: isModalOpen,
    currentItem: currentContext,
    editMode,
    openCreate,
    openEdit,
    close: closeModal,
  } = useModalState();

  // Load contexts from localStorage
  const { data: contexts, isLoading, setData: setContexts } = useLocalStorageData(loadContexts);

  // Search and filter matcher
  const contextMatcher = useCallback((context, lowercaseTerm) => {
    const idMatch = context.id.toString().includes(lowercaseTerm);
    const nameMatch = context.name.toLowerCase().includes(lowercaseTerm);
    const messageMatch = context.messages.some((msg) =>
      msg.message.toLowerCase().includes(lowercaseTerm)
    );
    return idMatch || nameMatch || messageMatch;
  }, []);

  // Search and filter
  const {
    searchTerm,
    filteredItems: filteredContexts,
    totalItems,
    handleSearchChange,
  } = useSearchAndFilter(contexts, contextMatcher, {
    onSearchChange: () => resetPage(),
  });

  // Pagination
  const {
    currentPage,
    pageSize,
    paginatedData: paginatedContexts,
    handlePageChange,
    resetPage,
  } = usePagination(filteredContexts, { initialPageSize: 10 });

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importedContext, setImportedContext] = useState(null);
  const [importContextName, setImportContextName] = useState("");

  // Delete handlers with confirmation
  const { handleDelete, handleClearAll } = useConfirmDelete({ setData: setContexts });

  const handleDeleteContext = handleDelete({
    title: "Delete Conversation",
    body: "Are you sure you want to delete this conversation?",
    deleteOperation: (id) => deleteContext(id),
    successMessage: "Conversation deleted",
    successDescription: "The conversation has been removed",
  });

  const handleClearAllContexts = handleClearAll({
    title: "Clear All Conversations",
    body: "Are you sure you want to delete all conversations? This action cannot be undone.",
    deleteOperation: () => clearAllContexts(),
    successMessage: "All conversations cleared",
    successDescription: "All conversations have been removed",
  });

  const handleSaveContext = (updatedContexts) => {
    setContexts(updatedContexts);
    showSuccess(
      editMode ? "Conversation updated" : "Conversation created",
      editMode
        ? "The conversation has been updated successfully"
        : "A new conversation has been created"
    );
  };

  // Import/Export handlers
  const { handleExport, handleImport } = useImportExport();

  const handleExportContext = handleExport({
    getFilename: (context) => `RPI-conversation-${context.name.replace(/\s+/g, "-")}`,
    successMessage: "Conversation exported",
    successDescription: "The conversation has been exported as JSON file",
  });

  const handleImportContext = handleImport({
    requiredFields: ["name", "messages"],
    onImport: (importedData) => {
      setImportedContext(importedData);
      setImportContextName(importedData.name);
      setImportModalOpen(true);
    },
  });

  // Handle saving imported context
  const handleSaveImportedContext = async () => {
    if (!importContextName.trim()) {
      showError("Validation Error", "Conversation name is required");
      return;
    }

    // Check for duplicate names
    const isDuplicate = contexts.some(
      (context) => context.name.toLowerCase() === importContextName.toLowerCase()
    );

    if (isDuplicate) {
      showError(
        "Validation Error",
        "A conversation with this name already exists. Please use a unique name."
      );
      return;
    }

    // Create new context object with imported data
    const newContext = {
      name: importContextName,
      messages: importedContext.messages,
    };

    // Save the context
    const updatedContexts = await saveContext(newContext);
    setContexts(updatedContexts);

    // Close modal and reset state
    setImportModalOpen(false);
    setImportedContext(null);
    setImportContextName("");

    showSuccess("Conversation imported", "The conversation has been imported successfully");
  };

  const headers = [
    { key: "name", header: "Name" },
    { key: "timestamp", header: "Date Created" },
    { key: "messageCount", header: "Messages" },
    { key: "tokens", header: "Tokens" },
    { key: "actions", header: "" },
  ];

  const rows = paginatedContexts.map((context) => ({
    id: context.id.toString(),
    timestamp: formatDate(context.timestamp),
    name: <span title={context.name}>{truncateText(context.name, 20)}</span>,
    messageCount: (
      <Tag type="cyan" size="sm">
        {context.messages.length.toLocaleString()}
      </Tag>
    ),
    tokens: (
      <Tag type="gray" size="sm">
        {context.totalTokens !== undefined ? context.totalTokens.toLocaleString() : "..."}
      </Tag>
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
                id: context.id,
                name: context.name,
                messages: [...context.messages],
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
            onClick={() => handleExportContext(context)}
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
            onClick={() => handleDeleteContext(context.id)}
          />
        </div>
      </div>
    ),
  }));

  return (
    <div className="margin-bottom-2rem">
      <div className="contextPage">
        <h1 className="sectionTitle">Conversations</h1>
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
            placeholder="Search by ID, name, or message content"
            onChange={handleSearchChange}
            value={searchTerm}
            size="md"
            className=""
            disabled={!contexts || !contexts.length}
          />
          <OverflowMenu
            className="margin-left-1rem"
            size="md"
            flipped
            aria-label="Sessions menu"
            renderIcon={Menu}
          >
            <OverflowMenuItem itemText="Import conversation" onClick={handleImportContext} />
            <OverflowMenuItem
              hasDivider
              itemText="Delete all conversations"
              onClick={handleClearAllContexts}
              isDelete
              disabled={!contexts || !contexts.length}
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
          ) : !contexts || contexts.length === 0 ? (
            <EmptyState
              icon={Chat}
              title="No conversations yet"
              description="Create a new conversation to get started with managing conversation history."
            />
          ) : filteredContexts.length === 0 ? (
            <EmptyState
              icon={SearchLocateMirror}
              title="No matching conversations"
              description="No conversations match your search criteria. Try a different search term."
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
        {isLoading || !contexts || contexts.length === 0 || filteredContexts.length === 0 ? (
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

      {/* Context Modal */}
      <ContextModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editMode={editMode}
        initialContext={currentContext}
        onSave={handleSaveContext}
      />

      {/* Import Context Modal */}
      <Modal
        size="sm"
        open={importModalOpen}
        modalHeading="Import Conversation"
        primaryButtonText="Import"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSaveImportedContext}
        onRequestClose={() => {
          setImportModalOpen(false);
          setImportedContext(null);
          setImportContextName("");
        }}
        preventCloseOnClickOutside
      >
        <p className="margin-bottom-1rem">Please provide a name for the imported conversation:</p>
        <TextInput
          id="import-context-name"
          labelText="Conversation Name"
          placeholder="Enter a name for this conversation"
          value={importContextName}
          onChange={(e) => setImportContextName(e.target.value)}
          required
        />
      </Modal>
    </div>
  );
};

export default ContextsPage;
