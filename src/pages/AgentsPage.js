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
import { saveAgent } from "@utils/storageUtils";
import { validateAgentName } from "@utils/uiUtils";
import {
  Button,
  Grid,
  Column,
  PaginationNav,
  Search,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextInput,
} from "@carbon/react";
import { Add, Menu, SearchLocateMirror, Bot } from "@carbon/icons-react";
import AgentModal from "@components/modals/AgentModal";
import ChatModal from "@components/modals/ChatModal";
import { AgentCard, AgentCardSkeleton } from "@components/AgentsComponent";
import EmptyState from "@components/shared/EmptyState";
import { loadAgents, deleteAgent, clearAllAgents } from "@utils/storageUtils";

const AgentsPage = () => {
  const { showSuccess, showError } = useToast();

  // Custom hooks - Modal and URL search
  const {
    isOpen: isModalOpen,
    currentItem: currentAgent,
    editMode,
    openCreate,
    openEdit,
    close: closeModal,
  } = useModalState();

  // Load agents from localStorage
  const { data: agents, isLoading, setData: setAgents } = useLocalStorageData(loadAgents);

  // Sort agents from latest to oldest (by id which is a timestamp)
  const sortedAgents = React.useMemo(() => {
    if (!agents) return [];
    return [...agents].sort((a, b) => b.id - a.id);
  }, [agents]);

  // Search and filter matcher
  const agentMatcher = useCallback((agent, lowercaseTerm) => {
    const idMatch = agent.id.toString().includes(lowercaseTerm);
    const nameMatch = agent.name.toLowerCase().includes(lowercaseTerm);
    const instructionsMatch = agent.instructions
      ? agent.instructions.toLowerCase().includes(lowercaseTerm)
      : false;
    return idMatch || nameMatch || instructionsMatch;
  }, []);

  // Search and filter
  const {
    searchTerm,
    filteredItems: filteredAgents,
    totalItems,
    handleSearchChange,
  } = useSearchAndFilter(sortedAgents, agentMatcher, {
    onSearchChange: () => resetPage(),
  });

  // Pagination
  const {
    currentPage,
    pageSize,
    paginatedData: paginatedAgents,
    handlePageChange,
    resetPage,
  } = usePagination(filteredAgents, { initialPageSize: 12 });

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importedAgent, setImportedAgent] = useState(null);
  const [importAgentName, setImportAgentName] = useState("");

  // Chat modal state
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState(null);

  // Delete handlers with confirmation
  const { handleDelete, handleClearAll } = useConfirmDelete({ setData: setAgents });

  const handleDeleteAgent = handleDelete({
    title: "Delete Agent",
    body: "Are you sure you want to delete this agent?",
    deleteOperation: (id) => deleteAgent(id),
    successMessage: "Agent deleted",
    successDescription: "The agent has been removed",
  });

  const handleClearAllAgents = handleClearAll({
    title: "Clear All Agents",
    body: "Are you sure you want to delete all agents? This action cannot be undone.",
    deleteOperation: () => clearAllAgents(),
    successMessage: "All agents cleared",
    successDescription: "All agents have been removed",
  });

  const handleSaveAgent = async (agent) => {
    const updatedAgents = await saveAgent(agent);
    setAgents(updatedAgents);

    // Reload all agents from storage to ensure we have fresh references
    // This is important because other agents might have been updated by propagation
    const freshAgents = await loadAgents();
    setAgents(freshAgents);

    showSuccess(
      editMode ? "Agent updated" : "Agent created",
      editMode ? "The agent has been updated successfully" : "A new agent has been created"
    );
  };

  // Import/Export handlers
  const { handleExport, handleImport } = useImportExport();

  const handleExportAgent = handleExport({
    getFilename: (agent) => `RPI-agent-${agent.name.replace(/\s+/g, "-")}`,
    successMessage: "Agent exported",
    successDescription: "The agent has been exported as JSON file",
  });

  const handleImportAgent = handleImport({
    requiredFields: ["name", "instructions"],
    onImport: (importedData) => {
      setImportedAgent(importedData);
      setImportAgentName(importedData.name);
      setImportModalOpen(true);
    },
  });

  // Handle saving imported agent
  const handleSaveImportedAgent = async () => {
    // Validate agent name
    const validationError = validateAgentName(importAgentName.trim(), agents);
    if (validationError) {
      showError("Invalid Agent Name", validationError);
      return;
    }

    // Create new agent object with imported data
    const newAgent = {
      name: importAgentName.trim(),
      instructions: importedAgent.instructions || "",
      selectedTools: importedAgent.selectedTools || [],
      coreModel: importedAgent.coreModel,
      useJsonOutput: importedAgent.useJsonOutput || false,
      useJsonSchema: importedAgent.useJsonSchema || false,
      jsonSchema: importedAgent.jsonSchema || "",
      jsonSchemaStrict: importedAgent.jsonSchemaStrict || false,
      chatMessages: importedAgent.chatMessages || [],
    };

    // Save the agent
    const updatedAgents = await saveAgent(newAgent);
    setAgents(updatedAgents);

    // Close modal and reset state
    setImportModalOpen(false);
    setImportedAgent(null);
    setImportAgentName("");

    showSuccess("Agent imported", "The agent has been imported successfully");
  };

  const handleChatWithAgent = (agent) => {
    setChatAgent(agent);
    setIsChatModalOpen(true);
  };

  const handleUpdateChatMessages = async (messages) => {
    // Update chat messages in the agent and persist to storage
    if (chatAgent && chatAgent.id) {
      const updatedAgent = {
        ...chatAgent,
        chatMessages: messages,
      };

      // Save the updated agent
      const updatedAgents = await saveAgent(updatedAgent);
      setAgents(updatedAgents);

      // Update the current chatAgent state
      setChatAgent(updatedAgent);
    }
  };

  return (
    <div className="agents-page margin-bottom-2rem">
      <div className="contextPage">
        <h1 className="sectionTitle">Agents</h1>
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
            placeholder="Search by ID, name, or instructions"
            onChange={handleSearchChange}
            value={searchTerm}
            size="md"
            className=""
            disabled={!agents || !agents.length}
          />
          <OverflowMenu
            className="margin-left-1rem"
            size="md"
            flipped
            aria-label="Agents menu"
            renderIcon={Menu}
          >
            <OverflowMenuItem itemText="Import agent" onClick={handleImportAgent} />
            <OverflowMenuItem
              hasDivider
              itemText="Delete all agents"
              onClick={handleClearAllAgents}
              isDelete
              disabled={!agents || !agents.length}
            />
          </OverflowMenu>
        </div>
      </div>
      <Grid className="row-gap-0">
        <Column lg={16} md={8} sm={4}>
          {isLoading ? (
            <div className="agents-skeleton">
              {Array.from({ length: pageSize }).map((_, index) => (
                <AgentCardSkeleton key={index} />
              ))}
            </div>
          ) : !agents || agents.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agents yet"
              description="Create a new agent to save and reuse form configurations with instructions, tools, and models."
            />
          ) : filteredAgents.length === 0 ? (
            <EmptyState
              icon={SearchLocateMirror}
              title="No matching agents"
              description="No agents match your search criteria. Try a different search term."
            />
          ) : (
            <div className="agents-grid">
              {paginatedAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={() =>
                    openEdit({
                      id: agent.id,
                      name: agent.name,
                      description: agent.description,
                      instructions: agent.instructions,
                      selectedTools: agent.selectedTools,
                      coreModel: agent.coreModel,
                      useJsonOutput: agent.useJsonOutput,
                      useJsonSchema: agent.useJsonSchema,
                      jsonSchema: agent.jsonSchema,
                      jsonSchemaStrict: agent.jsonSchemaStrict,
                      chatMessages: agent.chatMessages || [],
                    })
                  }
                  onDelete={() => handleDeleteAgent(agent.id)}
                  onExport={() => handleExportAgent(agent)}
                  onChat={() => handleChatWithAgent(agent)}
                />
              ))}
            </div>
          )}
        </Column>
        {!isLoading &&
          agents &&
          agents.length > 0 &&
          filteredAgents.length > 0 &&
          Math.ceil(totalItems / pageSize) > 1 && (
            <Column lg={16} md={8} sm={4} className="margin-top-2rem flex-center flex-justify">
              <PaginationNav
                itemsShown={5}
                totalItems={Math.ceil(totalItems / pageSize)}
                page={currentPage - 1}
                onChange={(index) => handlePageChange({ page: index + 1, pageSize })}
              />
            </Column>
          )}
      </Grid>

      {/* Agent Modal */}
      <AgentModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editMode={editMode}
        initialAgent={currentAgent}
        onSave={handleSaveAgent}
      />

      {/* Chat Modal */}
      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          setChatAgent(null);
        }}
        formData={{
          id: chatAgent?.id, // Current agent ID to prevent self-reference
          instructions: chatAgent?.instructions,
          coreModel: chatAgent?.coreModel,
          selectedTools: chatAgent?.selectedTools,
          chatMessages: chatAgent?.chatMessages || [],
          useJsonOutput: chatAgent?.useJsonOutput,
          useJsonSchema: chatAgent?.useJsonSchema,
          jsonSchema: chatAgent?.jsonSchema,
          jsonSchemaStrict: chatAgent?.jsonSchemaStrict,
        }}
        onUpdateMessages={handleUpdateChatMessages}
        modalTitle={`Chat with ${chatAgent?.name || "assistant"}`}
      />

      {/* Import Agent Modal */}
      <Modal
        size="sm"
        open={importModalOpen}
        modalHeading="Import Agent"
        primaryButtonText="Import"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSaveImportedAgent}
        onRequestClose={() => {
          setImportModalOpen(false);
          setImportedAgent(null);
          setImportAgentName("");
        }}
      >
        <p className="margin-bottom-1rem">Please provide a name for the imported agent:</p>
        <TextInput
          id="import-agent-name"
          labelText="Agent Name"
          placeholder="Enter a name for this agent"
          value={importAgentName}
          onChange={(e) => setImportAgentName(e.target.value)}
          helperText="1-64 characters, must start with a letter, can contain letters, numbers, hyphens, and underscores"
          required
        />
      </Modal>
    </div>
  );
};

export default AgentsPage;
